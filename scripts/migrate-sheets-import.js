const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const BATCH_SIZE = 500;

const STATUS_LABEL_TO_CODE = {
  신규: "NEW",
  연락완료: "CONTACTED",
  상담중: "IN_PROGRESS",
  "상담 중": "IN_PROGRESS",
  제안발송: "PROPOSAL",
  "제안 발송": "PROPOSAL",
  완료: "COMPLETED",
  보류: "ON_HOLD",
  종료: "CLOSED",
};

const VALID_STATUS_CODES = new Set([
  "NEW",
  "CONTACTED",
  "IN_PROGRESS",
  "PROPOSAL",
  "COMPLETED",
  "ON_HOLD",
  "CLOSED",
]);

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

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // ignore
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function normalizeStatus(rawStatus, legacyStatus) {
  const value = String(rawStatus || legacyStatus || "").trim();
  if (!value) return "NEW";
  if (VALID_STATUS_CODES.has(value)) return value;
  if (STATUS_LABEL_TO_CODE[value]) return STATUS_LABEL_TO_CODE[value];
  return "NEW";
}

function parsePrivacy(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "true" || normalized === "on" || normalized === "yes" || normalized === "1";
}

function parseCreatedAt(value) {
  const raw = String(value || "").trim();
  if (!raw) return new Date().toISOString();

  const isoLike = raw.replace(" ", "T");
  const parsed = new Date(isoLike);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return new Date().toISOString();
}

function mapRow(cells) {
  while (cells.length < 12) {
    cells.push("");
  }

  const legacyId = parseInt(String(cells[0] || "").trim(), 10);

  return {
    legacy_sheet_id: Number.isFinite(legacyId) ? legacyId : null,
    created_at: parseCreatedAt(cells[1]),
    inquiry_type: String(cells[2] || "").trim(),
    company: String(cells[3] || "").trim(),
    name: String(cells[4] || "").trim(),
    email: String(cells[5] || "").trim(),
    message: String(cells[6] || "").trim(),
    privacy_agreed: parsePrivacy(cells[7]),
    memo: String(cells[9] || "").trim(),
    source: String(cells[10] || "").trim() || "landing_page",
    status: normalizeStatus(cells[11], cells[8]),
  };
}

async function insertBatch(url, serviceRoleKey, records) {
  const response = await fetch(url + "/rest/v1/inquiries", {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: "Bearer " + serviceRoleKey,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(records),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error("Insert failed (" + response.status + "): " + text);
  }
}

async function getCount(url, serviceRoleKey) {
  const response = await fetch(url + "/rest/v1/inquiries?select=id", {
    method: "HEAD",
    headers: {
      apikey: serviceRoleKey,
      Authorization: "Bearer " + serviceRoleKey,
      Prefer: "count=exact",
    },
  });

  const range = response.headers.get("content-range") || "";
  const match = range.match(/\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("사용법: node scripts/migrate-sheets-import.js data/sheets-export.csv");
    process.exit(1);
  }

  const absolutePath = path.isAbsolute(csvPath) ? csvPath : path.join(root, csvPath);
  if (!fs.existsSync(absolutePath)) {
    console.error("CSV 파일을 찾을 수 없습니다: " + absolutePath);
    console.error("Google Sheets → 파일 → 다운로드 → CSV 후 data/sheets-export.csv 로 저장하세요.");
    process.exit(1);
  }

  const env = Object.assign({}, loadEnvFile(path.join(root, ".env")), process.env);
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 가 .env 에 필요합니다.");
    process.exit(1);
  }

  const csvText = fs.readFileSync(absolutePath, "utf8");
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    console.error("CSV에 데이터 행이 없습니다.");
    process.exit(1);
  }

  const dataRows = rows.slice(1).filter(function (cells) {
    return cells.some(function (cell) {
      return String(cell || "").trim().length > 0;
    });
  });

  const records = dataRows.map(mapRow);
  let success = 0;
  const errors = [];

  console.log("이관 대상: " + records.length + "건");

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    try {
      await insertBatch(supabaseUrl, serviceRoleKey, batch);
      success += batch.length;
      console.log("진행: " + success + "/" + records.length);
    } catch (error) {
      errors.push({ from: i + 1, to: i + batch.length, message: error.message });
      console.error("배치 실패 (" + (i + 1) + "-" + (i + batch.length) + "): " + error.message);
    }
  }

  const total = await getCount(supabaseUrl, serviceRoleKey);
  console.log("\n=== 이관 결과 ===");
  console.log("성공: " + success + "건");
  console.log("실패 배치: " + errors.length + "개");
  if (total !== null) {
    console.log("Supabase 현재 총 건수: " + total);
  }

  if (errors.length) {
    process.exit(1);
  }
}

main().catch(function (error) {
  console.error(error.message || error);
  process.exit(1);
});
