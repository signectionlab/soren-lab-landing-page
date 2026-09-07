const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const PROJECT_REF = "burxdtbxgpjszowymaok";

function loadEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;

  fs.readFileSync(filePath, "utf8")
    .split("\n")
    .forEach(function (line) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const index = trimmed.indexOf("=");
      if (index === -1) return;
      env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
    });

  return env;
}

async function tableExists(supabaseUrl, apiKey, tableName) {
  const response = await fetch(supabaseUrl + "/rest/v1/" + tableName + "?select=id&limit=1", {
    headers: {
      apikey: apiKey,
      Authorization: "Bearer " + apiKey,
    },
  });

  return response.ok;
}

async function applyViaManagementApi(accessToken, migrationName, sql) {
  const response = await fetch(
    "https://api.supabase.com/v1/projects/" + PROJECT_REF + "/database/migrations",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: migrationName,
        query: sql,
      }),
    }
  );

  const text = await response.text();
  return { ok: response.ok, status: response.status, text: text };
}

async function applyViaDatabaseQuery(accessToken, sql) {
  const response = await fetch(
    "https://api.supabase.com/v1/projects/" + PROJECT_REF + "/database/query",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  const text = await response.text();
  return { ok: response.ok, status: response.status, text: text };
}

async function applySql(accessToken, migrationName, sql) {
  let result = await applyViaManagementApi(accessToken, migrationName, sql);
  if (!result.ok) {
    result = await applyViaDatabaseQuery(accessToken, sql);
  }
  return result;
}

async function main() {
  const env = Object.assign({}, loadEnvFile(path.join(root, ".env")), process.env);
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = env.SUPABASE_ACCESS_TOKEN;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 가 .env 에 필요합니다.");
    process.exit(1);
  }

  const hasInquiries = await tableExists(supabaseUrl, serviceRoleKey, "inquiries");
  const hasBoard = await tableExists(supabaseUrl, serviceRoleKey, "board_posts");
  if (hasInquiries && hasBoard) {
    console.log("필수 테이블이 이미 존재합니다.");
    return;
  }

  const migrationsDir = path.join(root, "supabase", "migrations");
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter(function (fileName) {
      return fileName.endsWith(".sql");
    })
    .sort();

  if (accessToken) {
    for (const fileName of migrationFiles) {
      const sqlPath = path.join(migrationsDir, fileName);
      const sql = fs.readFileSync(sqlPath, "utf8");
      const migrationName = path.basename(fileName, ".sql");
      const result = await applySql(accessToken, migrationName, sql);

      if (!result.ok) {
        console.error(fileName + " 적용 실패 (" + result.status + "): " + result.text);
        process.exit(1);
      }

      console.log(fileName + " 적용 완료");
    }

    return;
  }

  console.error("SUPABASE_ACCESS_TOKEN 이 없거나 유효하지 않습니다.");

  console.error("\n수동 실행:");
  console.error("  Supabase Dashboard → SQL Editor → supabase/migrations/*.sql");
  console.error("\n또는 .env 에 SUPABASE_ACCESS_TOKEN 추가 후 다시 실행:");
  console.error("  node scripts/apply-supabase-migration.js");
  process.exit(1);
}

main().catch(function (error) {
  console.error(error.message || error);
  process.exit(1);
});
