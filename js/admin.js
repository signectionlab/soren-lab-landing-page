(function () {
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
  const emailInput = document.getElementById("emailInput");
  const passwordInput = document.getElementById("passwordInput");
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

  if (!loginForm || !emailInput || !passwordInput || !loginBtn) {
    throw new Error("관리자 페이지 요소를 불러오지 못했습니다.");
  }

  const supabase = window.SorenSupabase;
  if (!supabase) {
    throw new Error("Supabase 클라이언트를 불러오지 못했습니다.");
  }

  let inquiries = [];
  let activeInquiry = null;
  let activeAdminTab = "inquiries";

  const inquiriesPanel = document.getElementById("inquiriesPanel");
  const boardPanel = document.getElementById("boardPanel");
  const adminsPanel = document.getElementById("adminsPanel");
  const adminTabs = document.querySelectorAll("[data-admin-tab]");
  const adminRoleLabel = document.getElementById("adminRoleLabel");
  let currentAccess = null;

  function getDefaultTab(access) {
    if (access.canInquiries) return "inquiries";
    if (access.canBoard) return "board";
    if (access.canAdmins) return "admins";
    return "inquiries";
  }

  function applyAccessUI(access) {
    currentAccess = access;

    if (adminRoleLabel) {
      adminRoleLabel.hidden = !access.ok;
      adminRoleLabel.textContent = access.label || "";
    }

    adminTabs.forEach(function (tab) {
      const tabName = tab.dataset.adminTab;
      let visible = false;
      if (tabName === "inquiries") visible = access.canInquiries;
      if (tabName === "board") visible = access.canBoard;
      if (tabName === "admins") visible = access.canAdmins;
      tab.hidden = !visible;
    });
  }

  async function enterAdminApp() {
    const access =
      window.SorenAdminAuth && (await window.SorenAdminAuth.loadAccess(true));
    if (!access || !access.ok) {
      showLogin();
      setLoginError("관리자 계정만 접속할 수 있습니다.");
      return false;
    }

    applyAccessUI(access);
    showApp();
    setActiveTab(getDefaultTab(access));
    await refreshActivePanel();
    return true;
  }

  function setActiveTab(tabName) {
    if (!currentAccess) return;

    if (tabName === "inquiries" && !currentAccess.canInquiries) return;
    if (tabName === "board" && !currentAccess.canBoard) return;
    if (tabName === "admins" && !currentAccess.canAdmins) return;

    activeAdminTab = tabName;

    adminTabs.forEach(function (tab) {
      tab.classList.toggle("is-active", tab.dataset.adminTab === tabName);
    });

    if (inquiriesPanel) {
      inquiriesPanel.hidden = tabName !== "inquiries";
    }
    if (boardPanel) {
      boardPanel.hidden = tabName !== "board";
    }
    if (adminsPanel) {
      adminsPanel.hidden = tabName !== "admins";
    }
  }

  async function refreshActivePanel() {
    if (activeAdminTab === "board") {
      if (window.SorenAdminBoard) {
        await window.SorenAdminBoard.loadBoardPosts();
      }
      return;
    }

    if (activeAdminTab === "admins") {
      if (window.SorenAdminStaff) {
        await window.SorenAdminStaff.loadAdminStaff();
      }
      return;
    }

    await loadInquiries();
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

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return y + "-" + m + "-" + d + " " + hh + ":" + mm;
  }

  function mapInquiry(row) {
    return {
      id: row.id,
      legacySheetId: row.legacy_sheet_id,
      date: formatDate(row.created_at),
      createdAt: row.created_at,
      type: row.inquiry_type || "",
      company: row.company || "",
      name: row.name || "",
      email: row.email || "",
      message: row.message || "",
      privacy: row.privacy_agreed ? "TRUE" : "FALSE",
      memo: row.memo || "",
      source: row.source || "",
      status: row.status || "NEW",
      statusLabel: getStatusLabel(row.status),
    };
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
    row.dataset.id = String(item.id);

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

  async function deleteInquiry(id) {
    const { error } = await supabase.from("inquiries").delete().eq("id", id);

    if (error) {
      throw new Error(error.message || "삭제에 실패했습니다.");
    }

    closeDetail();
    await loadInquiries();
  }

  async function updateInquiry(id, updates) {
    const item = inquiries.find(function (entry) {
      return entry.id === id;
    });
    if (!item) {
      throw new Error("해당 문의를 찾을 수 없습니다.");
    }

    const payload = {
      status: updates.status !== undefined ? updates.status : item.status || "NEW",
      memo: updates.memo !== undefined ? updates.memo : item.memo || "",
    };

    const { data, error } = await supabase
      .from("inquiries")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message || "저장에 실패했습니다.");
    }

    const mapped = mapInquiry(data);
    const index = inquiries.findIndex(function (entry) {
      return entry.id === id;
    });
    if (index !== -1) {
      inquiries[index] = mapped;
    }

    renderList();
    return mapped;
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

    const legacyHtml = item.legacySheetId
      ? '<div class="admin-detail-item"><span class="admin-detail-item__label">시트 번호</span><div class="admin-detail-item__value">' +
        escapeHtml(item.legacySheetId) +
        "</div></div>"
      : "";

    modalBody.innerHTML =
      '<div class="admin-detail-status">' +
      '<span class="admin-badge admin-badge--' +
      escapeHtml(item.status || "NEW") +
      '">' +
      escapeHtml(item.statusLabel || getStatusLabel(item.status)) +
      "</span></div>" +
      '<div class="admin-detail-grid">' +
      legacyHtml +
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
      const { data, error } = await supabase
        .from("inquiries")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message || "목록을 불러오지 못했습니다.");
      }

      inquiries = (data || []).map(mapInquiry);
      renderList();
    } catch (error) {
      if (
        String(error.message).indexOf("JWT") !== -1 ||
        String(error.message).indexOf("session") !== -1 ||
        String(error.message).indexOf("인증") !== -1
      ) {
        await supabase.auth.signOut();
        showLogin();
        setLoginError("로그인이 만료되었습니다. 다시 로그인하세요.");
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
      await deleteInquiry(activeInquiry.id);
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
      await updateInquiry(activeInquiry.id, {
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

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) return;

    loginBtn.disabled = true;
    loginBtn.textContent = "로그인 중...";

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        throw new Error(error.message || "로그인에 실패했습니다.");
      }

      const entered = await enterAdminApp();
      if (!entered) {
        emailInput.value = "";
        passwordInput.value = "";
      } else {
        setLoginError("");
      }
    } catch (error) {
      showLogin();
      setLoginError(error.message || "로그인에 실패했습니다.");
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "로그인";
    }
  });

  logoutBtn.addEventListener("click", async function () {
    if (window.SorenAdminAuth) {
      window.SorenAdminAuth.clearAccessCache();
    }
    await supabase.auth.signOut();
    emailInput.value = "";
    passwordInput.value = "";
    showLogin();
  });

  refreshBtn.addEventListener("click", refreshActivePanel);
  statusFilter.addEventListener("change", renderList);

  adminTabs.forEach(function (tab) {
    tab.addEventListener("click", async function () {
      const tabName = tab.dataset.adminTab;
      if (!tabName || tab.hidden || tabName === activeAdminTab) return;
      setActiveTab(tabName);
      await refreshActivePanel();
    });
  });
  saveInquiryBtn.addEventListener("click", saveInquiry);
  if (deleteInquiryBtn) {
    deleteInquiryBtn.addEventListener("click", deleteInquiryFromModal);
  }

  document.querySelectorAll("[data-close-modal]").forEach(function (el) {
    el.addEventListener("click", closeDetail);
  });

  supabase.auth.getSession().then(async function (result) {
    if (result.data.session) {
      await enterAdminApp();
    } else {
      showLogin();
    }
  });

  supabase.auth.onAuthStateChange(async function (_event, session) {
    if (!session) {
      if (window.SorenAdminAuth) {
        window.SorenAdminAuth.clearAccessCache();
      }
      showLogin();
      return;
    }

    const access =
      window.SorenAdminAuth && (await window.SorenAdminAuth.loadAccess(true));
    if (!access || !access.ok) {
      showLogin();
      setLoginError("관리자 계정만 접속할 수 있습니다.");
      return;
    }

    applyAccessUI(access);
  });
})();
