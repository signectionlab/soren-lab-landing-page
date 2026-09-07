-- 게시판 관리자가 모든 답글을 삭제할 수 있도록 정책 완화
-- Supabase SQL Editor에서 006 실행 후 적용하세요.

DROP POLICY IF EXISTS "admin_delete_board_replies" ON public.board_replies;

CREATE POLICY "admin_delete_board_replies"
  ON public.board_replies
  FOR DELETE
  TO authenticated
  USING (public.can_manage_board());
