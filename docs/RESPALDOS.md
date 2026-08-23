# Copias de seguridad

Hasta el 23-ago-2026 esta base no tenía ninguna copia. Ni volcado, ni script, ni
procedimiento escrito: un `delete` mal filtrado en el editor SQL o una migración
torcida se llevaba por delante las misiones, las rachas y los reconocimientos, y
no había vuelta atrás. El plan gratuito de Supabase tampoco guarda nada por su
cuenta. Esto lo arregla.

Son dos comandos y una línea de cron.

```bash
npm run respaldo                    # vuelca, cifra y comprueba
npm run respaldo -- --estado        # qué copias hay, sin tocar nada
npm run restaurar -- --ultimo --a <ref>
```

## Puesta en marcha (una vez)

**1. Enlazar el proyecto.** El volcado sale por el CLI de Supabase, que necesita
saber a qué base habla.

```bash
supabase link --project-ref <ref>
```

**Ya está hecho** en este Mac desde el 23-ago (`supabase/.temp/linked-project.json`
apunta a `chfbrawsoulfiywiqhpe`). Y **no hace falta la contraseña de la base**:
`consulta()` habla por `supabase db query --linked`, que va por la API de gestión
con el testigo del CLI, no por Postgres. Comprobado desde un entorno pelado
—sin TTY y con `env -i`—, que es lo más parecido a cron que se puede probar sin
esperar a las 4:23.

**2. Elegir la contraseña de las copias.** Es la que cifra los ficheros. Que sea
larga: es lo único que separa el volcado de quien encuentre el disco.

```bash
security add-generic-password -a $USER -s el-gremio-respaldo -w
```

Sin `-w <valor>`: así te la pide sin mostrarla y no queda en el historial de la
terminal. **Si la pierdes, las copias no se abren.** Guárdala también donde
guardes lo demás importante.

**3. Comprobar que funciona**, antes de fiarte de ello:

```bash
npm run respaldo
```

Tiene que terminar en `✓ … (abierto y comprobado)`. Ese «comprobado» no es
decorativo: el script vuelve a abrir el fichero que acaba de escribir, cuenta las
filas de cada tabla y las compara con las que había en la base. Si no cuadran,
falla y no da la copia por buena.

**4. Ponerlo en cron**, para que no dependa de acordarse:

**Ya está puesto** en este Mac desde el 23-ago. `crontab -l` lo enseña:

```
23 4 * * * /bin/zsh -lc "cd ~/el-gremio && node scripts/respaldo.mjs" >> ~/el-gremio-respaldos/respaldo.log 2>&1
```

**Ojo con la línea que decía antes esta página**: llamaba a `/usr/bin/node`, y en
este Mac **ese fichero no existe** —node vive en nvm, bajo
`~/.nvm/versions/node/<versión>/bin`—. Cron habría fallado cada noche escribiendo
«command not found» en un log que nadie mira, que es la peor forma de no tener
copias: creyendo que las tienes.

Por eso va por shell de login (`zsh -lc`) en vez de con la ruta absoluta: así
resuelve node por el perfil del usuario y sobrevive al próximo `nvm install`, que
cambiaría la ruta.

El log no va en `dist/`: cada `vite build` vacía esa carpeta y se llevaría el
historial justo cuando hiciera falta mirarlo.

## Qué guarda, y qué no

Todas las tablas de `public` **que existan en ese momento**. No hay lista escrita
a mano: se preguntan al catálogo, así que una tabla nueva entra sola en la
siguiente copia en vez de quedarse fuera en silencio, que es como se pierden los
datos de verdad.

Guarda además `auth.users`, donde viven las cuentas. Sin ella, una base
restaurada tendría las familias enteras y nadie podría entrar.

**No guarda la estructura.** Para eso está `schema.sql` y las migraciones, que sí
están en Git. Restaurar es: primero el esquema, después los datos.

**No guarda los ficheros de Storage** ni los secretos de las Edge Functions.
Ninguno de los dos se usa hoy en este proyecto; si algún día se usan, hay que
ampliar esto y este párrafo deja de ser cierto.

## Dónde acaban, y hasta cuándo

En `~/el-gremio-respaldos/`, fuera del repositorio a propósito: llevan datos
personales de la familia y este repositorio es público.

No se borra nada solo. Cuando se acumulen, `npm run respaldo -- --podar 30` deja
las 30 últimas y dice cuáles borra. Que la poda sea manual es deliberado: un
script que borra copias sin que nadie se lo pida es un script que un día borra la
que hacía falta.

**Todas las copias viven en este Mac.** Si el Mac desaparece, desaparecen con él.
Sacar una copia al mes a otro sitio sigue pendiente y es la mitad que falta.

## Restaurar

```bash
npm run restaurar -- --ultimo --a <ref> --ensayo   # enseña el plan, no toca nada
npm run restaurar -- --ultimo --a <ref>
```

Antes hay que crear el esquema en el proyecto de destino: pega `schema.sql` en su
editor SQL, o pásalo con `supabase db query -f`.

Lo que hace, por orden: descifra la copia, le pregunta al catálogo **del destino**
en qué orden se pueden tocar las tablas sin romper una clave ajena, vacía en orden
inverso, inserta en orden directo y recoloca las secuencias. Sin ese último paso,
el primer `insert` que hiciera la aplicación chocaría con una clave que ya existe.

Si el `--a` es el proyecto que tienes enlazado —o sea, producción— se planta y
exige `--si-de-verdad`. Restaurar encima de una base viva borra todo lo ocurrido
desde la copia, y eso no puede pasar por un despiste al pegar un ref.

Las cuentas de `auth.users` **no se restauran automáticamente**: esa tabla la
gestiona Supabase, e insertarla a mano deja las cuentas a medias, sin
`identities` y sin poder iniciar sesión. El volcado está para saber quién había;
recrearlas es un paso aparte con la API de admin.

## La prueba que falta

Un respaldo que nunca se ha restaurado no es una protección: es un fichero que da
tranquilidad. Mientras no se haya hecho **una restauración completa en un
proyecto vacío**, con una cuenta entrando después, esto está a medias.

Es una tarde de trabajo y conviene hacerla pronto, no el día que haga falta.
