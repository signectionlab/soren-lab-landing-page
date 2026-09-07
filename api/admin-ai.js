const STATUS_LABELS = {
  NEW: "신규",
  CONTACTED: "연락완료",
  IN_PROGRESS: "상담중",
  PROPOSAL: "제안발송",
  COMPLETED: "완료",
  ON_HOLD: "보류",
  CLOSED: "종료",
};

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return null;
  return JSON.parse(text);
}

async function getAuthUser(supabaseUrl, anonKey, accessToken) {
  const response = await fetch(supabaseUrl + "/auth/v1/user", {
    headers: {
      Authorization: "Bearer " + accessToken,
      apikey: anonKey,
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function getAdminAccess(supabaseUrl, anonKey, accessToken, userId) {
  const response = await fetch(
    supabaseUrl +
      "/rest/v1/profiles?id=eq." +
      encodeURIComponent(userId) +
      "&select=admin_role,is_admin",
    {
      headers: {
        Authorization: "Bearer " + accessToken,
        apikey: anonKey,
      },
    }
  );

  if (!response.ok) {
    return { ok: false };
  }

  const rows = await response.json();
  const profile = rows && rows[0];
  if (!profile) {
    return { ok: false };
  }

  const role = profile.admin_role || (profile.is_admin ? "super" : null);
  if (!role) {
    return { ok: false };
  }

  return {
    ok: true,
    role: role,
    canInquiries: role === "super" || role === "inquiries",
    canBoard: role === "super" || role === "board",
  };
}

function buildInquiryPrompt(payload) {
  const statusLabel = STATUS_LABELS[payload.status] || payload.status || "신규";
  return (
    "다음 B2B 문의 건에 대해 담당자가 수행해야 할 업무 메모를 작성해 주세요.\n\n" +
    "[현재 상담 상태] " +
    statusLabel +
    "\n" +
    "[문의 유형] " +
    (payload.inquiryType || "-") +
    "\n" +
    "[회사명] " +
    (payload.company || "-") +
    "\n" +
    "[담당자] " +
    (payload.name || "-") +
    "\n" +
    "[이메일] " +
    (payload.email || "-") +
    "\n" +
    "[문의 내용]\n" +
    (payload.message || "-") +
    "\n\n" +
    (payload.existingMemo
      ? "[기존 메모]\n" + payload.existingMemo + "\n\n"
      : "") +
    "위 정보를 바탕으로 담당자가 바로 실행할 수 있는 업무 메모를 작성하세요."
  );
}

function buildBoardReplyPrompt(payload) {
  return (
    "다음 회원 게시글에 대한 관리자 답글 초안을 작성해 주세요.\n\n" +
    "[제목] " +
    (payload.title || "-") +
    "\n" +
    "[작성자] " +
    (payload.author || "회원") +
    "\n" +
    "[게시글 내용]\n" +
    (payload.content || "-") +
    "\n\n" +
    (payload.existingReplies && payload.existingReplies.length
      ? "[기존 답글]\n" +
        payload.existingReplies
          .map(function (reply, index) {
            return index + 1 + ". " + reply;
          })
          .join("\n") +
        "\n\n"
      : "") +
    "회원에게 보낼 답글 본문만 작성하세요."
  );
}

async function callOpenAI(apiKey, systemPrompt, userPrompt) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const message =
      (data.error && data.error.message) || "OpenAI API 호출에 실패했습니다.";
    throw new Error(message);
  }

  const text = data.choices && data.choices[0] && data.choices[0].message;
  return (text && text.content && text.content.trim()) || "";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!openaiKey || !supabaseUrl || !supabaseAnonKey) {
    return json(res, 500, { error: "서버 AI 설정이 완료되지 않았습니다." });
  }

  const authHeader = req.headers.authorization || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) {
    return json(res, 401, { error: "로그인이 필요합니다." });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (_error) {
    return json(res, 400, { error: "요청 형식이 올바르지 않습니다." });
  }

  const type = body && body.type;
  const payload = (body && body.payload) || {};

  if (type !== "inquiry" && type !== "board_reply") {
    return json(res, 400, { error: "지원하지 않는 AI 요청입니다." });
  }

  const user = await getAuthUser(supabaseUrl, supabaseAnonKey, accessToken);
  if (!user || !user.id) {
    return json(res, 401, { error: "인증에 실패했습니다." });
  }

  const access = await getAdminAccess(supabaseUrl, supabaseAnonKey, accessToken, user.id);
  if (!access.ok) {
    return json(res, 403, { error: "관리자만 AI 기능을 사용할 수 있습니다." });
  }

  if (type === "inquiry" && !access.canInquiries) {
    return json(res, 403, { error: "문의 관리 권한이 없습니다." });
  }

  if (type === "board_reply" && !access.canBoard) {
    return json(res, 403, { error: "게시판 관리 권한이 없습니다." });
  }

  try {
    let text = "";

    if (type === "inquiry") {
      text = await callOpenAI(
        openaiKey,
        "당신은 SOREN LAB(화장품 R&D·OEM/ODM B2B 기업) 문의 응대 담당자를 돕는 어시스턴트입니다. " +
          "문의 내용과 현재 상담 상태를 바탕으로 담당자가 수행해야 할 구체적인 업무 메모를 한국어로 작성하세요. " +
          "실행 가능한 할 일, 연락 방법, 준비 자료, 후속 일정을 포함하고 200~400자 내외로 간결하게 작성하세요. " +
          "메모 본문만 출력하세요.",
        buildInquiryPrompt(payload)
      );
    } else {
      text = await callOpenAI(
        openaiKey,
        "당신은 SOREN LAB 회원 게시판 관리자입니다. " +
          "회원 게시글에 대해 친절하고 정중한 존댓말로 답글 초안을 작성하세요. " +
          "회원의 질문이나 내용에 직접적으로 응답하고, 필요하면 추가 문의를 안내하세요. " +
          "150~300자 내외로 작성하고 답글 본문만 출력하세요.",
        buildBoardReplyPrompt(payload)
      );
    }

    if (!text) {
      return json(res, 502, { error: "AI 응답을 생성하지 못했습니다." });
    }

    return json(res, 200, { text: text });
  } catch (error) {
    return json(res, 502, {
      error: error.message || "AI 생성 중 오류가 발생했습니다.",
    });
  }
};
