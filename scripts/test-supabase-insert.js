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

async function main() {
  const env = Object.assign({}, loadEnvFile(path.join(root, ".env")), process.env);
  const supabaseUrl = env.SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    console.error("SUPABASE_URL, SUPABASE_ANON_KEY 가 필요합니다.");
    process.exit(1);
  }

  const payload = {
    inquiry_type: "테스트",
    company: "SOREN LAB Test",
    name: "Migration Test",
    email: "test@example.com",
    message: "Supabase 연동 테스트 (삭제 가능)",
    privacy_agreed: true,
    source: "migration_test",
    status: "NEW",
  };

  const response = await fetch(supabaseUrl + "/rest/v1/inquiries", {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: "Bearer " + anonKey,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error("INSERT 실패 (" + response.status + "): " + text);
    process.exit(1);
  }

  console.log("INSERT 성공");
}

main().catch(function (error) {
  console.error(error.message || error);
  process.exit(1);
});
