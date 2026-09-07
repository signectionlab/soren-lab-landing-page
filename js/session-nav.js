(function () {
  const supabase = window.SorenSupabase;
  const authLinks = document.querySelectorAll("[data-auth-link]");
  const boardLinks = document.querySelectorAll("[data-board-link]");
  const userEmailEls = document.querySelectorAll("[data-user-email]");

  if (!supabase) return;

  function setUserEmail(session) {
    userEmailEls.forEach(function (el) {
      const email = session && session.user ? session.user.email : "";
      el.textContent = email;
      el.hidden = !email;
    });
  }

  function setAuthLinks(session) {
    authLinks.forEach(function (link) {
      if (session) {
        link.textContent = "로그아웃";
        link.href = "#logout";
        link.dataset.authState = "signed-in";
      } else {
        link.textContent = "로그인";
        link.href = "auth.html";
        link.dataset.authState = "signed-out";
      }
    });
  }

  function setBoardLinks(session) {
    boardLinks.forEach(function (link) {
      link.href = session ? "board.html" : "auth.html?next=board.html";
    });
  }

  async function getSession() {
    const result = await supabase.auth.getSession();
    return result.data && result.data.session;
  }

  authLinks.forEach(function (link) {
    link.addEventListener("click", async function (event) {
      if (link.dataset.authState !== "signed-in") return;
      event.preventDefault();
      await supabase.auth.signOut();
      setAuthLinks(null);
    });
  });

  boardLinks.forEach(function (link) {
    link.addEventListener("click", async function (event) {
      const session = await getSession();
      if (session) return;

      event.preventDefault();
      window.location.href = "auth.html?next=board.html";
    });
  });

  getSession().then(function (session) {
    setAuthLinks(session);
    setBoardLinks(session);
    setUserEmail(session);
  });

  supabase.auth.onAuthStateChange(function (_event, session) {
    setAuthLinks(session);
    setBoardLinks(session);
    setUserEmail(session);
  });
})();
