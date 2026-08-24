import globals from 'globals'
import react from 'eslint-plugin-react'
import hooks from 'eslint-plugin-react-hooks'

// ------------------------------------------------------------------
// Linter, y solo para una cosa: usar algo sin haberlo importado.
//
// El 24-ago pasó dos veces en una sesión —`Retrato` en dos pantallas y
// `generoDe` en App— y las dos veces `npm run build` dio VERDE: Vite
// empaqueta tan tranquilo una referencia que no existe, y el fallo
// aparece en pantalla como `ReferenceError`, en la ruta concreta donde
// vive ese componente. El segundo costó tres intentos de depuración
// persiguiendo un fantasma en la celebración.
//
// De ahí que la configuración sea deliberadamente CORTA. Esto no es una
// guía de estilo: el proyecto ya tiene su criterio escrito en los
// comentarios y no hace falta una herramienta que opine de comillas. Son
// dos reglas, las que cierran ese agujero:
//
//   · no-undef            → funciones y variables sin importar
//   · react/jsx-no-undef  → componentes sin importar, que `no-undef` no
//                           ve porque un <Componente> no es una
//                           referencia normal para el analizador
//
// Si algún día se quiere más, que sea una decisión aparte y razonada.
// Añadir reglas de estilo aquí convertiría `npm run verify` en una
// discusión sobre puntos y comas.
// ------------------------------------------------------------------

export default [
  {
    // Los `eslint-disable-line react-hooks/exhaustive-deps` del código son
    // anteriores a este fichero: se escribieron como documentación, para
    // un linter que no existía. Si la regla no está DEFINIDA, cada uno de
    // esos comentarios es un error por sí solo. Se registra el plugin y
    // se deja la regla apagada: los comentarios vuelven a ser válidos y
    // encenderla algún día es cambiar una palabra.
    files: ['src/**/*.{js,jsx}', 'scripts/**/*.mjs', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        ...globals.node,
        // Lo inyecta Vite en el build (`define`, vite.config.js). No
        // existe en el fuente y por eso hay que declararlo.
        __DOMINIO__: 'readonly'
      }
    },
    plugins: { react, 'react-hooks': hooks },
    rules: {
      'no-undef': 'error',
      'react/jsx-no-undef': 'error',
      'react-hooks/exhaustive-deps': 'off'
    },
    // Los `eslint-disable` que no hacen falta no son un problema: la
    // mayoría son notas para quien lee. Avisar de ellos convertiría esto
    // en ruido y la gente dejaría de mirar la salida.
    linterOptions: { reportUnusedDisableDirectives: 'off' }
  }
]
