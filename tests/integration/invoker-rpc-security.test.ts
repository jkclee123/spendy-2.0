import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

it("runs public RPCs under RLS without exposing privileged execution", () => {
  const dir = mkdtempSync(join(tmpdir(), "spendy-security-pg-"));
  const dataDir = join(dir, "data");
  let started = false;
  const sql = (input: string) =>
    execFileSync(
      "psql",
      ["-h", dir, "-U", "postgres", "-d", "postgres", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
      { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();
  const user = "00000000-0000-0000-0000-000000000001";
  const other = "00000000-0000-0000-0000-000000000002";
  const category = "00000000-0000-0000-0000-000000000003";
  const auth = `SET ROLE authenticated; SET request.jwt.claims='{"role":"authenticated","sub":"${user}","email":"a@test"}';`;
  const run = (input: string) =>
    sql(auth + input)
      .split("\n")
      .at(-1);
  const create = (id = user, cat = "NULL", time = 1769889600000) =>
    `SELECT public.create_transaction_from_web('${id}',10,'Pay',${cat},'income',${time},480);`;
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
    sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE SCHEMA extensions;
      CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
      CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT NULLIF(current_setting('request.jwt.claims',true),'')::jsonb $$;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;`);
    for (const name of [
      "001_initial_schema.sql",
      "002_rls_policies.sql",
      "003_rpc_functions.sql",
      "004_aggregate_queries.sql",
      "005_auth_trigger.sql",
      "008_recompute_aggregate_for_user.sql",
      "009_secure_definer_functions.sql",
      "011_email_allowlist.sql",
      "012_income_by_name.sql",
      "013_rpc_caller_guard.sql",
      "014_rpc_execute_permissions.sql",
      "015_income_categories.sql",
      "016_income_category_chart.sql",
      "017_invoker_rpc_security.sql",
    ]) {
      // Match Supabase's default table grants before tightening allowlist access.
      if (name === "017_invoker_rpc_security.sql") {
        sql("GRANT ALL ON public.allowed_emails TO anon, authenticated;");
      }
      sql(readFileSync(join(process.cwd(), "supabase/migrations", name), "utf8"));
    }
    sql(`INSERT INTO public.allowed_emails(email,normalized_email) VALUES ('a@test','a@test'),('b@test','b@test');
      INSERT INTO auth.users(id,email) VALUES ('${user}','a@test'),('${other}','b@test');
      INSERT INTO public.user_categories(id,user_id,emoji,en_name,type,created_at)
      VALUES ('${category}','${other}','$','Pay','income',1);`);
    // Signup's owner-executed trigger must still reject unlisted users.
    expect(() =>
      sql(`INSERT INTO auth.users(id,email) VALUES (gen_random_uuid(),'blocked@test');`)
    ).toThrow();
    expect(run("SELECT public.is_email_allowed(' A@TEST ');")).toBe("t");
    expect(run("SELECT public.is_email_allowed('b@test');")).toBe("f");
    expect(() => sql("SET ROLE anon; SELECT public.is_email_allowed('a@test');")).toThrow();
    expect(() => run("SELECT email FROM public.allowed_emails;")).toThrow();
    expect(() => run(create(other))).toThrow();
    expect(() => run(create(user, `'${category}'`))).toThrow();
    const tx = run(create());
    expect(sql(`SELECT month,amount,count FROM public.aggregates WHERE user_id='${user}';`)).toBe(
      "2|10|1"
    );
    run(
      `SELECT public.update_transaction('${tx}','${user}',25,'Pay',NULL,'income',1772308800000,480);`
    );
    expect(sql(`SELECT month,amount,count FROM public.aggregates WHERE user_id='${user}';`)).toBe(
      "3|25|1"
    );
    expect(run(`SELECT total FROM public.get_income_by_name('${user}',2026,1,2026,12);`)).toBe(
      "25"
    );
    expect(
      run(`SELECT income FROM public.get_monthly_income_expense_trend('${user}',2026,NULL);`)
    ).toBe("25");
    expect(run(`SELECT month FROM public.get_earliest_aggregate_yearmonth('${user}');`)).toBe("3");
    expect(run(`SELECT count(*) FROM public.get_current_user_yearmonth('${user}');`)).toBe("1");
    expect(
      run(`SELECT count(*) FROM public.get_expenses_by_category('${user}',2026,1,2026,12);`)
    ).toBe("0");
    expect(run(`SELECT public.find_category_by_name('${user}','Restaurant') IS NOT NULL;`)).toBe(
      "t"
    );
    expect(run(`SELECT total FROM public.get_income_by_category('${user}',2026,1,2026,12);`)).toBe(
      "25"
    );
    expect(() => run(`SELECT public.get_income_by_category('${other}',2026,1,2026,12);`)).toThrow();
    expect(() => run(`SELECT public.get_income_by_name('${other}',2026,1,2026,12);`)).toThrow();
    expect(() =>
      run(`SELECT public.recompute_category_aggregate('${other}',2026,2,NULL,'income',0);`)
    ).toThrow();
    expect(() =>
      run(`SELECT public.update_transaction('${tx}','${other}',1,'',NULL,'income',1,0);`)
    ).toThrow();
    expect(() => run(`SELECT public.delete_transaction('${tx}','${other}',0);`)).toThrow();
    run(`SELECT public.delete_transaction('${tx}','${user}',480);`);
    expect(sql(`SELECT count(*) FROM public.aggregates WHERE user_id='${user}';`)).toBe("0");
    sql(`SET ROLE service_role; SET request.jwt.claims='{"role":"service_role"}';` + create(other));
    expect(sql(`SELECT count(*) FROM public.transactions WHERE user_id='${other}';`)).toBe("1");
    expect(run(`SELECT count(*) FROM public.transactions WHERE user_id='${other}';`)).toBe("0");
    // Equivalent to the advisor's execution exposure check for public definers.
    expect(
      sql(`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prosecdef AND
      (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'));`)
    ).toBe("0");
  } finally {
    if (started)
      execFileSync("pg_ctl", ["-D", dataDir, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
    rmSync(dir, { recursive: true, force: true });
  }
}, 30000);
