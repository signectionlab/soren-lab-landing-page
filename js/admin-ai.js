(function () {
  const supabase = window.SorenSupabase;

  async function getAccessToken() {
    if (!supabase) {
      throw new Error("Supabase 클라이언트를 불러오지 못했습니다.");
    }

    const sessionResult = await supabase.auth.getSession();
    const session = sessionResult.data && sessionResult.data.session;
    if (!session || !session.access_token) {
      throw new Error("로그인이 필요합니다.");
    }

    return session.access_token;
  }

  async function generate(type, payload) {
    const token = await getAccessToken();
    const response = await fetch("/api/admin-ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        type: type,
        payload: payload || {},
      }),
    });

    let data = null;
    try {
      data = await response.json();
    } catch (_error) {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        (data && data.error) ||
          (response.status === 404
            ? "AI 기능은 Vercel 배포 환경에서 사용할 수 있습니다."
            : "AI 생성에 실패했습니다.")
      );
    }

    if (!data || !data.text) {
      throw new Error("AI 응답이 비어 있습니다.");
    }

    return data.text;
  }

  async function runButton(button, textarea, requestFactory) {
    if (!button || !textarea) return;

    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "생성 중...";

    try {
      const payload = requestFactory();
      const text = await generate(payload.type, payload.data);
      textarea.value = text;
      textarea.focus();
    } catch (error) {
      alert(error.message || "AI 생성에 실패했습니다.");
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }

  window.SorenAdminAI = {
    generate: generate,
    runButton: runButton,
  };
})();
