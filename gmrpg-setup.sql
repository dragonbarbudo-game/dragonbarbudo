-- Aventura con Game Master IA (modo solo, Fase 1): tabla para guardar la
-- partida de cada jugador. Ejecuta esto en Supabase → SQL Editor.
-- A diferencia de parchis_games / connect4_games, esta partida es siempre
-- de un solo jugador: no hay array de "players", solo el propio user_id.

create table if not exists public.gmrpg_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  personaje jsonb not null,       -- {nombre, raza, vida, vida_max, atributos:{fuerza,astucia,coraje}, inventario:[]}
  mapa jsonb not null,            -- {escena_actual, combate_final, enemigos:[], objetos_visibles:[]}
  turno int not null default 1,
  turno_max int not null default 12,
  ultima_tirada jsonb,            -- {atributo_usado, dado, total, resultado, natural_especial}
  historial jsonb not null default '[]'::jsonb,  -- [{turno, narracion}] para el scroll de la partida
  status text not null default 'active',          -- 'active' | 'finished'
  resultado text,                                 -- null | 'victoria' | 'derrota'
  recompensa jsonb,                               -- {monedas} calculado por el cliente, nunca por el modelo
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gmrpg_games enable row level security;

-- Solo el propio jugador ve/edita su partida (single-player: sin array
-- de participantes como en parchis_games).
drop policy if exists "gmrpg select own" on public.gmrpg_games;
create policy "gmrpg select own" on public.gmrpg_games
  for select using (auth.uid() = user_id);

drop policy if exists "gmrpg insert own" on public.gmrpg_games;
create policy "gmrpg insert own" on public.gmrpg_games
  for insert with check (auth.uid() = user_id);

drop policy if exists "gmrpg update own" on public.gmrpg_games;
create policy "gmrpg update own" on public.gmrpg_games
  for update using (auth.uid() = user_id);

-- No es imprescindible en modo solo, pero se añade por si el jugador
-- tiene la partida abierta en dos pestañas a la vez.
alter publication supabase_realtime add table public.gmrpg_games;
