/* ------------------------------------------------------------------
   Service worker de El Gremio.

   Hace UNA sola cosa: recibir avisos push y abrir la app al tocarlos. No
   cachea nada y no intercepta ninguna petición, a propósito. Un service
   worker con caché mal puesta sirve una versión vieja de la app durante
   días y el fallo es dificilísimo de diagnosticar desde el sofá; mientras
   no haya modo offline de verdad, este se mantiene tonto.

   Va en `public/` para que salga en la raíz del sitio publicado
   (https://elgremioapp.com/sw.js) y su ámbito cubra toda la app. Un
   service worker solo controla lo que cuelga de su propia ruta.
   ------------------------------------------------------------------ */

// Sin esto, un service worker nuevo se queda "esperando" a que se cierren
// todas las pestañas de la app. En un móvil con la app instalada eso
// puede ser nunca, y los arreglos no llegarían.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()))

self.addEventListener('push', (evento) => {
  let datos = {}
  try {
    datos = evento.data ? evento.data.json() : {}
  } catch {
    datos = {}
  }

  const titulo = datos.titulo || 'El Gremio'
  const opciones = {
    body: datos.cuerpo || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    lang: 'es',
    // Una etiqueta fija hace que un aviso nuevo SUSTITUYA al anterior en
    // vez de apilarse. Si algún día fallara el tope de uno al día, la
    // pantalla de bloqueo no se llenaría de avisos del gremio.
    tag: 'gremio-aviso',
    renotify: false,
    data: { motivo: datos.motivo || null }
  }

  evento.waitUntil(self.registration.showNotification(titulo, opciones))
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()

  // Si la app ya está abierta se le da el foco en lugar de abrir otra
  // ventana: en un móvil, dos instancias de la misma app es justo lo que
  // hace que alguien piense que "se ha roto".
  //
  // La ventana se busca por el ÁMBITO del propio service worker, no por
  // una ruta escrita a mano. Aquí ponía `/el-gremio` y la app acaba de
  // mudarse a dominio propio: con la ruta fija, tocar el aviso abriría
  // una ventana nueva en vez de traer al frente la que ya estaba.
  // `registration.scope` vale igual en `/el-gremio/` que en la raíz.
  const raiz = self.registration.scope

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const ventana of ventanas) {
        if (ventana.url.startsWith(raiz) && 'focus' in ventana) return ventana.focus()
      }
      return self.clients.openWindow(raiz)
    })
  )
})
