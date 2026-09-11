-- Aventura con Game Master IA: Fase 3 (personaje persistente). Ejecuta
-- esto en Supabase → SQL Editor. Independiente de gmrpg-setup.sql /
-- gmrpg-setup-fase2.sql: esta tabla guarda el personaje ÚNICO de cada
-- cuenta (se crea una sola vez, no en cada partida), y las partidas
-- siguen viviendo en gmrpg_games como siempre — al empezar una
-- partida se copia aquí una foto del personaje (nombre/raza/
-- atributos no cambian a mitad de aventura); al terminarla, se
-- escribe de vuelta el inventario conseguido y la vida se repone al
-- máximo para la siguiente aventura.

create table if not exists public.rpg_characters (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  raza text not null,
  atributos jsonb not null,             -- {fuerza,astucia,coraje}, fijos desde la creación
  vida_max int not null default 3,
  inventario jsonb not null default '[]'::jsonb,  -- persiste entre partidas (antes se perdía al terminar cada una)
  race_changes int not null default 0,  -- cuántas veces se ha usado la Poción de Metamorfosis
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rpg_characters enable row level security;

-- Solo hace falta acceso a la propia fila: en modo grupo, cada
-- jugador lee SU PROPIO personaje al aceptar una invitación y lo
-- escribe en el "grupo" compartido — nadie necesita leer el
-- personaje de otra persona directamente.
drop policy if exists "rpg_characters select own" on public.rpg_characters;
create policy "rpg_characters select own" on public.rpg_characters
  for select using (auth.uid() = user_id);

drop policy if exists "rpg_characters insert own" on public.rpg_characters;
create policy "rpg_characters insert own" on public.rpg_characters
  for insert with check (auth.uid() = user_id);

drop policy if exists "rpg_characters update own" on public.rpg_characters;
create policy "rpg_characters update own" on public.rpg_characters
  for update using (auth.uid() = user_id);
