/* ============================================================
   MegaSalud · Login
   Al usuario se le agrega automáticamente "@megasaludhyo.com"
   antes de enviarlo al servidor.
   ============================================================ */

import { login } from './api.js';

// Registro del service worker (PWA instalable)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

const DOMINIO = '@megasaludhyo.com';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formLogin');
  const inputUsuario = document.getElementById('usuario');
  const inputPassword = document.getElementById('password');
  const preview = document.getElementById('previewEmail');
  const error = document.getElementById('errorLogin');
  const btn = document.getElementById('btnIngresar');
  const btnOjo = document.getElementById('btnOjo');

  // Vista previa del email completo que se enviará
  const actualizarPreview = () => {
    const v = inputUsuario.value.trim();
    preview.textContent = v ? (v.includes('@') ? v : v + DOMINIO) : '';
  };
  inputUsuario.addEventListener('input', actualizarPreview);

  // Mostrar / ocultar contraseña
  btnOjo.addEventListener('click', () => {
    const oculto = inputPassword.type === 'password';
    inputPassword.type = oculto ? 'text' : 'password';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarError();

    let identidad = inputUsuario.value.trim();
    if (!identidad) { mostrarError('Ingresa tu usuario.'); return; }
    // Agregar el dominio si el usuario no escribió un email completo
    if (!identidad.includes('@')) identidad += DOMINIO;

    const password = inputPassword.value;
    if (!password) { mostrarError('Ingresa tu contraseña.'); return; }

    btn.disabled = true;
    btn.textContent = 'Ingresando…';
    try {
      await login(identidad, password); // guarda el id y el token
      location.href = '../dashboard/index.html';
    } catch (err) {
      mostrarError(mensajeError(err));
      btn.disabled = false;
      btn.textContent = 'Ingresar';
    }
  });
});

function mostrarError(msg) {
  const error = document.getElementById('errorLogin');
  error.textContent = msg;
  error.hidden = false;
}

function ocultarError() {
  document.getElementById('errorLogin').hidden = true;
}

function mensajeError(err) {
  if (err.status === 400) return 'Usuario o contraseña incorrectos.';
  if (err.status === 404) return 'No se encontró el servicio de autenticación. Verifica la URL de PocketBase.';
  if (!err.status) return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
  return err.message || 'No se pudo iniciar sesión.';
}