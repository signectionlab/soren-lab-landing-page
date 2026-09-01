(function () {
  const API_URL = "__GOOGLE_SCRIPT_URL__";
  const TOKEN_KEY = "soren_admin_token";
  const STATUS_OPTIONS = [
    { value: "NEW", label: "신규" },
    { value: "CONTACTED", label: "연락완료" },
    { value: "IN_PROGRESS", label: "상담중" },
    { value: "PROPOSAL", label: "제안발송" },
    { value: "COMPLETED", label: "완료" },
    { value: "ON_HOLD", label: "보류" },
    { value: "CLOSED", label: "종료" },
  ];

  const loginScreen = document.getElementById("loginScreen");
  const adminApp = document.getElementById("adminApp");
  const loginForm = document.getElementById("loginForm");
  const tokenInput = document.getElementById("tokenInput");
  const loginError = document.getElementById("loginError");
  const logoutBtn = document.getElementById("logoutBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const statusFilter = document.getElementById("statusFilter");
  const inquiryList = document.getElementById("inquiryList");
  const inquiryTableBody = document.getElementById("inquiryTableBody");
  const inquiryCount = document.getElementById("inquiryCount");
  const loadingState = document.getElementById("loadingState");
  const emptyState = document.getElementById("emptyState");
  const loadError = document.getElementById("loadError");
  const detailModal = document.getElementById("detailModal");
  const modalBody = document.getElementById("modalBody");
  const modalTitle = document.getElementById("modalTitle");
  const saveInquiryBtn = document.getElementById("saveInquiryBtn");
  const deleteInquiryBtn = document.getElementById("deleteInquiryBtn");
  const loginBtn = document.getElementById("loginBtn");

  if (!loginForm || !tokenInput || !loginBtn) {
    throw new Error("관리자 페이지 요소를 불러오지 못했습니다.");
  }

  let inquiries = [];
  let activeInquiry = null;

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  }

  function setToken(token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
  }

  function showLogin() {
    loginScreen.hidden = false;
    adminApp.hidden = true;
  }

  function showApp() {
    loginScreen.hidden = true;
    adminApp.hidden = false;
  }

  function setLoginError(message) {
    if (!loginError) return;
    if (!message) {
      loginError.hidden = true;
      loginError.textContent = "";
      return;
    }
    loginError.hidden = false;
    loginError.textContent = message;
  }

  function setLoadError(message) {
    if (!message) {
      loadError.hidden = true;
      loadError.textContent = "";
      return;
    }
    loadError.hidden = false;
    loadError.textContent = message;
  }

  function buildUrl(params) {
    if (!API_URL || API_URL.startsWith("__") || API_URL.indexOf("YOUR_DEPLOY_ID") !== -1) {
      throw new Error("API URL이 설정되지 않았습니다. node scripts/build-env.js 를 실행하세요.");
    }
    const url = new URL(API_URL);
    Object.keys(params).forEach(function (key) {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.set(key, String(params[key]));
      }
    });
    return url.toString();
  }

  function jsonpRequest(params) {
    return new Promise(function (resolve, reject) {
      const callbackName =
        "sorenAdminCb_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
      const url = buildUrl(Object.assign({}, params, { callback: callbackName }));
      const script = document.createElement("script");
      let timeoutId;

      function cleanup() {
        clearTimeout(timeoutId);
        delete window[callbackName];
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      }

      window[callbackName] = function (data) {
        cleanup();
        resolve(data);
      };

      script.onerror = function () {
        cleanup();
        reject(new Error("서버에 연결할 수 없습니다. 네트워크를 확인하세요."));
      };

      timeoutId = setTimeout(function () {
        cleanup();
        reject(new Error("요청 시간이 초과되었습니다. 잠시 후 다시 시도하세요."));
      }, 20000);

      script.src = url;
      document.head.appendChild(script);
    });
  }

  async function apiPostRequest(params) {
    const body = new URLSearchParams();
    Object.keys(params).forEach(function (key) {
      if (params[key] !== undefined && params[key] !== null) {
        body.set(key, String(params[key]));
      }
    });

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        redirect: "follow",
      });
      const text = await response.text();

      try {
        return JSON.parse(text);
      } catch (error) {
        throw new Error("서버 응답을 읽을 수 없습니다.");
      }
    } catch (fetchError) {
      return jsonpRequest(params);
    }
  }

  async function apiRequest(params) {
    try {
      const response = await fetch(buildUrl(params), {
        method: "GET",
        redirect: "follow",
      });
      const text = await response.text();

      try {
        return JSON.parse(text);
      } catch (error) {
        throw new Error("서버 응답을 읽을 수 없습니다.");
      }
    } catch (fetchError) {
      return jsonpRequest(params);
    }
  }

  function getStatusLabel(status) {
    const found = STATUS_OPTIONS.find(function (item) {
      return item.value === status;
    });
    return found ? found.label : status || "신규";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getInquirerLabel(item) {
    return item.name || item.company || "(미입력)";
  }

  function renderList() {
    const filterValue = statusFilter.value;
    const filtered = inquiries.filter(function (item) {
      return !filterValue || item.status === filterValue;
    });

    inquiryCount.textContent = "문의 " + filtered.length + "건";
    if (inquiryTableBody) {
      inquiryTableBody.innerHTML = "";
    }

    if (!filtered.length) {
      inquiryList.hidden = true;
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;
    inquiryList.hidden = false;

    filtered.forEach(function (item) {
      if (inquiryTableBody) {
        inquiryTableBody.appendChild(createRowElement(item));
      }
    });
  }

  function createRowElement(item) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "admin-table__row";
    row.dataset.row = String(item.row);

    const inquirerCell = document.createElement("span");
    inquirerCell.className = "admin-table__col admin-table__col--inquirer";

    const badge = document.createElement("span");
    badge.className =
      "admin-badge admin-badge--list admin-badge--" + (item.status || "NEW");
    badge.textContent = item.statusLabel || getStatusLabel(item.status);

    const nameText = document.createElement("span");
    nameText.className = "admin-table__name";
    nameText.textContent = getInquirerLabel(item);

    inquirerCell.appendChild(badge);
    inquirerCell.appendChild(nameText);

    const dateCell = document.createElement("span");
    dateCell.className = "admin-table__col admin-table__col--date";
    dateCell.textContent = item.date || "-";

    row.appendChild(inquirerCell);
    row.appendChild(dateCell);

    row.addEventListener("click", function () {
      openDetail(item);
    });

    return row;
  }

  async function deleteInquiry(row) {
    const rowNum = Number(row);
    if (!rowNum || rowNum < 2) {
      throw new Error("유효하지 않은 문의입니다.");
    }

    const result = await apiPostRequest({
      action: "delete",
      token: getToken(),
      row: rowNum,
    });

    if (!result || !result.success) {
      const message = (result && result.error) || "삭제에 실패했습니다.";
      if (message.indexOf("action") !== -1) {
        throw new Error(
          "삭제 API가 아직 배포되지 않았습니다. Apps Script Code.gs 저장 후 새 배포를 진행해 주세요."
        );
      }
      throw new Error(message);
    }

    closeDetail();
    await loadInquiries();
  }

  async function updateInquiry(row, updates) {
    const item = inquiries.find(function (entry) {
      return entry.row === row;
    });
    if (!item) {
      throw new Error("해당 문의를 찾을 수 없습니다.");
    }

    const status =
      updates.status !== undefined ? updates.status : item.status || "NEW";
    const memo = updates.memo !== undefined ? updates.memo : item.memo || "";

    const result = await apiRequest({
      action: "update",
      token: getToken(),
      row: row,
      status: status,
      memo: memo,
    });

    if (!result.success) {
      throw new Error(result.error || "저장에 실패했습니다.");
    }

    const index = inquiries.findIndex(function (entry) {
      return entry.row === row;
    });
    if (index !== -1) {
      inquiries[index] = result.inquiry;
    }

    renderList();
    return result.inquiry;
  }

  function openDetail(item) {
    activeInquiry = item;
    modalTitle.textContent = getInquirerLabel(item) + " — 문의 상세";

    const statusOptionsHtml = STATUS_OPTIONS.map(function (option) {
      const selected = option.value === (item.status || "NEW") ? " selected" : "";
      return (
        '<option value="' +
        option.value +
        '"' +
        selected +
        ">" +
        escapeHtml(option.label) +
        "</option>"
      );
    }).join("");

    modalBody.innerHTML =
      '<div class="admin-detail-status">' +
      '<span class="admin-badge admin-badge--' +
      escapeHtml(item.status || "NEW") +
      '">' +
      escapeHtml(item.statusLabel || getStatusLabel(item.status)) +
      "</span></div>" +
      '<div class="admin-detail-grid">' +
      '<div class="admin-detail-item"><span class="admin-detail-item__label">접수일시</span><div class="admin-detail-item__value">' +
      escapeHtml(item.date) +
      "</div></div>" +
      '<div class="admin-detail-item"><span class="admin-detail-item__label">문의유형</span><div class="admin-detail-item__value">' +
      escapeHtml(item.type) +
      "</div></div>" +
      '<div class="admin-detail-item"><span class="admin-detail-item__label">회사명</span><div class="admin-detail-item__value">' +
      escapeHtml(item.company) +
      "</div></div>" +
      '<div class="admin-detail-item"><span class="admin-detail-item__label">담당자</span><div class="admin-detail-item__value">' +
      escapeHtml(item.name) +
      "</div></div>" +
      '<div class="admin-detail-item admin-detail-grid__full"><span class="admin-detail-item__label">이메일</span><div class="admin-detail-item__value">' +
      '<span class="admin-detail-email-label">[이메일]</span> ' +
      '<span class="admin-detail-email-address">' +
      escapeHtml(item.email || "없음") +
      "</span></div></div>" +
      '<div class="admin-detail-item admin-detail-grid__full"><span class="admin-detail-item__label">문의내용</span><div class="admin-detail-item__value admin-detail-message">' +
      escapeHtml(item.message) +
      "</div></div>" +
      "</div>" +
      '<div class="admin-detail-manage">' +
      '<label class="admin-field"><span class="admin-field__label">상담 상태</span>' +
      '<select id="modalStatus">' +
      statusOptionsHtml +
      "</select></label>" +
      '<label class="admin-field"><span class="admin-field__label">관리자 메모</span>' +
      '<textarea id="modalMemo" rows="4" placeholder="상담 메모를 입력하세요.">' +
      escapeHtml(item.memo) +
      "</textarea></label></div>";

    detailModal.hidden = false;
    detailModal.setAttribute("aria-hidden", "false");
  }

  function closeDetail() {
    detailModal.hidden = true;
    detailModal.setAttribute("aria-hidden", "true");
    activeInquiry = null;
  }

  async function loadInquiries() {
    setLoadError("");
    loadingState.hidden = false;
    inquiryList.hidden = true;
    emptyState.hidden = true;

    try {
      const result = await apiRequest({
        action: "list",
        token: getToken(),
      });

      if (!result.success) {
        throw new Error(result.error || "목록을 불러오지 못했습니다.");
      }

      inquiries = result.inquiries || [];
      renderList();
    } catch (error) {
      if (String(error.message).indexOf("인증") !== -1) {
        clearToken();
        showLogin();
        setLoginError(error.message);
      } else {
        setLoadError(error.message);
      }
    } finally {
      loadingState.hidden = true;
    }
  }

  async function deleteInquiryFromModal() {
    if (!activeInquiry) return;

    const label = getInquirerLabel(activeInquiry);
    const confirmed = confirm(
      '"' + label + '" 문의를 삭제할까요?\n삭제 후 복구할 수 없습니다.'
    );
    if (!confirmed) return;

    if (deleteInquiryBtn) {
      deleteInquiryBtn.disabled = true;
      deleteInquiryBtn.textContent = "삭제 중...";
    }

    try {
      await deleteInquiry(activeInquiry.row);
    } catch (error) {
      alert(error.message);
    } finally {
      if (deleteInquiryBtn) {
        deleteInquiryBtn.disabled = false;
        deleteInquiryBtn.textContent = "삭제";
      }
    }
  }

  async function saveInquiry() {
    if (!activeInquiry) return;

    const statusEl = document.getElementById("modalStatus");
    const memoEl = document.getElementById("modalMemo");
    if (!statusEl || !memoEl) return;

    saveInquiryBtn.disabled = true;
    saveInquiryBtn.textContent = "저장 중...";

    try {
      await updateInquiry(activeInquiry.row, {
        status: statusEl.value,
        memo: memoEl.value,
      });
      closeDetail();
    } catch (error) {
      alert(error.message);
    } finally {
      saveInquiryBtn.disabled = false;
      saveInquiryBtn.textContent = "저장";
    }
  }

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    setLoginError("");
    const token = tokenInput.value.trim();
    if (!token) return;

    loginBtn.disabled = true;
    loginBtn.textContent = "로그인 중...";

    setToken(token);

    try {
      const result = await apiRequest({ action: "list", token: token });
      if (!result || !result.success) {
        throw new Error((result && result.error) || "로그인에 실패했습니다.");
      }
      showApp();
      inquiries = result.inquiries || [];
      renderList();
      loadingState.hidden = true;
      setLoginError("");
    } catch (error) {
      clearToken();
      showLogin();
      setLoginError(error.message || "로그인에 실패했습니다.");
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "로그인";
    }
  });

  logoutBtn.addEventListener("click", function () {
    clearToken();
    tokenInput.value = "";
    showLogin();
  });

  refreshBtn.addEventListener("click", loadInquiries);
  statusFilter.addEventListener("change", renderList);
  saveInquiryBtn.addEventListener("click", saveInquiry);
  if (deleteInquiryBtn) {
    deleteInquiryBtn.addEventListener("click", deleteInquiryFromModal);
  }

  document.querySelectorAll("[data-close-modal]").forEach(function (el) {
    el.addEventListener("click", closeDetail);
  });

  if (getToken()) {
    showApp();
    loadInquiries();
  } else {
    showLogin();
  }
})();
