(function () {
  const supabase = window.SorenSupabase;
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const loginMessage = document.getElementById("loginMessage");
  const signupMessage = document.getElementById("signupMessage");
  const loginTab = document.getElementById("loginTab");
  const signupTab = document.getElementById("signupTab");
  const authTitle = document.getElementById("authTitle");

  if (!loginForm || !signupForm) return;

  if (!supabase) {
    setMessage(
      loginMessage,
      "Supabase 설정을 불러오지 못했습니다. node scripts/build-env.js 실행 후 다시 열어 주세요.",
      "error"
    );
    loginForm.querySelectorAll("input, button").forEach(function (element) {
      element.disabled = true;
    });
    signupForm.querySelectorAll("input, button").forEach(function (element) {
      element.disabled = true;
    });
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const nextUrl = params.get("next") || "board.html";

  function setMessage(element, message, type) {
    if (!element) return;
    element.hidden = !message;
    element.textContent = message || "";
    element.classList.toggle("message--error", type === "error");
    element.classList.toggle("message--success", type === "success");
  }

  function getAuthErrorMessage(error, fallback) {
    const message = String((error && error.message) || "");
    if (message.indexOf("Invalid login credentials") !== -1) {
      return "이메일 또는 비밀번호가 올바르지 않습니다.";
    }
    if (message.indexOf("Email not confirmed") !== -1) {
      return "이메일 인증 후 로그인할 수 있습니다.";
    }
    if (message.indexOf("User already registered") !== -1) {
      return "이미 가입된 이메일입니다. 로그인해 주세요.";
    }
    return message || fallback;
  }

  function setMode(mode) {
    const isSignup = mode === "signup";
    loginForm.hidden = isSignup;
    signupForm.hidden = !isSignup;
    loginTab.classList.toggle("is-active", !isSignup);
    signupTab.classList.toggle("is-active", isSignup);
    authTitle.textContent = isSignup ? "회원가입" : "로그인";
    setMessage(loginMessage, "");
    setMessage(signupMessage, "");
  }

  function setLoading(form, isLoading) {
    const button = form.querySelector("button[type='submit']");
    if (button) {
      button.disabled = isLoading;
      button.textContent = isLoading ? "처리 중..." : button.dataset.label;
    }
  }

  function redirectNext() {
    window.location.assign(nextUrl);
  }

  loginForm.querySelector("button[type='submit']").dataset.label = "로그인";
  signupForm.querySelector("button[type='submit']").dataset.label = "회원가입";

  loginTab.addEventListener("click", function () {
    setMode("login");
  });

  signupTab.addEventListener("click", function () {
    setMode("signup");
  });

  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    setMessage(loginMessage, "");
    setLoading(loginForm, true);

    try {
      const emailInput = loginForm.elements.email;
      const passwordInput = loginForm.elements.password;
      const { error } = await supabase.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: passwordInput.value,
      });

      if (error) throw error;
      redirectNext();
    } catch (error) {
      setMessage(loginMessage, getAuthErrorMessage(error, "로그인에 실패했습니다."), "error");
    } finally {
      setLoading(loginForm, false);
    }
  });

  signupForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    setMessage(signupMessage, "");
    setLoading(signupForm, true);

    const displayName = signupForm.elements.displayName.value.trim();
    const email = signupForm.elements.email.value.trim();

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: signupForm.elements.password.value,
        options: {
          data: {
            display_name: displayName,
          },
        },
      });

      if (error) throw error;

      if (data.session) {
        const confirmedAt =
          (data.user && (data.user.email_confirmed_at || data.user.confirmed_at)) || null;
        await supabase.from("profiles").upsert({
          id: data.user.id,
          display_name: displayName,
          email: email,
          email_verified: !!confirmedAt,
          email_confirmed_at: confirmedAt,
        });
        redirectNext();
        return;
      }

      setMode("login");
      setMessage(
        loginMessage,
        "회원가입이 완료되었습니다. 이메일 인증이 켜져 있다면 인증 후 로그인하세요.",
        "success"
      );
    } catch (error) {
      setMessage(signupMessage, getAuthErrorMessage(error, "회원가입에 실패했습니다."), "error");
    } finally {
      setLoading(signupForm, false);
    }
  });

  supabase.auth.getSession().then(function (result) {
    if (result.data && result.data.session) {
      redirectNext();
    }
  });
})();
