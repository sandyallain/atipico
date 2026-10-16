-- Postgres donne EXECUTE à PUBLIC par défaut : on réserve les fonctions aux membres connectés.
revoke execute on function is_blocked(uuid, uuid), can_message(uuid, uuid), join_event(uuid), leave_event(uuid) from public, anon;
grant execute on function is_blocked(uuid, uuid), can_message(uuid, uuid), join_event(uuid), leave_event(uuid) to authenticated;
