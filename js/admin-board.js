(function () {
  const supabase = window.SorenSupabase;
  if (!supabase) return;

  const boardPanel = document.getElementById("boardPanel");
  const boardTableBody = document.getElementById("boardTableBody");
  const boardList = document.getElementById("boardList");
  const boardCount = document.getElementById("boardCount");
  const boardLoadingState = document.getElementById("boardLoadingState");
  const boardEmptyState = document.getElementById("boardEmptyState");
  const boardLoadError = document.getElementById("boardLoadError");
  const boardModal = document.getElementById("boardModal");
  const boardModalBody = document.getElementById("boardModalBody");
  const boardModalTitle = document.getElementById("boardModalTitle");
  const saveReplyBtn = document.getElementById("saveReplyBtn");
  const deletePostBtn = document.getElementById("deletePostBtn");

  if (!boardPanel || !boardTableBody) return;

  let boardPosts = [];
  let activePost = null;
  let activeReplies = [];

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

  function getAuthorLabel(post) {
    const profile = post.profiles || {};
    return profile.email || profile.display_name || "회원";
  }

  function setBoardLoadError(message) {
    if (!boardLoadError) return;
    boardLoadError.hidden = !message;
    boardLoadError.textContent = message || "";
  }

  function renderBoardList() {
    boardCount.textContent = "게시글 " + boardPosts.length + "건";
    boardTableBody.innerHTML = "";

    if (!boardPosts.length) {
      boardList.hidden = true;
      boardEmptyState.hidden = false;
      return;
    }

    boardEmptyState.hidden = true;
    boardList.hidden = false;

    boardPosts.forEach(function (post) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "admin-table__row";
      row.dataset.id = post.id;

      const titleCell = document.createElement("span");
      titleCell.className = "admin-table__col admin-table__col--title";
      titleCell.textContent = post.title || "(제목 없음)";

      const authorCell = document.createElement("span");
      authorCell.className = "admin-table__col admin-table__col--author";
      authorCell.textContent = getAuthorLabel(post);

      const dateCell = document.createElement("span");
      dateCell.className = "admin-table__col admin-table__col--date";
      dateCell.textContent = formatDate(post.created_at);

      row.appendChild(titleCell);
      row.appendChild(authorCell);
      row.appendChild(dateCell);
      row.addEventListener("click", function () {
        openBoardDetail(post);
      });

      boardTableBody.appendChild(row);
    });
  }

  function renderRepliesHtml(replies) {
    if (!replies.length) {
      return '<p class="admin-board-replies__empty">등록된 답글이 없습니다.</p>';
    }

    return replies
      .map(function (reply) {
        const profile = reply.profiles || {};
        const author = profile.email || profile.display_name || "관리자";
        return (
          '<article class="admin-board-reply">' +
          '<div class="admin-board-reply__meta">' +
          escapeHtml(author) +
          " · " +
          escapeHtml(formatDate(reply.created_at)) +
          "</div>" +
          '<div class="admin-board-reply__content">' +
          escapeHtml(reply.content) +
          "</div></article>"
        );
      })
      .join("");
  }

  async function loadReplies(postId) {
    const { data, error } = await supabase
      .from("board_replies")
      .select("id,content,created_at,author_id,profiles(display_name,email,is_admin)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message || "답글을 불러오지 못했습니다.");
    }

    activeReplies = data || [];
    return activeReplies;
  }

  async function openBoardDetail(post) {
    activePost = post;
    boardModalTitle.textContent = post.title || "게시글 상세";

    try {
      activeReplies = await loadReplies(post.id);
    } catch (error) {
      alert(error.message);
      activeReplies = [];
    }

    boardModalBody.innerHTML =
      '<div class="admin-detail-grid">' +
      '<div class="admin-detail-item"><span class="admin-detail-item__label">작성자</span><div class="admin-detail-item__value">' +
      escapeHtml(getAuthorLabel(post)) +
      "</div></div>" +
      '<div class="admin-detail-item"><span class="admin-detail-item__label">작성일</span><div class="admin-detail-item__value">' +
      escapeHtml(formatDate(post.created_at)) +
      "</div></div>" +
      '<div class="admin-detail-item admin-detail-grid__full"><span class="admin-detail-item__label">내용</span><div class="admin-detail-item__value admin-detail-message">' +
      escapeHtml(post.content) +
      "</div></div></div>" +
      '<div class="admin-board-replies">' +
      '<h3 class="admin-board-replies__title">답글</h3>' +
      '<div class="admin-board-replies__list">' +
      renderRepliesHtml(activeReplies) +
      "</div>" +
      '<label class="admin-field admin-field--with-ai">' +
      '<span class="admin-field__head">' +
      '<span class="admin-field__label">답글 작성</span>' +
      '<button type="button" class="admin-ai-btn" id="boardAiBtn">AI</button>' +
      "</span>" +
      '<textarea id="boardReplyInput" rows="4" placeholder="회원 게시글에 대한 답글을 입력하세요."></textarea></label></div>';

    boardModal.hidden = false;
    boardModal.setAttribute("aria-hidden", "false");

    bindBoardAiButton(post);
  }

  function bindBoardAiButton(post) {
    const aiBtn = document.getElementById("boardAiBtn");
    const replyInput = document.getElementById("boardReplyInput");

    if (!aiBtn || !replyInput || !window.SorenAdminAI) return;

    aiBtn.addEventListener("click", function () {
      window.SorenAdminAI.runButton(aiBtn, replyInput, function () {
        return {
          type: "board_reply",
          data: {
            title: post.title,
            author: getAuthorLabel(post),
            content: post.content,
            existingReplies: activeReplies.map(function (reply) {
              return reply.content || "";
            }),
          },
        };
      });
    });
  }

  function closeBoardDetail() {
    boardModal.hidden = true;
    boardModal.setAttribute("aria-hidden", "true");
    activePost = null;
    activeReplies = [];
  }

  async function loadBoardPosts() {
    setBoardLoadError("");
    boardLoadingState.hidden = false;
    boardList.hidden = true;
    boardEmptyState.hidden = true;

    try {
      const { data, error } = await supabase
        .from("board_posts")
        .select("id,title,content,author_id,created_at,profiles(display_name,email)")
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message || "게시글 목록을 불러오지 못했습니다.");
      }

      boardPosts = data || [];
      renderBoardList();
    } catch (error) {
      setBoardLoadError(error.message);
    } finally {
      boardLoadingState.hidden = true;
    }
  }

  async function saveReply() {
    if (!activePost) return;

    const replyInput = document.getElementById("boardReplyInput");
    if (!replyInput) return;

    const content = replyInput.value.trim();
    if (!content) {
      alert("답글 내용을 입력하세요.");
      return;
    }

    saveReplyBtn.disabled = true;
    saveReplyBtn.textContent = "등록 중...";

    try {
      const sessionResult = await supabase.auth.getSession();
      const session = sessionResult.data && sessionResult.data.session;
      if (!session) {
        throw new Error("로그인이 필요합니다.");
      }

      const { error } = await supabase.from("board_replies").insert({
        post_id: activePost.id,
        author_id: session.user.id,
        content: content,
      });

      if (error) {
        throw new Error(error.message || "답글 등록에 실패했습니다.");
      }

      await openBoardDetail(activePost);
    } catch (error) {
      alert(error.message);
    } finally {
      saveReplyBtn.disabled = false;
      saveReplyBtn.textContent = "답글 등록";
    }
  }

  async function deletePost() {
    if (!activePost) return;

    const confirmed = confirm(
      '"' + (activePost.title || "게시글") + '"을(를) 삭제할까요?\n삭제 후 복구할 수 없습니다.'
    );
    if (!confirmed) return;

    deletePostBtn.disabled = true;
    deletePostBtn.textContent = "삭제 중...";

    try {
      const { error } = await supabase.from("board_posts").delete().eq("id", activePost.id);
      if (error) {
        throw new Error(error.message || "삭제에 실패했습니다.");
      }

      closeBoardDetail();
      await loadBoardPosts();
    } catch (error) {
      alert(error.message);
    } finally {
      deletePostBtn.disabled = false;
      deletePostBtn.textContent = "게시글 삭제";
    }
  }

  saveReplyBtn.addEventListener("click", saveReply);
  deletePostBtn.addEventListener("click", deletePost);

  boardModal.querySelectorAll("[data-close-board-modal]").forEach(function (el) {
    el.addEventListener("click", closeBoardDetail);
  });

  window.SorenAdminBoard = {
    loadBoardPosts: loadBoardPosts,
  };
})();
