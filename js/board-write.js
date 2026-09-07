(function () {
  const supabase = window.SorenSupabase;
  const board = window.SorenBoard;
  const params = new URLSearchParams(window.location.search);
  const editId = params.get("id");
  const pageTitle = document.getElementById("pageTitle");
  const postForm = document.getElementById("postForm");
  const formMessage = document.getElementById("formMessage");
  const savePostBtn = document.getElementById("savePostBtn");

  if (!supabase || !board || !postForm) return;

  let currentUser = null;

  async function loadPostForEdit() {
    if (!editId) return;

    pageTitle.textContent = "글 수정";
    savePostBtn.textContent = "수정";

    const { data, error } = await supabase
      .from("board_posts")
      .select("id,title,content,author_id")
      .eq("id", editId)
      .maybeSingle();

    if (error || !data) {
      board.setMessage(formMessage, "수정할 글을 불러오지 못했습니다.", "error");
      return;
    }

    if (data.author_id !== currentUser.id) {
      window.location.href = "board-view.html?id=" + encodeURIComponent(editId);
      return;
    }

    postForm.title.value = data.title;
    postForm.content.value = data.content;
  }

  postForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    board.setMessage(formMessage, "");

    const payload = {
      title: postForm.title.value.trim(),
      content: postForm.content.value.trim(),
    };

    if (!payload.title || !payload.content) {
      board.setMessage(formMessage, "제목과 내용을 입력하세요.", "error");
      return;
    }

    savePostBtn.disabled = true;
    savePostBtn.textContent = "저장 중...";

    try {
      if (editId) {
        const { error } = await supabase
          .from("board_posts")
          .update(payload)
          .eq("id", editId)
          .eq("author_id", currentUser.id);
        if (error) throw error;
        window.location.href = "board-view.html?id=" + encodeURIComponent(editId);
        return;
      }

      const { data, error } = await supabase
        .from("board_posts")
        .insert(Object.assign({}, payload, { author_id: currentUser.id }))
        .select("id")
        .single();

      if (error) throw error;
      window.location.href = "board-view.html?id=" + encodeURIComponent(data.id);
    } catch (error) {
      board.setMessage(formMessage, error.message || "저장에 실패했습니다.", "error");
      savePostBtn.disabled = false;
      savePostBtn.textContent = editId ? "수정" : "등록";
    }
  });

  const nextPath = editId
    ? "board-write.html?id=" + encodeURIComponent(editId)
    : "board-write.html";

  board.requireSession(supabase, nextPath).then(async function (session) {
    if (!session) return;
    currentUser = session.user;
    await board.ensureProfile(supabase, session.user);
    await loadPostForEdit();
  });

  supabase.auth.onAuthStateChange(function (_event, session) {
    if (!session) {
      board.redirectToLogin(nextPath);
    }
  });
})();
