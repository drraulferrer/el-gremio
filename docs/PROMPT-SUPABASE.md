# Crear el backend en Supabase con un asistente de navegador

Instrucciones pensadas para pegárselas a Claude en el navegador (extensión
de Chrome o claude.ai con navegación) y que ejecute la puesta en marcha del
proyecto de Supabase.

## Antes de pegar nada

1. **Inicia sesión tú en Supabase.** El asistente no debe crear cuentas ni
   teclear contraseñas: hazlo tú primero y déjale la sesión abierta.
2. **Ten a mano tu gestor de contraseñas** para guardar la contraseña de la
   base de datos que Supabase genera al crear el proyecto.
3. La clave que necesitamos es la **pública** (`anon` / `publishable`). La
   `service_role` (o `secret`) **no sale del panel jamás**: se salta toda la
   seguridad por filas.

## El prompt

```
Necesito que me ayudes a poner en marcha el backend de una webapp familiar
en Supabase. Ya tengo la sesión iniciada en supabase.com.

Reglas importantes:
- No crees cuentas ni introduzcas contraseñas en ningún formulario. Si algo
  requiere autenticarse, párate y avísame.
- Al final necesito que me des DOS valores: la Project URL y la clave
  pública (aparece como "anon public" o, en la interfaz nueva, como
  "publishable key", empieza por sb_publishable_).
- NO me copies ni me muestres la clave "service_role" ni la "secret". Si te
  la encuentras, ignórala y dímelo.
- Antes de cada acción que modifique algo, dime qué vas a hacer.

PASO 1 · Crear el proyecto
Ve a https://supabase.com/dashboard y crea un proyecto nuevo:
- Nombre: el-gremio
- Región: la más cercana a España (eu-west-3, París, o eu-central-1)
- Plan: Free
Supabase generará una contraseña para la base de datos: enséñamela para
que la guarde y no la escribas en ningún otro sitio.
Espera a que el proyecto termine de aprovisionarse (1-2 minutos).

PASO 2 · Cargar el esquema
Abre https://raw.githubusercontent.com/drraulferrer/el-gremio/main/schema.sql
y copia TODO el contenido del fichero.
Vuelve al proyecto, entra en "SQL Editor" y crea una consulta nueva.
Pega el contenido completo y pulsa "Run".
Debe terminar con "Success. No rows returned". Si sale cualquier error,
párate y pégame el mensaje literal.

PASO 3 · Comprobar que ha funcionado
En el SQL Editor, ejecuta esta consulta y enséñame el resultado:

  select table_name from information_schema.tables
  where table_schema = 'public' order by table_name;

Tienen que aparecer exactamente estas 10 tablas: app_logs, challenges,
completions, families, family_goals, profile_badges, profiles,
rate_limits, redemptions, rewards.

Después ejecuta esta otra y enséñame la respuesta:

  select public.health();

Debe devolver un JSON con "status": "ok".

PASO 4 · Activar el acceso por email
Ve a "Authentication" → "Sign In / Providers" → "Email".
- Asegúrate de que el proveedor Email está activado.
- DESACTIVA la opción "Confirm email".
Guarda los cambios y confírmame que ha quedado así. Este paso es
importante: si queda activado, la primera cuenta se queda esperando un
correo de confirmación que nadie va a abrir.

PASO 5 · Darme las credenciales
Ve a "Project Settings" → "API" (en la interfaz nueva puede llamarse
"API Keys") y dame:
- Project URL (algo como https://xxxxxxxx.supabase.co)
- La clave pública: "anon public" o "publishable key"

Recuerda: la service_role / secret NO.
```

## Cuando termine

Pásame esos dos valores. Yo relleno el `.env`, compruebo la conexión con
`npm run health`, vuelvo a desplegar y ya se puede fundar el gremio desde
el móvil.

## Si el asistente se atasca

Los tres puntos donde suele fallar:

- **El proyecto tarda en aprovisionarse.** Si el SQL Editor da errores raros
  nada más crear el proyecto, espera un minuto y repite el paso 2.
- **La interfaz de las claves cambió.** Supabase migró de `anon`/`service_role`
  a `publishable`/`secret`. Sirve cualquiera de las dos públicas.
- **"Confirm email" está en otro sitio.** Según la versión, la opción aparece
  bajo *Authentication → Providers → Email* o bajo *Authentication → Settings*.

Si prefieres hacerlo a mano, los mismos pasos están resumidos en el
[README](../README.md#1-supabase-backend).
