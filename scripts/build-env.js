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

      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      env[key] = value;
    });

  return env;
}

function escapeJsString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function writeSupabaseConfig(filePath) {
  const content =
    "(function () {\n" +
    '  window.SUPABASE_URL = "' +
    escapeJsString(supabaseUrl) +
    '";\n' +
    '  window.SUPABASE_ANON_KEY = "' +
    escapeJsString(supabaseAnonKey) +
    '";\n' +
    "})();\n";

  fs.writeFileSync(filePath, content);
  console.log(path.relative(root, filePath) + " 생성 완료");
}

const env = Object.assign({}, loadEnvFile(path.join(root, ".env")), process.env);
const supabaseUrl = env.SUPABASE_URL;
const supabaseAnonKey = env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("SUPABASE_URL, SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.");
  process.exit(1);
}

writeSupabaseConfig(path.join(root, "js", "supabase-config.js"));
