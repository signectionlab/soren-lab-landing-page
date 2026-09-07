const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

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

async function checkTable(url, serviceRoleKey, tableName) {
  const response = await fetch(url + "/rest/v1/" + tableName + "?select=id&limit=1", {
    headers: {
      apikey: serviceRoleKey,
      Authorization: "Bearer " + serviceRoleKey,
    },
  });

  if (response.ok) {
    return { exists: true };
  }

  const text = await response.text();
  if (text.indexOf("does not exist") !== -1 || response.status === 404) {
    return { exists: false, message: text };
  }

  return { exists: false, message: text, status: response.status };
}

async function main() {
  const env = Object.assign({}, loadEnvFile(path.join(root, ".env")), process.env);
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 가 .env 에 필요합니다.");
    process.exit(1);
  }

  const tables = ["inquiries", "profiles", "board_posts"];
  let missing = 0;

  for (const tableName of tables) {
    const result = await checkTable(supabaseUrl, serviceRoleKey, tableName);
    if (result.exists) {
      console.log(tableName + " 테이블이 존재합니다.");
      continue;
    }

    missing += 1;
    console.error(tableName + " 테이블이 없습니다.");
    if (result.message) {
      console.error("API 응답: " + result.message);
    }
  }

  if (missing) {
    console.error("\nSupabase Dashboard → SQL Editor에서 migrations SQL 파일을 실행하세요:");
    console.error("  supabase/migrations/001_create_inquiries.sql");
    console.error("  supabase/migrations/002_create_board.sql");
    process.exit(1);
  }
}

main().catch(function (error) {
  console.error(error.message || error);
  process.exit(1);
});
