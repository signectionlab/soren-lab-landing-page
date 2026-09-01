const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const placeholder = "__GOOGLE_SCRIPT_URL__";

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

function injectUrl(filePath, label) {
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, "utf8");
  if (!content.includes(placeholder)) {
    console.warn(label + ": placeholder가 없어 건너뜁니다.");
    return;
  }

  content = content.replaceAll(placeholder, googleScriptUrl);
  fs.writeFileSync(filePath, content);
  console.log(label + " 환경변수 주입 완료");
}

const env = Object.assign({}, loadEnvFile(path.join(root, ".env")), process.env);
const googleScriptUrl = env.GOOGLE_SCRIPT_URL;

if (!googleScriptUrl) {
  console.error("GOOGLE_SCRIPT_URL 환경변수가 설정되지 않았습니다.");
  process.exit(1);
}

injectUrl(path.join(root, "js", "form.js"), "js/form.js");
injectUrl(path.join(root, "js", "admin.js"), "js/admin.js");
