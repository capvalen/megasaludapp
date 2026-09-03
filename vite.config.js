import { defineConfig } from 'vite';
import mpaModule from 'vite-plugin-mpa';

// Interop CJS/ESM: el paquete exporta el plugin envuelto en .default
const mpa = mpaModule.default || mpaModule;

// Aplicación multi-página con URLs limpias:
//   /login/  -> src/pages/login/index.html
//   /dashboard/ -> src/pages/dashboard/index.html
//   /perfil/ -> src/pages/perfil/index.html
// vite-plugin-mpa escanea src/pages/**/index.html y reescribe las URLs
// en el dev server (connect-history-api-fallback).
export default defineConfig({
  base: './',
  plugins: [
    mpa({
      open: '/login/',
      scanDir: 'src/pages',
      scanFile: 'index.html',
      filename: 'index.html',
    }),
  ],
});