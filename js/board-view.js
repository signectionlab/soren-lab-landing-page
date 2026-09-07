(function () {
  const supabase = window.SorenSupabase;
  const board = window.SorenBoard;
  const params = new URLSearchParams(window.location.search);
  const postId = params.get("id");
  const boardMessage = document.getElementById("boardMessage");
  const postTitle = document.getElementById("postTitle");
  const postMeta = document.getElementById("postMeta");
  const postBody = document.getElementById("postBody");
  const replySection = document.getElementById("replySection");
  const replyList = document.getElementById("replyList");
  const postActions = document.getElementById("postActions");
  const editBtn = document.getElementById("editPostBtn");
  const deleteBtn = document.getElementById("deletePostBtn");

  if (!supabase || !board) return;

  if (!postId || !postTitle) {
    window.location.href = "board.html";
    return;
  }

  let currentUser = null;
  let currentPost = null;

  async function loadPost() {
    board.setMessage(boardMessage, "");

    const { data, error } = await supabase
      .from("board_posts")
      .select("id,title,content,author_id,created_at,profiles(display_name,email)")
      .eq("id", postId)
      .maybeSingle();

    if (error) {
      board.setMessage(boardMessage, error.message || "게시글을 불러오지 못했습니다.", "error");
      return;
    }

    if (!data) {
      board.setMessage(boardMessage, "게시글을 찾을 수 없습니다.", "error");
      return;
    }

    currentPost = data;
    postTitle.textContent = data.title;
    postMeta.textContent =
      board.getAuthorLabel(data) + " · " + board.formatDate(data.created_at);
    postBody.textContent = data.content;

    const isOwner = currentUser && data.author_id === currentUser.id;
    postActions.hidden = !isOwner;
    await loadReplies();
  }

  async function loadReplies() {
    if (!replyList || !replySection) return;

    const { data, error } = await supabase
      .from("board_replies")
      .select("id,content,created_at,profiles(display_name,email,is_admin)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      board.setMessage(boardMessage, error.message || "답글을 불러오지 못했습니다.", "error");
      return;
    }

    const replies = data || [];
    replySection.hidden = replies.length === 0;
    replyList.innerHTML = "";

    replies.forEach(function (reply) {
      const profile = reply.profiles || {};
      const author = profile.email || profile.display_name || "관리자";
      const article = document.createElement("article");
      article.className = "board-reply";

      article.innerHTML =
        (profile.is_admin ? '<span class="board-reply__badge">Admin Reply</span>' : "") +
        '<p class="board-reply__meta">' +
        board.escapeHtml(author) +
        " · " +
        board.escapeHtml(board.formatDate(reply.created_at)) +
        "</p>" +
        '<p class="board-reply__content">' +
        board.escapeHtml(reply.content) +
        "</p>";

      replyList.appendChild(article);
    });
  }

  deleteBtn.addEventListener("click", async function () {
    const confirmed = confirm("이 글을 삭제할까요? 삭제 후 복구할 수 없습니다.");
    if (!confirmed) return;

    const { error } = await supabase.from("board_posts").delete().eq("id", postId);
    if (error) {
      board.setMessage(boardMessage, error.message || "삭제에 실패했습니다.", "error");
      return;
    }

    window.location.href = "board.html";
  });

  editBtn.addEventListener("click", function () {
    window.location.href = "board-write.html?id=" + encodeURIComponent(postId);
  });

  board.requireSession(supabase, "board-view.html?id=" + encodeURIComponent(postId)).then(
    async function (session) {
      if (!session) return;
      currentUser = session.user;
      await board.ensureProfile(supabase, session.user);
      await loadPost();
    }
  );

  supabase.auth.onAuthStateChange(function (_event, session) {
    if (!session) {
      board.redirectToLogin("board-view.html?id=" + encodeURIComponent(postId));
    }
  });
})();
