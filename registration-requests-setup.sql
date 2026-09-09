-- Cierre del registro público: la tabla donde se guardan las solicitudes
-- de gente que quiere unirse a DragonBarbudo, a la espera de que el
-- admin las apruebe o las rechace a mano. Ejecuta esto en Supabase →
-- SQL Editor.

create table if not exists public.registration_requests (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  email text not null,
  status text not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  created_at timestamptz not null default now()
);

-- RLS activado y SIN policies a propósito: nadie puede leer ni escribir
-- aquí con la clave anon/pública. Todo pasa por dos Cloudflare Functions
-- que usan la service_role key (que se salta RLS):
--   /api/request-registration        → cualquiera puede pedir una cuenta
--   /api/admin/registration-requests → solo el admin, lista/aprueba/rechaza
alter table public.registration_requests enable row level security;

-- ══════════════════════════════════════════════════════════════════
-- IMPORTANTE, además de ejecutar esto: cierra el registro público de
-- verdad en Supabase → Authentication → Sign In / Providers → Email,
-- desactivando "Allow new users to sign up". Mientras esté desactivado,
-- la única forma de crear una cuenta es que el admin apruebe una
-- solicitud desde el Panel de Admin (eso invita a esa persona por
-- correo, sin pasar por el registro público).
-- ══════════════════════════════════════════════════════════════════
