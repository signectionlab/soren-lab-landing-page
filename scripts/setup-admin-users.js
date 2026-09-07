/**
 * 관리자 전용 계정 2개 생성/갱신 (1회 실행)
 *
 * node scripts/setup-admin-users.js
 *
 * 필요 (.env):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   ADMIN1_PASSWORD, ADMIN2_PASSWORD
 *
 * 006_admin_roles.sql 실행 후 사용하세요.
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const ADMIN_ACCOUNT_DEFS = [
  {
    email: "admin1@soren.com",
    passwordEnv: "ADMIN1_PASSWORD",
    displayName: "Admin1",
    role: "super",
    label: "전체 관리자",
  },
  {
    email: "admin2@soren.com",
    passwordEnv: "ADMIN2_PASSWORD",
    displayName: "Admin2",
    role: "inquiries",
    label: "문의 담당",
  },
];

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

function buildAdminAccounts(env) {
  return ADMIN_ACCOUNT_DEFS.map(function (def) {
    const password = env[def.passwordEnv];
    if (!password) {
      throw new Error(def.passwordEnv + " 가 .env 에 필요합니다.");
    }

    return {
      email: def.email,
      password: password,
      displayName: def.displayName,
      role: def.role,
      label: def.label,
    };
  });
}

async function adminFetch(baseUrl, serviceRoleKey, method, pathname, body) {
  const response = await fetch(baseUrl + pathname, {
    method: method,
    headers: {
      Authorization: "Bearer " + serviceRoleKey,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_error) {
      data = { message: text };
    }
  }

  return { ok: response.ok, status: response.status, data: data };
}

async function findUserByEmail(baseUrl, serviceRoleKey, email) {
  const result = await adminFetch(baseUrl, serviceRoleKey, "GET", "/auth/v1/admin/users?page=1&per_page=200");
  if (!result.ok || !result.data || !Array.isArray(result.data.users)) {
    throw new Error(result.data && result.data.message ? result.data.message : "사용자 목록 조회 실패");
  }

  return result.data.users.find(function (user) {
    return String(user.email || "").toLowerCase() === email.toLowerCase();
  });
}

async function createOrUpdateUser(baseUrl, serviceRoleKey, account) {
  const existing = await findUserByEmail(baseUrl, serviceRoleKey, account.email);

  if (existing) {
    const updateResult = await adminFetch(
      baseUrl,
      serviceRoleKey,
      "PUT",
      "/auth/v1/admin/users/" + existing.id,
      {
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: { display_name: account.displayName },
      }
    );

    if (!updateResult.ok) {
      throw new Error(
        account.email +
          " 업데이트 실패: " +
          ((updateResult.data && updateResult.data.message) || updateResult.status)
      );
    }

    return existing.id;
  }

  const createResult = await adminFetch(baseUrl, serviceRoleKey, "POST", "/auth/v1/admin/users", {
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: { display_name: account.displayName },
  });

  if (!createResult.ok || !createResult.data || !createResult.data.id) {
    throw new Error(
      account.email +
        " 생성 실패: " +
        ((createResult.data && createResult.data.message) || createResult.status)
    );
  }

  return createResult.data.id;
}

async function upsertProfile(baseUrl, serviceRoleKey, userId, account) {
  const response = await fetch(baseUrl + "/rest/v1/profiles?on_conflict=id", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + serviceRoleKey,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      id: userId,
      display_name: account.displayName,
      email: account.email,
      is_admin: true,
      admin_role: account.role,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      account.email + " profiles 저장 실패 (" + response.status + "): " + text
    );
  }
}

async function main() {
  const env = Object.assign({}, loadEnvFile(path.join(root, ".env")), process.env);
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 가 .env 에 필요합니다.");
    process.exit(1);
  }

  let adminAccounts;
  try {
    adminAccounts = buildAdminAccounts(env);
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }

  console.log("관리자 계정 설정 중...\n");

  for (const account of adminAccounts) {
    const userId = await createOrUpdateUser(supabaseUrl, serviceRoleKey, account);
    await upsertProfile(supabaseUrl, serviceRoleKey, userId, account);
    console.log("✓ " + account.email + " → " + account.label + " (" + account.role + ")");
  }

  console.log("\n완료. admin.html 에서 각 관리자 이메일로 로그인하세요.");
  console.log("비밀번호는 .env 에만 보관하며 Git/Vercel 에 올리지 마세요.");
}

main().catch(function (error) {
  console.error(error.message || error);
  process.exit(1);
});
