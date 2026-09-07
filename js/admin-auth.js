(function () {
  const supabase = window.SorenSupabase;

  const ROLE_LABELS = {
    super: "전체 관리자",
    inquiries: "문의 담당",
    board: "게시판 담당",
  };

  let cachedAccess = null;

  async function loadAccess(forceRefresh) {
    if (!supabase) {
      cachedAccess = { ok: false, role: null };
      return cachedAccess;
    }

    if (cachedAccess && !forceRefresh) {
      return cachedAccess;
    }

    const sessionResult = await supabase.auth.getSession();
    const session = sessionResult.data && sessionResult.data.session;
    if (!session) {
      cachedAccess = { ok: false, role: null };
      return cachedAccess;
    }

    const profileResult = await supabase
      .from("profiles")
      .select("admin_role, is_admin")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profileResult.error || !profileResult.data) {
      await supabase.auth.signOut();
      cachedAccess = { ok: false, role: null };
      return cachedAccess;
    }

    const role = profileResult.data.admin_role || null;
    const ok = !!role;

    if (!ok && profileResult.data.is_admin) {
      cachedAccess = {
        ok: true,
        role: "super",
        email: session.user.email || "",
        canInquiries: true,
        canBoard: true,
        canAdmins: true,
        label: ROLE_LABELS.super,
      };
      return cachedAccess;
    }

    if (!ok) {
      await supabase.auth.signOut();
    }

    cachedAccess = {
      ok: ok,
      role: role,
      email: session.user.email || "",
      canInquiries: role === "super" || role === "inquiries",
      canBoard: role === "super" || role === "board",
      canAdmins: role === "super",
      label: ROLE_LABELS[role] || "관리자",
    };

    return cachedAccess;
  }

  async function verifyAdminAccess() {
    const access = await loadAccess(true);
    return access.ok;
  }

  function getCachedAccess() {
    return cachedAccess;
  }

  function clearAccessCache() {
    cachedAccess = null;
  }

  window.SorenAdminAuth = {
    ROLE_LABELS: ROLE_LABELS,
    loadAccess: loadAccess,
    verifyAdminAccess: verifyAdminAccess,
    getCachedAccess: getCachedAccess,
    clearAccessCache: clearAccessCache,
  };
})();
