-- game_invites.game_id es polimórfico: según la columna "game"
-- ('connect4' | 'parchis' | 'gmrpg'), apunta a una fila de una tabla
-- distinta (connect4_games / parchis_games / gmrpg_games). Postgres
-- no permite una clave foránea que apunte a "la tabla que toque" —
-- la que se creó (a mano, en el panel de Supabase) apuntaba fija a
-- connect4_games, así que cualquier invitación de Parchís o de la
-- Aventura con GM IA la incumplía. La integridad de "game_id" la
-- vigila el propio código de la app (siempre inserta un id real de
-- la tabla que corresponda a "game"), no hace falta la FK.
--
-- Ejecuta esto en Supabase → SQL Editor.

alter table public.game_invites drop constraint if exists game_invites_game_id_fkey;
