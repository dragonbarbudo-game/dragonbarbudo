-- Parchís: tabla para las partidas online (con amigos, o amigos + bots).
-- Ejecuta esto en Supabase → SQL Editor. El modo "Jugar con Bots" (tú
-- contra 3 bots) NO usa esta tabla: es 100% local, como el de Conecta 4.

create table if not exists public.parchis_games (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  players jsonb not null,        -- array de 4 plazas: {color,type,user_id,name}
  pieces jsonb not null,         -- {red:[..4],green:[..4],yellow:[..4],blue:[..4]}
  turn int not null default 0,
  dice int,
  status text not null default 'waiting', -- 'waiting' | 'starting' | 'active' | 'finished'
  start_rolls jsonb,             -- tirada inicial (quién empieza): [n,n,n,n] o null
  winner_color text,
  bot_difficulty text not null default 'normal', -- 'easy' | 'normal' | 'hard'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.parchis_games enable row level security;

-- Solo puede ver/actualizar la partida quien de verdad juega en ella
-- (aparece con su user_id en el array "players").
drop policy if exists "parchis select participants" on public.parchis_games;
create policy "parchis select participants" on public.parchis_games
  for select using (
    exists (
      select 1 from jsonb_array_elements(players) as p
      where (p->>'user_id')::uuid = auth.uid()
    )
  );

drop policy if exists "parchis insert own" on public.parchis_games;
create policy "parchis insert own" on public.parchis_games
  for insert with check (auth.uid() = created_by);

drop policy if exists "parchis update participants" on public.parchis_games;
create policy "parchis update participants" on public.parchis_games
  for update using (
    exists (
      select 1 from jsonb_array_elements(players) as p
      where (p->>'user_id')::uuid = auth.uid()
    )
  );

-- Para que los cambios (nuevo dado, ficha movida, jugador que se une...)
-- lleguen al instante a todos vía Realtime, igual que connect4_games.
alter publication supabase_realtime add table public.parchis_games;
