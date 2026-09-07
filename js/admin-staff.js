(function () {
  const supabase = window.SorenSupabase;
  if (!supabase) return;

  const adminsPanel = document.getElementById("adminsPanel");
  const adminStaffList = document.getElementById("adminStaffList");
  const adminStaffLoading = document.getElementById("adminStaffLoading");
  const adminStaffEmpty = document.getElementById("adminStaffEmpty");
  const adminStaffError = document.getElementById("adminStaffError");
  const adminAssignForm = document.getElementById("adminAssignForm");
  const adminAssignEmail = document.getElementById("adminAssignEmail");
  const adminAssignRole = document.getElementById("adminAssignRole");
  const adminAssignMessage = document.getElementById("adminAssignMessage");

  if (!adminsPanel || !adminStaffList) return;

  const ROLE_LABELS = window.SorenAdminAuth ? window.SorenAdminAuth.ROLE_LABELS : {};

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStaffError(message) {
    if (!adminStaffError) return;
    adminStaffError.hidden = !message;
    adminStaffError.textContent = message || "";
  }

  function setAssignMessage(message, isError) {
    if (!adminAssignMessage) return;
    adminAssignMessage.hidden = !message;
    adminAssignMessage.textContent = message || "";
    adminAssignMessage.classList.toggle("admin-error", !!isError);
    adminAssignMessage.classList.toggle("admin-success", !isError && !!message);
  }

  function renderStaffRows(rows) {
    adminStaffList.innerHTML = "";

    rows.forEach(function (row) {
      const item = document.createElement("div");
      item.className = "admin-staff-row";

      item.innerHTML =
        '<div class="admin-staff-row__info">' +
        '<strong class="admin-staff-row__email">' +
        escapeHtml(row.email || "(이메일 없음)") +
        "</strong>" +
        '<span class="admin-staff-row__role">' +
        escapeHtml(ROLE_LABELS[row.admin_role] || row.admin_role) +
        "</span></div>" +
        '<label class="admin-staff-row__control">' +
        '<span class="admin-field__label">권한 변경</span>' +
        '<select data-staff-email="' +
        escapeHtml(row.email) +
        '">' +
        '<option value="super"' +
        (row.admin_role === "super" ? " selected" : "") +
        ">전체 관리자</option>" +
        '<option value="inquiries"' +
        (row.admin_role === "inquiries" ? " selected" : "") +
        ">문의 담당</option>" +
        '<option value="board"' +
        (row.admin_role === "board" ? " selected" : "") +
        ">게시판 담당</option>" +
        "</select></label>" +
        '<button type="button" class="admin-btn admin-btn--ghost admin-btn--sm" data-revoke-email="' +
        escapeHtml(row.email) +
        '">권한 해제</button>';

      adminStaffList.appendChild(item);
    });

    adminStaffList.querySelectorAll("[data-revoke-email]").forEach(function (button) {
      button.addEventListener("click", function () {
        assignRole(button.dataset.revokeEmail, "");
      });
    });

    adminStaffList.querySelectorAll("select[data-staff-email]").forEach(function (select) {
      select.addEventListener("change", function () {
        assignRole(select.dataset.staffEmail, select.value);
      });
    });
  }

  async function loadAdminStaff() {
    setStaffError("");
    adminStaffLoading.hidden = false;
    adminStaffEmpty.hidden = true;
    adminStaffList.innerHTML = "";

    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,display_name,admin_role")
      .not("admin_role", "is", null)
      .order("email", { ascending: true });

    adminStaffLoading.hidden = true;

    if (error) {
      setStaffError(error.message || "관리자 목록을 불러오지 못했습니다.");
      return;
    }

    const rows = (data || []).filter(function (row) {
      return row.admin_role;
    });

    if (!rows.length) {
      adminStaffEmpty.hidden = false;
      return;
    }

    renderStaffRows(rows);
  }

  async function assignRole(email, role) {
    if (!email) return;

    setAssignMessage("");

    const { error } = await supabase.rpc("admin_set_user_role", {
      p_email: email,
      p_role: role || null,
    });

    if (error) {
      setAssignMessage(error.message || "권한 변경에 실패했습니다.", true);
      return;
    }

    setAssignMessage(
      role ? "권한을 저장했습니다." : "관리자 권한을 해제했습니다.",
      false
    );
    await loadAdminStaff();
  }

  if (adminAssignForm) {
    adminAssignForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const email = adminAssignEmail.value.trim();
      const role = adminAssignRole.value;
      if (!email || !role) {
        setAssignMessage("이메일과 권한을 선택하세요.", true);
        return;
      }
      await assignRole(email, role);
      adminAssignForm.reset();
    });
  }

  window.SorenAdminStaff = {
    loadAdminStaff: loadAdminStaff,
  };
})();
