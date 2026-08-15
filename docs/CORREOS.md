# Los correos del gremio

Las tres plantillas que la app dispara de verdad, listas para pegar en
Supabase → Authentication → Emails → Templates.

**Ojo con el orden**: Supabase **no deja editar las plantillas hasta que
haya SMTP propio configurado**. Sin SMTP se envían las suyas, en inglés y
sin tocar. Por eso este fichero existe: para que las plantillas estén
escritas y revisadas antes de que llegue el momento de pegarlas, que es un
minuto de trabajo.

## Qué se envía y qué no

De las cinco plantillas que ofrece Supabase, esta app solo dispara tres:

| Plantilla | ¿La usa El Gremio? | Cuándo |
|---|---|---|
| Confirm sign up | **Sí** | Al crear la cuenta familiar, si «Confirm email» está encendido |
| Reset password | **Sí** | Al pulsar «He olvidado la contraseña» |
| Change email address | **Sí** | Solo si alguien cambia el correo desde Supabase |
| Magic link or OTP | No | La app entra con contraseña, nunca con enlace mágico |
| Invite user | No | No hay invitaciones: una cuenta por familia |

Las dos últimas se dejan como están. Traducir una plantilla que nadie
dispara es trabajo que hay que mantener a cambio de nada.

## Decisiones de estas plantillas

- **Fondo claro, no el tablero nocturno de la app.** Gmail y Outlook
  invierten los colores en modo oscuro con criterios propios, y un correo
  oscuro sale de ahí con el texto ilegible más veces de las que sale bien.
  El oro de la app (`#f5b841`) se queda solo en el botón y el borde, que
  es donde aguanta la inversión.
- **Sin tipografías web.** Fredoka y Nunito no cargan en la mayoría de
  clientes de correo; forzarlas solo añade peso. Va la pila del sistema.
- **El enlace también va escrito en texto plano debajo del botón.** Hay
  clientes que no pintan el botón, y quien reenvía el correo a otro
  dispositivo necesita poder copiarlo.
- **Nada de género gramatical.** No sabemos quién abre el correo, así que
  las frases están escritas para no necesitar marca, igual que la forma
  neutra de `src/lib/genero.js`.
- **Se dice qué hacer si no fuiste tú.** Un correo de contraseña que no
  explica eso asusta más de lo que ayuda.
- **Caducidad explícita.** El enlace de Supabase dura una hora; callarlo
  hace que la gente lo abra al día siguiente y crea que la app falla.

---

## 1. Confirm sign up

**Subject:** `Confirma tu gremio`

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ec;padding:28px 12px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:18px;border-top:5px solid #f5b841;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <tr><td style="padding:32px 32px 8px;">
        <h1 style="margin:0;font-size:24px;color:#1e2140;">Ya casi está</h1>
        <p style="margin:16px 0 0;font-size:16px;line-height:1.55;color:#3d4275;">
          Alguien ha creado un gremio familiar con este correo. Confírmalo y podréis entrar todos.
        </p>
      </td></tr>
      <tr><td align="center" style="padding:24px 32px 8px;">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#f5b841;color:#1e2140;font-size:17px;font-weight:700;text-decoration:none;padding:14px 30px;border-radius:12px;">
          Confirmar el gremio
        </a>
      </td></tr>
      <tr><td style="padding:8px 32px 28px;">
        <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#6b70a0;">
          Si el botón no funciona, copia esta dirección en el navegador:<br>
          <span style="color:#3d4275;word-break:break-all;">{{ .ConfirmationURL }}</span>
        </p>
        <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#6b70a0;">
          El enlace caduca dentro de una hora. Si no has sido tú, no hagas nada: sin
          confirmar, el gremio no se crea.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

---

## 2. Reset password

**Subject:** `Tu contraseña del gremio`

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ec;padding:28px 12px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:18px;border-top:5px solid #f5b841;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <tr><td style="padding:32px 32px 8px;">
        <h1 style="margin:0;font-size:24px;color:#1e2140;">Contraseña nueva</h1>
        <p style="margin:16px 0 0;font-size:16px;line-height:1.55;color:#3d4275;">
          Has pedido cambiar la contraseña con la que entra tu gremio. Este enlace
          abre la pantalla para elegir una nueva.
        </p>
      </td></tr>
      <tr><td align="center" style="padding:24px 32px 8px;">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#f5b841;color:#1e2140;font-size:17px;font-weight:700;text-decoration:none;padding:14px 30px;border-radius:12px;">
          Elegir contraseña nueva
        </a>
      </td></tr>
      <tr><td style="padding:8px 32px 28px;">
        <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#6b70a0;">
          Si el botón no funciona, copia esta dirección en el navegador:<br>
          <span style="color:#3d4275;word-break:break-all;">{{ .ConfirmationURL }}</span>
        </p>
        <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#6b70a0;">
          El enlace caduca dentro de una hora y solo sirve una vez. Si no has pedido
          nada, ignora este correo: tu contraseña sigue siendo la de siempre.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

---

## 3. Change email address

**Subject:** `Confirma tu correo nuevo`

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ec;padding:28px 12px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:18px;border-top:5px solid #f5b841;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <tr><td style="padding:32px 32px 8px;">
        <h1 style="margin:0;font-size:24px;color:#1e2140;">Correo nuevo del gremio</h1>
        <p style="margin:16px 0 0;font-size:16px;line-height:1.55;color:#3d4275;">
          El gremio quiere pasar a entrar con <strong>{{ .NewEmail }}</strong>.
          Confírmalo desde aquí.
        </p>
      </td></tr>
      <tr><td align="center" style="padding:24px 32px 8px;">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#f5b841;color:#1e2140;font-size:17px;font-weight:700;text-decoration:none;padding:14px 30px;border-radius:12px;">
          Confirmar el cambio
        </a>
      </td></tr>
      <tr><td style="padding:8px 32px 28px;">
        <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#6b70a0;">
          Si el botón no funciona, copia esta dirección en el navegador:<br>
          <span style="color:#3d4275;word-break:break-all;">{{ .ConfirmationURL }}</span>
        </p>
        <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#6b70a0;">
          Si no has pedido este cambio, ignora el correo y avisa a quien administre
          el gremio: la dirección no cambia hasta que alguien pulse ese botón.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

---

## El SMTP: qué va en cada casilla

Proveedor elegido: **Resend** (3.000 correos/mes gratis, 100 al día).
Remitente: **noreply@raulferrer.org**, sobre un dominio que ya se controla.

En Resend, al añadir el dominio, te da tres registros DNS con sus valores
exactos —esos valores son de tu cuenta, no se pueden escribir de
antemano—. Los tipos son estos, y todos cuelgan de un **subdominio
`send.`** a propósito:

| Tipo | Nombre | Para qué |
|---|---|---|
| MX | `send.raulferrer.org` | Rebotes y quejas |
| TXT | `send.raulferrer.org` | SPF |
| TXT | `resend._domainkey.raulferrer.org` | DKIM (la firma) |
| TXT | `_dmarc.raulferrer.org` | DMARC, opcional pero recomendable (`v=DMARC1; p=none;`) |

**Lo del subdominio no es cosmético**: `raulferrer.org` ya envía correo
por su cuenta (el WordPress de Hostinger), y meter un segundo SPF en la
raíz rompe el que hay. Un dominio solo admite un registro SPF. Con
`send.` los dos conviven sin tocarse.

Los registros se crean en el panel de DNS de Hostinger y tardan entre
minutos y un par de horas en propagar. Hasta que Resend marque el dominio
como *verified*, los envíos fallan.

Con el dominio verificado, en Supabase → Authentication → Emails → SMTP
Settings, activar «Enable custom SMTP» y rellenar:

```
Sender email address     noreply@raulferrer.org
Sender name              El Gremio
Host                     smtp.resend.com
Port number              465
Minimum interval         60 segundos   (el que trae por defecto)
Username                 resend        ← literalmente esa palabra
Password                 la API key de Resend (re_...)
```

La contraseña **es** la API key, y Supabase no la vuelve a enseñar una vez
guardada. Guárdala en el llavero al crearla, no después.

Al activar SMTP propio, el tope de envío sube de un puñado de correos por
hora a **30/hora**, ajustable en Authentication → Rate Limits.

## Cómo se prueban

Con SMTP propio ya configurado, y en este orden:

1. **Contraseña**: en la app publicada, «He olvidado la contraseña». Tiene
   que llegar el correo, y su enlace tiene que abrir la pantalla de
   contraseña nueva, **no el tablero**. Si abre el tablero, lo que falla es
   la Redirect URL, no la plantilla.
2. **Alta**: solo cuando «Confirm email» esté encendido, y con un correo
   distinto del de la familia. Ojo: el alta de prueba crea un gremio de
   verdad; hay que borrarlo después, y desde la migración 017 una cuenta
   solo puede tener uno.

Si un correo no llega, mira antes que nada el tope de envío: Supabase lo
sube a **30 correos/hora** al activar SMTP propio, y se puede ajustar en
Authentication → Rate Limits.
