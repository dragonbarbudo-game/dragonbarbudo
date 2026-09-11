-- Aventura con Game Master IA: variedad de misiones + progresión tipo
-- "ir superando niveles". Migración aditiva sobre rpg-characters-setup.sql.
-- Ejecuta esto en Supabase → SQL Editor.

-- Cuántas misiones ha ganado el personaje — se muestra como "Misión N"
-- (la que está jugando ahora mismo es la nivel+1, ver index.html).
alter table public.rpg_characters add column if not exists nivel int not null default 1;

-- Id de la última misión jugada (gane o pierda): sirve para que la
-- Function evite repetir el mismo escenario/enemigos dos veces
-- seguidas — ver MISIONES / pickMision en functions/api/gmrpg/turn.js.
alter table public.rpg_characters add column if not exists ultima_mision_id int;
