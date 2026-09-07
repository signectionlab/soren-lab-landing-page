(function () {
  window.SorenBoard = {
    escapeHtml: function (value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    },

    formatDate: function (value) {
      if (!value) return "-";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);

      const y = date.getFullYear();
      const m = date.getMonth() + 1;
      const d = date.getDate();
      const hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      const hour12 = hours % 12 || 12;

      return y + ". " + m + ". " + d + ". " + ampm + " " + hour12 + ":" + minutes + ":" + seconds;
    },

    getAuthorLabel: function (post) {
      const profile = post.profiles || {};
      return profile.email || profile.display_name || "회원";
    },

    setMessage: function (element, message, type) {
      if (!element) return;
      element.hidden = !message;
      element.textContent = message || "";
      element.classList.toggle("board-message--error", type === "error");
      element.classList.toggle("board-message--success", type === "success");
    },

    redirectToLogin: function (nextPath) {
      window.location.href = "auth.html?next=" + encodeURIComponent(nextPath || "board.html");
    },

    ensureProfile: async function (supabase, user) {
      const metadata = user.user_metadata || {};
      const confirmedAt = user.email_confirmed_at || user.confirmed_at || null;
      await supabase.from("profiles").upsert({
        id: user.id,
        display_name: metadata.display_name || metadata.name || "회원",
        email: user.email || "",
        email_verified: !!confirmedAt,
        email_confirmed_at: confirmedAt,
      });
    },

    requireSession: async function (supabase, nextPath) {
      const result = await supabase.auth.getSession();
      const session = result.data && result.data.session;
      if (!session) {
        window.SorenBoard.redirectToLogin(nextPath);
        return null;
      }
      return session;
    },
  };
})();
