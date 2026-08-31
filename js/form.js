(function () {
  const GOOGLE_SCRIPT_URL = "__GOOGLE_SCRIPT_URL__";

  const form = document.getElementById("contactForm");
  const successEl = document.getElementById("formSuccess");
  const submitBtn = document.getElementById("submitBtn");
  const submitErrorEl = document.getElementById("formSubmitError");

  if (!form) return;

  const fields = {
    company: { required: true, message: "회사명을 입력해 주세요." },
    name: { required: true, message: "담당자명을 입력해 주세요." },
    email: {
      required: true,
      message: "올바른 이메일 주소를 입력해 주세요.",
      validate: function (value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      },
    },
    inquiryType: { required: true, message: "문의 유형을 선택해 주세요." },
    message: { required: true, message: "문의 내용을 입력해 주세요." },
    privacy: {
      required: true,
      message: "개인정보 수집 및 이용에 동의해 주세요.",
      validate: function (_, input) {
        return input.checked;
      },
    },
  };

  function clearErrors() {
    form.querySelectorAll(".is-error").forEach(function (el) {
      el.classList.remove("is-error");
    });
    form.querySelectorAll("[data-error]").forEach(function (el) {
      el.textContent = "";
    });
    if (submitErrorEl) {
      submitErrorEl.textContent = "";
      submitErrorEl.hidden = true;
    }
  }

  function setError(name, message) {
    const input = form.elements[name];
    const errorEl = form.querySelector('[data-error="' + name + '"]');
    if (input) input.classList.add("is-error");
    if (errorEl) errorEl.textContent = message;
  }

  function setSubmitError(message) {
    if (!submitErrorEl) return;
    submitErrorEl.textContent = message;
    submitErrorEl.hidden = false;
  }

  function setLoading(isLoading) {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle("is-loading", isLoading);
    submitBtn.textContent = isLoading ? "전송 중..." : "문의 보내기";
  }

  function validate() {
    clearErrors();
    let valid = true;

    Object.keys(fields).forEach(function (name) {
      const config = fields[name];
      const input = form.elements[name];
      if (!input) return;

      const value = input.type === "checkbox" ? input.checked : input.value.trim();

      if (config.required && !value) {
        setError(name, config.message);
        valid = false;
        return;
      }

      if (config.validate && value) {
        const checkValue = input.type === "checkbox" ? input.checked : input.value.trim();
        if (!config.validate(checkValue, input)) {
          setError(name, config.message);
          valid = false;
        }
      }
    });

    return valid;
  }

  function showSuccess() {
    form.style.display = "none";
    successEl.classList.add("is-visible");
  }

  function getSubmitUrl() {
    const params = new URLSearchParams({
      company: form.company.value.trim(),
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      inquiryType: form.inquiryType.value,
      message: form.message.value.trim(),
      privacy: form.privacy.checked ? "true" : "false",
    });

    return GOOGLE_SCRIPT_URL + "?" + params.toString();
  }

  function submitViaHiddenFrame(url) {
    return new Promise(function (resolve) {
      let iframe = document.getElementById("gasSubmitFrame");

      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "gasSubmitFrame";
        iframe.name = "gasSubmitFrame";
        iframe.title = "문의 전송";
        iframe.style.cssText = "display:none;width:0;height:0;border:0";
        document.body.appendChild(iframe);
      }

      var done = false;
      function finish() {
        if (done) return;
        done = true;
        resolve();
      }

      iframe.onload = finish;
      iframe.onerror = finish;
      iframe.src = url;
      setTimeout(finish, 2500);
    });
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    try {
      await submitViaHiddenFrame(getSubmitUrl());
      showSuccess();
    } catch (error) {
      setSubmitError("문의 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setLoading(false);
    }
  });

  form.querySelectorAll("input, select, textarea").forEach(function (input) {
    input.addEventListener("input", function () {
      input.classList.remove("is-error");
      const errorEl = form.querySelector('[data-error="' + input.name + '"]');
      if (errorEl) errorEl.textContent = "";
    });
  });
})();
