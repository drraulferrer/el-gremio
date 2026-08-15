// Sello de la build. Los valores los inyecta Vite (ver vite.config.js) y
// viajan en el bundle, así que sirven para saber exactamente qué versión
// está corriendo un dispositivo cuando algo falla o tras un rollback.

/* global __APP_VERSION__, __APP_COMMIT__, __APP_BUILT_AT__ */

export const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'
export const COMMIT = typeof __APP_COMMIT__ === 'string' ? __APP_COMMIT__ : 'dev'
export const BUILT_AT = typeof __APP_BUILT_AT__ === 'string' ? __APP_BUILT_AT__ : ''

export const RELEASE = `${VERSION}+${COMMIT}`
