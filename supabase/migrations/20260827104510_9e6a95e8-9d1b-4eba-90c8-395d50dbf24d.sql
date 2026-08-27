REVOKE EXECUTE ON FUNCTION public.accept_friend_request(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.friend_leaderboard() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.send_friend_request(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.friend_leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_request(text) TO authenticated;