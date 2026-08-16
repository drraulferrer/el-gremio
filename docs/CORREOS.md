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

**Esto cambió el 16-ago y conviene saber por qué.** El plan era Resend
sobre un subdominio `send.raulferrer.org`, y la razón era que
`raulferrer.org` ya envía correo desde su WordPress: un dominio solo
admite UN registro SPF, así que meter un segundo en la raíz habría roto
el que había. Con la app en **su propio dominio** ese problema
desaparece —`elgremioapp.com` no envía nada más—, así que el remitente va
en la raíz y sin proveedor aparte.

Proveedor: el **correo de Hostinger** que ya se paga con el dominio
(plan Starter Business Email). Remitente: **noreply@elgremioapp.com**,
que es también el buzón real.

Los registros los puso el propio alta del correo en Hostinger y ya
responden:

| Tipo | Nombre | Para qué |
|---|---|---|
| MX | `@` | `mx1` y `mx2.hostinger.com` (prioridad 5 y 10) |
| TXT | `@` | SPF: `v=spf1 include:_spf.mail.hostinger.com ~all` |
| CNAME | `hostingermail-{a,b,c}._domainkey` | DKIM (la firma), tres registros |
| TXT | `_dmarc` | `v=DMARC1; p=none` |

Ninguno choca con los `A`/`AAAA` del sitio: son cosas distintas de la
misma zona. **Lo que sí los borraría todos de golpe es «Reset DNS
records»** en el panel de Hostinger. No se pulsa.

En Supabase → Authentication → Emails → SMTP Settings, activar
«Enable custom SMTP» y rellenar:

```
Sender email address     noreply@elgremioapp.com
Sender name              El Gremio
Host                     smtp.hostinger.com
Port number              465
Minimum interval         60 segundos   (el que trae por defecto)
Username                 noreply@elgremioapp.com   ← el buzón entero
Password                 la del buzón noreply@
```

Dos avisos sobre esa contraseña: Hostinger exige que el remitente sea el
buzón con el que te autenticas —no vale poner otro `From`—, y Supabase
**no la vuelve a enseñar** una vez guardada. Al llavero antes de pegarla.

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
