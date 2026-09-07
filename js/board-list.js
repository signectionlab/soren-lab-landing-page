(function () {
  const supabase = window.SorenSupabase;
  const board = window.SorenBoard;
  const postList = document.getElementById("postList");
  const emptyState = document.getElementById("emptyState");
  const boardMessage = document.getElementById("boardMessage");

  if (!supabase || !board || !postList) return;

  let posts = [];

  function renderPosts() {
    postList.innerHTML = "";
    emptyState.hidden = posts.length > 0;

    posts.forEach(function (post) {
      const item = document.createElement("article");
      item.className = "board-index__item";

      item.innerHTML =
        '<a class="board-index__link" href="board-view.html?id=' +
        encodeURIComponent(post.id) +
        '">' +
        board.escapeHtml(post.title) +
        "</a>" +
        '<p class="board-index__meta">' +
        board.escapeHtml(board.getAuthorLabel(post)) +
        " · " +
        board.escapeHtml(board.formatDate(post.created_at)) +
        "</p>";

      postList.appendChild(item);
    });
  }

  async function loadPosts() {
    board.setMessage(boardMessage, "");

    const { data, error } = await supabase
      .from("board_posts")
      .select("id,title,content,author_id,created_at,profiles(display_name,email)")
      .order("created_at", { ascending: false });

    if (error) {
      board.setMessage(boardMessage, error.message || "게시글을 불러오지 못했습니다.", "error");
      return;
    }

    posts = data || [];
    renderPosts();
  }

  board.requireSession(supabase, "board.html").then(async function (session) {
    if (!session) return;
    await board.ensureProfile(supabase, session.user);
    await loadPosts();
  });

  supabase.auth.onAuthStateChange(function (_event, session) {
    if (!session) {
      board.redirectToLogin("board.html");
    }
  });
})();
