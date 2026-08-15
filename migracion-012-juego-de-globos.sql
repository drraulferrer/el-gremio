-- Migración 012 · premio intermedio: el juego de globos.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- Qué añade: cuando la peque lleva la MITAD de las misiones de hoy, se le
-- abre un juego de globos. Reventarlos le da una estrella extra, una vez
-- al día.
--
-- Por qué la mitad y no el pleno: a los tres años el premio tiene que
-- llegar antes de que se acabe la gasolina. Exigir las seis misiones
-- convierte cualquier día regular en un cero, y un cero repetido apaga el
-- sistema entero.
--
-- POR QUÉ ESTO VIVE EN POSTGRES Y NO EN EL NAVEGADOR. El tope no es una
-- medida antifraude —nadie va a hacer trampas a una niña de tres años—,
-- es una cuestión de corrección: si el «ya jugó hoy» viviera en el estado
-- de React o en localStorage, recargar la página daría globos infinitos, y
-- jugar desde la tablet y desde el móvil daría dos estrellas. El índice
-- único de abajo lo hace imposible en el único sitio que las dos
-- pantallas comparten.
--
-- El corte del día es la fecha civil de Madrid, para que coincida con el
-- `dayKey` del cliente, que usa la hora local del dispositivo. Si algún
-- día la familia se muda de huso, esto hay que cambiarlo aquí.

create table if not exists public.bonuses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  dia date not null default (now() at time zone 'Europe/Madrid')::date,
  tipo text not null default 'globos',
  coins integer not null default 5,
  created_at timestamptz not null default now(),
  -- Una por persona, día y tipo. Esta línea ES el tope: no hay forma de
  -- pedir dos aunque se recargue, se cambie de dispositivo o se pulse
  -- dos veces seguidas.
  unique (profile_id, dia, tipo)
);

create index if not exists idx_bonuses_family_dia on public.bonuses (family_id, dia desc);

alter table public.bonuses enable row level security;

drop policy if exists bonuses_lectura on public.bonuses;
create policy bonuses_lectura on public.bonuses
  for select using (family_id in (select id from public.families where owner = auth.uid()));

-- Sin política de insert a propósito: solo entra por la función de abajo,
-- que es `security definer`. Así el navegador no puede regalarse monedas
-- escribiendo directamente en la tabla.

do $$ begin alter publication supabase_realtime add table public.bonuses; exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------------
-- La función. Devuelve texto, como el resto de RPC del proyecto:
--   'ok'         → concedido, monedas abonadas
--   'ya_hoy'     → ya lo cobró hoy; NO es un error, es el caso normal
--   'no_existe'  → perfil inexistente o retirado
--   'no_es_tuyo' → el perfil no es de la familia de quien llama
-- ------------------------------------------------------------------

create or replace function public.grant_daily_bonus(p_id uuid, p_tipo text default 'globos')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid;
  v_coins integer := 5;   -- una estrella exacta (MONEDAS_POR_ESTRELLA)
begin
  select family_id into v_family
    from public.profiles
   where id = p_id and active;

  if v_family is null then
    return 'no_existe';
  end if;

  if not exists (
    select 1 from public.families f
     where f.id = v_family and f.owner = auth.uid()
  ) then
    return 'no_es_tuyo';
  end if;

  -- La carrera se resuelve aquí: dos toques simultáneos entran los dos al
  -- insert y uno se lleva la violación de unicidad. Sin esto, comprobar
  -- antes con un select y luego insertar dejaría la ventana abierta.
  begin
    insert into public.bonuses (family_id, profile_id, tipo, coins)
    values (v_family, p_id, p_tipo, v_coins);
  exception when unique_violation then
    return 'ya_hoy';
  end;

  update public.profiles
     set coins = coins + v_coins
   where id = p_id;

  return 'ok';
end $$;

revoke all on function public.grant_daily_bonus(uuid, text) from public;
grant execute on function public.grant_daily_bonus(uuid, text) to authenticated;

-- Comprobación:
--
-- select p.name, b.dia, b.tipo, b.coins
--   from public.bonuses b join public.profiles p on p.id = b.profile_id
--  order by b.created_at desc;
