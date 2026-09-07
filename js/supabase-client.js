(function () {
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error("Supabase JS SDK가 로드되지 않았습니다.");
  }

  if (
    !window.SUPABASE_URL ||
    window.SUPABASE_URL.indexOf("__SUPABASE_URL__") !== -1 ||
    !window.SUPABASE_ANON_KEY ||
    window.SUPABASE_ANON_KEY.indexOf("__SUPABASE_ANON_KEY__") !== -1
  ) {
    throw new Error(
      "Supabase 설정이 없습니다. node scripts/build-env.js 를 실행하세요."
    );
  }

  window.SorenSupabase = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY
  );
})();
