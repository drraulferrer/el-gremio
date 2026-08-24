// ------------------------------------------------------------------
// Los números suben, no saltan.
//
// Es la animación más copiada de Duolingo y no es un adorno: cuando
// terminas una lección, la XP no aparece, SUBE. La diferencia es que un
// número que salta se lee como un dato y un número que sube se lee como
// algo que acabas de ganar. Aquí pasaba lo primero: aprobabas una misión
// y la Bolsa cambiaba de 118 a 126 entre dos fotogramas, sin que nada
// dijera que esos 8 Talis eran tuyos.
//
// CUATRO DECISIONES QUE NO SON COSMÉTICAS:
//
// 1. La cuenta dura lo mismo suba 4 o suba 300. Si la velocidad fuera
//    constante, un premio grande tardaría una eternidad —y el premio
//    grande es justo el que no puedes hacer esperar— y uno pequeño no se
//    vería. Lo que se mantiene fijo es el TIEMPO; lo que cambia es el
//    paso.
//
// 2. Sube animado, baja instantáneo. Ganar es lo que hay que saborear;
//    gastar en la tienda es una transacción. Contar hacia atrás los
//    Talis de una compra sería subrayar la pérdida durante 700 ms, que
//    es exactamente lo que no queremos que recuerde quien acaba de
//    canjear un premio.
//
// 3. La primera vez no se anima. Abrir la app y ver tus 1.240 Talis
//    contar desde cero es una máquina tragaperras, no una respuesta a un
//    gesto. Solo se anima el cambio que ocurre con la pantalla delante.
//
// 4. Con `prefers-reduced-motion` no se anima: se pone el número. No una
//    versión corta —quien pide menos movimiento no está pidiendo el
//    mismo movimiento más rápido—.
// ------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react'

/**
 * Cuánto dura la cuenta, suba lo que suba.
 *
 * 700 ms está elegido entre dos límites que se tocan: por debajo de
 * ~400 ms el ojo no llega a leer que es un movimiento y vuelve a
 * parecer un salto; por encima de ~900 ms la cifra sigue corriendo
 * cuando ya has pasado a otra cosa y estorba.
 */
export const DURACION_MS = 700

/**
 * Desaceleración cúbica: arranca rápido y frena al final.
 *
 * Al revés —acelerando— la cifra final llegaría de golpe y se perdería
 * justo el fotograma que importa, que es en el que se para.
 */
export function suavizar(t) {
  if (t <= 0) return 0
  if (t >= 1) return 1
  return 1 - Math.pow(1 - t, 3)
}

/**
 * En qué número va la cuenta.
 *
 * Devuelve siempre un entero: aquí no hay ningún importe con decimales,
 * y un 126,4 parpadeando en la Bolsa sería un fallo a ojos de cualquiera.
 *
 * @param {number} desde valor del que se parte
 * @param {number} hasta valor al que se llega
 * @param {number} transcurrido ms desde que empezó la cuenta
 * @param {number} duracion ms que dura la cuenta entera
 */
export function pasoContador({ desde, hasta, transcurrido, duracion = DURACION_MS }) {
  const a = Number(desde) || 0
  const b = Number(hasta) || 0
  if (a === b) return b
  if (duracion <= 0) return b
  if (transcurrido >= duracion) return b

  const avance = suavizar(transcurrido / duracion)
  const valor = a + (b - a) * avance

  // Redondeo hacia el destino, no al más cercano. Con `Math.round`, una
  // subida de 118 a 119 se pasaba los primeros 350 ms mostrando 118: el
  // caso más corto —el de +1— era el único que no se veía moverse.
  const bruto = b > a ? Math.ceil(valor) : Math.floor(valor)

  // El redondeo no puede adelantarse al final: si llega al destino antes
  // de tiempo, la cifra se quedaría clavada y la cuenta parecería rota.
  return b > a ? Math.min(bruto, b) : Math.max(bruto, b)
}

/** ¿El sistema ha pedido menos movimiento? */
export function quiereMenosMovimiento() {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * ¿Hay que animar este cambio?
 *
 * Separada del hook a propósito: es la regla —no la mecánica— y es lo
 * que hay que poder leer y fijar en un test sin montar un componente.
 */
export function debeContar({ desde, hasta, primeraVez = false, menosMovimiento = false }) {
  if (primeraVez) return false
  if (menosMovimiento) return false
  if (!Number.isFinite(desde) || !Number.isFinite(hasta)) return false
  return hasta > desde
}

/**
 * El valor que hay que pintar ahora mismo.
 *
 * Uso: `const talis = useContador(profile.coins)` y se pinta `talis`.
 * Mientras no cambie nada devuelve el valor tal cual, así que ponerlo
 * donde no haya cambios no cuesta nada.
 */
export function useContador(valor, { duracion = DURACION_MS } = {}) {
  const destino = Number(valor) || 0
  const [mostrado, setMostrado] = useState(destino)

  // El valor anterior y si ya hemos pintado alguna vez. En una `ref`
  // porque cambiarlos no debe provocar un render por sí mismo.
  const previo = useRef(destino)
  const montado = useRef(false)

  useEffect(() => {
    const desde = previo.current
    previo.current = destino

    const primeraVez = !montado.current
    montado.current = true

    if (!debeContar({ desde, hasta: destino, primeraVez, menosMovimiento: quiereMenosMovimiento() })) {
      setMostrado(destino)
      return
    }

    let vivo = true
    const arranque = performance.now()

    const tic = (ahora) => {
      if (!vivo) return
      const transcurrido = ahora - arranque
      setMostrado(pasoContador({ desde, hasta: destino, transcurrido, duracion }))
      if (transcurrido < duracion) requestAnimationFrame(tic)
    }
    const id = requestAnimationFrame(tic)

    // Cancelar al desmontar no es opcional: sin esto, cambiar de pestaña
    // a mitad de cuenta deja un bucle pintando sobre un componente que
    // ya no existe.
    return () => {
      vivo = false
      cancelAnimationFrame(id)
    }
  }, [destino, duracion])

  return mostrado
}
