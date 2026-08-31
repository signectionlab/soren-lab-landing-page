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

const env = Object.assign(
  {},
  loadEnvFile(path.join(root, ".env")),
  process.env
);

const googleScriptUrl = env.GOOGLE_SCRIPT_URL;

if (!googleScriptUrl) {
  console.error("GOOGLE_SCRIPT_URL 환경변수가 설정되지 않았습니다.");
  process.exit(1);
}

const formPath = path.join(root, "js", "form.js");
const placeholder = "__GOOGLE_SCRIPT_URL__";
let formJs = fs.readFileSync(formPath, "utf8");

if (!formJs.includes(placeholder)) {
  console.error("js/form.js 에 placeholder(__GOOGLE_SCRIPT_URL__)가 없습니다.");
  process.exit(1);
}

formJs = formJs.replace(placeholder, googleScriptUrl);
fs.writeFileSync(formPath, formJs);
console.log("js/form.js 환경변수 주입 완료");
