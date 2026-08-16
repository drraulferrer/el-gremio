# El captcha del registro

**Estado a 16-ago-2026: medio encendido.** El widget existe en Cloudflare
(«El Gremio», hostnames `elgremioapp.com`, `www.elgremioapp.com` y
`localhost`, modo Gestionado), la clave pública está en `.env` y
desplegada, y el recuadro aparece y resuelve en la app.

**Falta un paso, y es el único que no puede hacer un agente: pegar la
clave SECRETA en Supabase** (Authentication → Attack Protection →
proveedor Turnstile). Hasta que eso ocurra, el captcha se dibuja y
entrega su token, pero **nadie lo verifica**: la protección real la aplica
Supabase, no el navegador.

El código vive en `src/lib/captcha.js` y `src/components/Captcha.jsx`. Sin
`VITE_TURNSTILE_SITE_KEY` no dibuja nada y no carga ningún script de
terceros, que es como estuvo hasta hoy.

## Por qué hace falta

No es por «llenar la base». Es por el correo: **cada alta consume un
correo de confirmación del cupo de 30 por hora del proyecto**. Un script
que registre cuentas en bucle no rompe nada visible, deja a las familias
reales sin poder darse de alta durante horas, y sin ninguna señal de que
eso está pasando. El captcha es lo que hace que ese cupo lo gasten
personas.

## Los cuatro pasos

1. **Cuenta en Cloudflare** (gratis) → *Turnstile* → **Add widget**.
   - Nombre: `El Gremio`
   - Dominios: `elgremioapp.com` y `localhost` (el segundo, para poder
     probar en local sin desactivar nada).
   - Modo: **Managed**. Es el que resuelve solo en la mayoría de casos y
     únicamente muestra desafío cuando algo huele raro.

2. Te da dos claves:
   - **Site Key** (empieza por `0x4AAA…`) → es **pública**, va en el
     bundle. No protege nada por sí sola.
   - **Secret Key** → es la que verifica de verdad. Solo la ve Supabase.

3. **En Supabase** → *Authentication → Attack Protection* → «Enable
   Captcha protection» → proveedor **Turnstile** → pegar la **Secret
   Key** → *Save*.

4. **En el proyecto**, añadir la clave pública a `.env` y volver a
   desplegar:

   ```
   VITE_TURNSTILE_SITE_KEY=0x4AAA...
   ```

   ```bash
   npm run verify && npm run deploy
   ```

   Es una variable `VITE_`, así que **se compila dentro del bundle**: no
   basta con ponerla en `.env`, hay que volver a construir. Si se
   configura la clave secreta en Supabase y se olvida este paso, el
   registro se rompe: Supabase exigirá un token que el navegador no está
   mandando.

## El orden importa

**Primero el paso 4, después el 3.** Al revés hay una ventana —de minutos
u horas, lo que se tarde en desplegar— en la que Supabase exige captcha y
la app publicada todavía no lo dibuja: durante ese rato **nadie puede
registrarse ni recuperar su contraseña**, y el mensaje que verían es
«captcha protection: request disallowed», que no explica nada.

Desplegar primero la clave pública no rompe nada: mientras Supabase no lo
exija, el widget aparece, resuelve y su token se manda sin que nadie lo
mire.

## Qué pasa cuando ya está encendido

- El captcha se dibuja en las **tres** operaciones que Supabase protege:
  entrar, registrarse y pedir contraseña nueva. No solo en el alta.
- **El botón NO espera al token**, y es a propósito. Bloquearlo hasta
  tenerlo parece más limpio y es una trampa: el día que Cloudflare no
  cargue, nadie podría entrar, registrarse ni recuperar su contraseña, y
  sin un mensaje que lo explicara. Quien exige el captcha es Supabase, que
  rechaza la petición sin token válido; entonces sale un error concreto y
  se puede reintentar. (La primera versión de esta pantalla sí lo
  bloqueaba. Se cazó probándolo en el navegador, no leyendo el código.)
- El token es **de un solo uso**: cada intento fallido remonta el widget
  (`key={modo + intento}` en `Login.jsx`) para pedir uno nuevo. Sin eso, el
  segundo intento fallaría siempre y parecería un fallo de contraseña.
- Si Cloudflare no carga, la app **no bloquea a nadie**: sigue sin token y
  decide Supabase. Es preferible un alta rechazada con su mensaje a una
  pantalla que no responde.

## Para probarlo sin molestar a nadie

Cloudflare publica claves de prueba. Con esta en `.env` el widget siempre
da por bueno el desafío, así que sirve para comprobar que el recuadro
aparece, que el botón se desbloquea y que el token viaja:

```
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
```

Y la contraria, que **siempre falla**, sirve para ver el mensaje de error
que le saldría a una familia:

```
VITE_TURNSTILE_SITE_KEY=2x00000000000000000000AB
```

Ninguna de las dos vale en producción: son para desarrollo.
