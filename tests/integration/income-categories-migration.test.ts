import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

// Requires local PostgreSQL binaries. Uses an isolated cluster, never an app DB.
it("enforces income category integrity, history, aggregates, guards and grants", () => {
  const dir = mkdtempSync(join(tmpdir(), "spendy-income-pg-"));
  const dataDir = join(dir, "data");
  let started = false;
  const sql = (input: string) =>
    execFileSync(
      "psql",
      ["-h", dir, "-U", "postgres", "-d", "postgres", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
      { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();
  const migration = (name: string) =>
    sql(readFileSync(join(process.cwd(), "supabase/migrations", name), "utf8"));
  const user = "00000000-0000-0000-0000-000000000001";
  const other = "00000000-0000-0000-0000-000000000002";
  const expense = "00000000-0000-0000-0000-000000000003";
  const income = "00000000-0000-0000-0000-000000000004";
  const claims = `SET request.jwt.claims = '{"role":"authenticated","sub":"${user}"}';`;
  const create = (cat: string, type: string, timestamp = 1769889600000) =>
    `SELECT public.create_transaction_from_web('${user}', 10, 'Pay', ${cat}, '${type}', ${timestamp}, 480);`;
  try {
    execFileSync("initdb", ["-D", dataDir, "-U", "postgres", "-A", "trust", "--no-locale"], {
      stdio: "pipe",
    });
    execFileSync(
      "pg_ctl",
      ["-D", dataDir, "-l", join(dir, "server.log"), "-o", `-F -k ${dir} -h ''`, "-w", "start"],
      { stdio: "pipe" }
    );
    started = true;
    sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
      CREATE FUNCTION public.is_email_allowed(text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;`);
    for (const name of [
      "001_initial_schema.sql",
      "003_rpc_functions.sql",
      "008_recompute_aggregate_for_user.sql",
      "013_rpc_caller_guard.sql",
    ])
      migration(name);
    // Relevant grants from 009; unrelated auth/query functions are not needed.
    for (const signature of [
      "create_transaction_from_web(uuid,numeric,text,uuid,text,bigint,integer)",
      "update_transaction(uuid,uuid,numeric,text,uuid,text,bigint,integer)",
      "find_category_by_name(uuid,text)",
    ]) {
      sql(
        `REVOKE EXECUTE ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated;`
      );
    }
    migration("014_rpc_execute_permissions.sql");
    sql(`INSERT INTO auth.users VALUES ('${user}'), ('${other}');
      INSERT INTO public.users(id,name,email,created_at,timezone_offset_minutes) VALUES ('${user}','A','a@test',1,480), ('${other}','B','b@test',1,0);
      INSERT INTO public.user_categories(id,user_id,emoji,en_name,created_at) VALUES ('${expense}','${user}','$','Pay',2);`);
    migration("015_income_categories.sql");
    expect(sql(`SELECT type FROM public.user_categories WHERE id='${expense}';`)).toBe("expense");
    expect(() => sql(`UPDATE public.user_categories SET type='invalid';`)).toThrow();
    expect(() => sql(`UPDATE public.user_categories SET type=NULL;`)).toThrow();
    sql(
      `INSERT INTO public.user_categories(id,user_id,emoji,en_name,created_at,type) VALUES ('${income}','${user}','$','Pay',1,'income');`
    );
    expect(
      sql(`${claims} SELECT public.find_category_by_name('${user}', 'pay');`).split("\n").at(-1)
    ).toBe(expense);
    const tx = sql(claims + create(`'${income}'`, "income"))
      .split("\n")
      .at(-1);
    expect(sql(`SELECT category_id FROM public.transactions WHERE id='${tx}';`)).toBe(income);
    expect(() => sql(claims + create(`'${expense}'`, "income"))).toThrow();
    expect(() => sql(claims + create(`'${income}'`, "expense"))).toThrow();
    expect(() =>
      sql(
        `INSERT INTO public.transactions(user_id,category_id,amount,type,created_at) VALUES ('${other}','${income}',1,'income',1);`
      )
    ).toThrow();
    expect(() => sql(`UPDATE public.transactions SET type='expense' WHERE id='${tx}';`)).toThrow();
    expect(() =>
      sql(`UPDATE public.transactions SET user_id='${other}' WHERE id='${tx}';`)
    ).toThrow();
    expect(() =>
      sql(
        claims +
          `SELECT public.update_transaction('${tx}','${user}',20,'Pay','${expense}','income',1769889600000,480);`
      )
    ).toThrow();
    sql(
      claims +
        `SELECT public.update_transaction('${tx}','${user}',20,'Pay','${income}','income',1769889600000,480);`
    );
    sql(claims + create(`'${income}'`, "income", 1772308800000) + create("NULL", "income"));
    sql(`UPDATE public.user_categories SET type='expense' WHERE id='${income}';`);
    expect(
      sql(`SELECT count(*) FROM public.transactions WHERE type='income' AND category_id IS NULL;`)
    ).toBe("3");
    expect(sql(`SELECT count(*) FROM public.aggregates WHERE category_id='${income}';`)).toBe("0");
    expect(
      sql(
        `SELECT month,amount,count FROM public.aggregates WHERE user_id='${user}' AND type='income' ORDER BY month;`
      )
    ).toBe("2|30|2\n3|10|1");
    // Reverse edit also preserves historical expense types.
    sql(claims + create(`'${expense}'`, "expense"));
    sql(`UPDATE public.user_categories SET type='income' WHERE id='${expense}';`);
    expect(
      sql(`SELECT type,category_id IS NULL FROM public.transactions WHERE type='expense';`)
    ).toBe("expense|t");
    expect(() => sql(`SELECT public.find_category_by_name('${user}','Pay');`)).toThrow();
    expect(() =>
      sql(
        `SET request.jwt.claims='{"sub":"${other}","role":"authenticated"}';` +
          create("NULL", "income")
      )
    ).toThrow();
    expect(() =>
      sql(
        `SET request.jwt.claims='{"sub":"${other}","role":"authenticated"}'; SELECT public.update_transaction('${tx}','${user}',1,'',NULL,'income',1,0);`
      )
    ).toThrow();
    expect(
      sql(
        `SELECT has_function_privilege('anon','public.create_transaction_from_web(uuid,numeric,text,uuid,text,bigint,integer)','EXECUTE'), has_function_privilege('authenticated','public.update_transaction(uuid,uuid,numeric,text,uuid,text,bigint,integer)','EXECUTE'), has_function_privilege('service_role','public.create_transaction_from_web(uuid,numeric,text,uuid,text,bigint,integer)','EXECUTE'), has_function_privilege('service_role','public.find_category_by_name(uuid,text)','EXECUTE');`
      )
    ).toBe("f|t|t|t");
    sql(
      `SET ROLE service_role; SET request.jwt.claims='{"role":"service_role"}';` +
        create("NULL", "income")
    );
  } finally {
    if (started)
      execFileSync("pg_ctl", ["-D", dataDir, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
    rmSync(dir, { recursive: true, force: true });
  }
}, 30000);
