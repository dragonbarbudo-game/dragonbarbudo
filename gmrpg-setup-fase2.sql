-- Aventura con Game Master IA: Fase 2 (con amigos + autocompletado con
-- bots, 2-4 jugadores). Migración aditiva sobre gmrpg-setup.sql — se
-- puede ejecutar aunque ya haya partidas en solo guardadas, no las toca.
-- Ejecuta esto en Supabase → SQL Editor DESPUÉS de gmrpg-setup.sql.

alter table public.gmrpg_games add column if not exists mode text not null default 'solo'; -- 'solo' | 'grupo'
alter table public.gmrpg_games add column if not exists grupo jsonb;             -- array de miembros del grupo (null en modo solo)
alter table public.gmrpg_games add column if not exists orden_turno jsonb;       -- array de ids, orden fijo en el que actúa cada miembro
alter table public.gmrpg_games add column if not exists turno_actual text;      -- id de quien debe actuar en esta ronda
alter table public.gmrpg_games add column if not exists acciones_ronda jsonb not null default '{}'::jsonb; -- {id: accion_texto} recolectadas en la ronda en curso
alter table public.gmrpg_games add column if not exists bot_difficulty text not null default 'normal'; -- dificultad de los bots del grupo

-- RLS: en modo grupo hay varios participantes, no solo el creador
-- (user_id). Se sustituyen las políticas de la Fase 1 por una versión
-- que acepta cualquiera de los dos casos (jsonb_array_elements sobre
-- un "grupo" NULL —partidas en solo— no da error, simplemente no
-- aporta filas, así que la condición cae al auth.uid() = user_id).
drop policy if exists "gmrpg select own" on public.gmrpg_games;
drop policy if exists "gmrpg select participants" on public.gmrpg_games;
create policy "gmrpg select participants" on public.gmrpg_games
  for select using (
    auth.uid() = user_id
    or exists (select 1 from jsonb_array_elements(grupo) as p where (p->>'user_id')::uuid = auth.uid())
  );

drop policy if exists "gmrpg update own" on public.gmrpg_games;
drop policy if exists "gmrpg update participants" on public.gmrpg_games;
create policy "gmrpg update participants" on public.gmrpg_games
  for update using (
    auth.uid() = user_id
    or exists (select 1 from jsonb_array_elements(grupo) as p where (p->>'user_id')::uuid = auth.uid())
  );

-- "gmrpg insert own" (de gmrpg-setup.sql) se mantiene igual: solo quien
-- crea la partida inserta la fila, sea en solo o para hospedar un grupo.
