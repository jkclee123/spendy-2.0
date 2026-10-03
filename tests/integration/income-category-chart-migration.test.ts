import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

// Local disposable PostgreSQL cluster only; never connects to an app database.
it("groups income aggregates by category with inclusive ranges and guarded access", () => {
  const dir = mkdtempSync(join(tmpdir(), "spendy-income-chart-pg-"));
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
  const salary = "00000000-0000-0000-0000-000000000003";
  const bonus = "00000000-0000-0000-0000-000000000004";
  const signature = "public.get_income_by_category(uuid,integer,integer,integer,integer)";
  const claims = `SET ROLE authenticated; SET request.jwt.claims='{"role":"authenticated","sub":"${user}"}';`;
  const query = (startYear = 2025, startMonth = 12, endYear = 2026, endMonth = 2) =>
    `SELECT row_to_json(r) FROM public.get_income_by_category('${user}',${startYear},${startMonth},${endYear},${endMonth}) r;`;
  const rows = (input: string) =>
    sql(input)
      .split("\n")
      .filter((line) => line.startsWith("{"))
      .map((line) => JSON.parse(line));
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
      "014_rpc_execute_permissions.sql",
      "015_income_categories.sql",
      "016_income_category_chart.sql",
    ])
      sql(readFileSync(join(process.cwd(), "supabase/migrations", name), "utf8"));
    sql(`INSERT INTO auth.users VALUES ('${user}'), ('${other}');
      INSERT INTO public.users(id,name,email,created_at) VALUES ('${user}','A','a@test',1), ('${other}','B','b@test',1);
      INSERT INTO public.user_categories(id,user_id,emoji,en_name,zh_name,is_active,created_at,type) VALUES
        ('${salary}','${user}','$','Salary','Pay',false,1,'income'),
        ('${bonus}','${user}','+','Bonus',NULL,true,1,'income');
      INSERT INTO public.aggregates(user_id,year,month,category_id,type,amount,count,created_at) VALUES
        ('${user}',2025,11,'${salary}','income',9999,99,1),
        ('${user}',2025,12,'${salary}','income',100.25,2,1),
        ('${user}',2026,1,'${salary}','income',200.5,3,1),
        ('${user}',2026,2,'${salary}','income',50,1,1),
        ('${user}',2026,3,'${salary}','income',9999,99,1),
        ('${user}',2026,1,'${bonus}','income',70,2,1),
        ('${user}',2025,12,NULL,'income',10,1,1),
        ('${user}',2026,2,NULL,'income',20,2,1),
        ('${user}',2026,1,NULL,'expense',9999,99,1),
        ('${other}',2026,1,NULL,'income',9999,99,1);`);
    expect(rows(claims + query())).toEqual([
      {
        category_id: salary,
        emoji: "$",
        en_name: "Salary",
        zh_name: "Pay",
        total: 350.75,
        count: 6,
      },
      { category_id: bonus, emoji: "+", en_name: "Bonus", zh_name: null, total: 70, count: 2 },
      { category_id: null, emoji: null, en_name: null, zh_name: null, total: 30, count: 3 },
    ]);
    expect(rows(claims + query(2026, 2, 2026, 2)).map((row) => row.total)).toEqual([50, 20]);
    expect(rows(claims + query(2030, 1, 2030, 12))).toEqual([]);
    expect(() =>
      sql(
        `SET ROLE authenticated; SET request.jwt.claims='{"role":"authenticated","sub":"${other}"}';` +
          query()
      )
    ).toThrow(/Forbidden/);
    expect(() => sql("SET ROLE authenticated;" + query())).toThrow(/Forbidden/);
    expect(() => sql("SET ROLE anon;" + query())).toThrow(/permission denied/);
    expect(
      sql(
        `SELECT has_function_privilege('anon','${signature}','EXECUTE'), has_function_privilege('authenticated','${signature}','EXECUTE'), has_function_privilege('service_role','${signature}','EXECUTE');`
      )
    ).toBe("f|t|f");
    expect(
      sql(
        `SELECT prosecdef, proconfig = ARRAY['search_path=""'] FROM pg_proc WHERE oid='${signature}'::regprocedure;`
      )
    ).toBe("t|t");
  } finally {
    if (started)
      execFileSync("pg_ctl", ["-D", dataDir, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
    rmSync(dir, { recursive: true, force: true });
  }
}, 30000);
