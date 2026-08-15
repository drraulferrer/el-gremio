-- Migración 008 · índices que faltaban para las consultas reales.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- Honestidad primero: con cuatro personas y unos cientos de filas,
-- Postgres resuelve estas consultas escaneando la tabla en menos de un
-- milisegundo, así que esto NO arregla ninguna lentitud de hoy. Es
-- seguro barato: el día que haya dos años de historial, la consulta que
-- pide las últimas 400 misiones ordenadas por fecha ya no querrá leerlo
-- todo para tirar el 95 %.
--
-- Cada índice se corresponde con una consulta concreta de src/App.jsx.

-- .from('completions').eq('family_id').order('requested_at', desc).limit(400)
create index if not exists idx_completions_family_fecha
  on public.completions (family_id, requested_at desc);

-- .from('redemptions').eq('family_id').order('requested_at', desc).limit(200)
create index if not exists idx_redemptions_family_fecha
  on public.redemptions (family_id, requested_at desc);

-- .from('rewards').eq('family_id').order('created_at')
create index if not exists idx_rewards_family
  on public.rewards (family_id, created_at);

-- .from('profile_badges').eq('family_id')
create index if not exists idx_badges_family
  on public.profile_badges (family_id);

-- .from('family_goals').eq('family_id').eq('achieved', false).order('starts_at', desc).limit(1)
create index if not exists idx_goals_family_activa
  on public.family_goals (family_id, achieved, starts_at desc);
