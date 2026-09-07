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

async function check(name, fn) {
  try {
    await fn();
    console.log("[OK] " + name);
    return true;
  } catch (error) {
    console.error("[FAIL] " + name + ": " + (error.message || error));
    return false;
  }
}

async function main() {
  const env = Object.assign({}, loadEnvFile(path.join(root, ".env")), process.env);
  let passed = 0;
  let total = 0;

  async function run(name, fn) {
    total += 1;
    if (await check(name, fn)) passed += 1;
  }

  await run(".env SUPABASE_URL", async function () {
    if (!env.SUPABASE_URL) throw new Error("missing");
  });

  await run(".env SUPABASE_ANON_KEY", async function () {
    if (!env.SUPABASE_ANON_KEY) throw new Error("missing");
  });

  await run(".env SUPABASE_SERVICE_ROLE_KEY", async function () {
    if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("missing");
  });

  await run("supabase-config.js 주입", async function () {
    const content = fs.readFileSync(path.join(root, "js", "supabase-config.js"), "utf8");
    if (content.indexOf("__SUPABASE_URL__") !== -1) {
      throw new Error("node scripts/build-env.js 를 실행하세요");
    }
  });

  await run("inquiries 테이블", async function () {
    const response = await fetch(env.SUPABASE_URL + "/rest/v1/inquiries?select=id&limit=1", {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text);
    }
  });

  await run("profiles 테이블", async function () {
    const response = await fetch(env.SUPABASE_URL + "/rest/v1/profiles?select=id&limit=1", {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text);
    }
  });

  await run("board_posts 테이블", async function () {
    const response = await fetch(env.SUPABASE_URL + "/rest/v1/board_posts?select=id&limit=1", {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text);
    }
  });

  await run("anon INSERT (RLS)", async function () {
    const marker = "setup_verify_" + Date.now();
    const response = await fetch(env.SUPABASE_URL + "/rest/v1/inquiries", {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: "Bearer " + env.SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        inquiry_type: "검증",
        company: "Setup Verify",
        name: "Test",
        email: "verify@example.com",
        message: marker,
        privacy_agreed: true,
        source: "setup_verify",
        status: "NEW",
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text);
    }

    await fetch(
      env.SUPABASE_URL +
        "/rest/v1/inquiries?source=eq.setup_verify&message=eq." +
        encodeURIComponent(marker),
      {
        method: "DELETE",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
        },
      }
    );
  });

  const csvPath = path.join(root, "data", "sheets-export.csv");
  if (fs.existsSync(csvPath)) {
    await run("Sheets CSV 존재", async function () {
      const rows = fs.readFileSync(csvPath, "utf8").split("\n").filter(Boolean);
      if (rows.length < 2) throw new Error("데이터 행 없음");
    });
  } else {
    console.log("[SKIP] Sheets CSV — data/sheets-export.csv 없음");
  }

  console.log("\n" + passed + "/" + total + " 검증 통과");
  if (passed < total) process.exit(1);
}

main().catch(function (error) {
  console.error(error.message || error);
  process.exit(1);
});
