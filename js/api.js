/* ============================================================
   MegaSalud · Configuración y acceso a PocketBase
   ============================================================ */

// URL base de PocketBase (backend)
const PB_URL = 'https://pb.infocatsoluciones.com';
const API_URL = PB_URL + '/api';

// Endpoint de autenticación (PocketBase estándar).
// Se deriva de la URL de la colección users:
//   .../api/collections/users/records  ->  .../api/collections/users/auth-with-password
const AUTH_URL = API_URL + '/collections/users/auth-with-password';

// Colecciones
const COL_PACIENTES = 'msh_pacientes';
const COL_PROCEDIMIENTOS = 'msh_procedimientos';

// Nombre del campo TIPO ARCHIVO en la colección msh_procedimientos.
// Los adjuntos se suben a este campo y su URL se guarda en el JSON "documentos".
// Si tu colección usa otro nombre (ej. "archivo", "adjuntos"), cámbialo aquí.
const CAMPO_ARCHIVO = 'adjunto';

/* ---------- Consulta de DNI (RENIEC) ---------- */

// Token de la API de consulta de DNI (proviene del archivo .env).
// Nota: el navegador no puede leer .env directamente; por eso el token
// se define aquí. Si algún día hay backend, muévelo a una variable de entorno.
const DNI_TOKEN = 'megasalud-hJ910bf5-3881g';
const DNI_API_URL = 'https://dnis.infocat.workers.dev/api/dni';

// Consulta un DNI: devuelve { apellido, nombre } o lanza un error.
async function buscarDni(dni) {
  const res = await fetch(DNI_API_URL + '/' + encodeURIComponent(dni) + '/' + encodeURIComponent(DNI_TOKEN));
  if (!res.ok) {
    const err = new Error('DNI no encontrado');
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/* ---------- Sesión (localStorage) ---------- */

function getToken() {
  return localStorage.getItem('pb_token') || '';
}

function getUserId() {
  return localStorage.getItem('pb_user_id') || '';
}

function getUsuarioEmail() {
  return localStorage.getItem('pb_user_email') || '';
}

function cerrarSesion() {
  localStorage.removeItem('pb_token');
  localStorage.removeItem('pb_user_id');
  localStorage.removeItem('pb_user_email');
  location.href = '../login/index.html';
}

/* ---------- Autenticación ---------- */

// Inicia sesión con identidad (email) y contraseña.
// En caso de éxito guarda el token y el id del usuario.
async function login(identidad, password) {
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: identidad, password }),
  });

  if (!res.ok) {
    let msg = 'Error ' + res.status;
    try {
      const d = await res.json();
      msg = d.message || msg;
    } catch (_) { /* sin cuerpo JSON */ }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  // Guardar el id del usuario (y token) como pide el flujo
  localStorage.setItem('pb_token', data.token || '');
  localStorage.setItem('pb_user_id', data.record ? data.record.id : '');
  localStorage.setItem('pb_user_email', data.record ? (data.record.email || identidad) : identidad);
  return data.record;
}

/* ---------- Fetch genérico con token ---------- */

async function apiFetch(ruta, opciones = {}) {
  const headers = { ...(opciones.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (opciones.body && !(opciones.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(API_URL + ruta, { ...opciones, headers });

  if (res.status === 401) {
    cerrarSesion();
    throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
  }
  if (!res.ok) {
    let msg = 'Error ' + res.status;
    try {
      const d = await res.json();
      msg = d.message || msg;
    } catch (_) { /* sin cuerpo JSON */ }
    throw new Error(msg);
  }
  return res.json();
}

/* ---------- Pacientes ---------- */

async function obtenerPacientes() {
  const data = await apiFetch('/collections/' + COL_PACIENTES + '/records?perPage=500&sort=apellidos');
  return data.items || [];
}

// Crea un nuevo paciente (dni, apellidos, nombres, celular)
async function crearPaciente(datos) {
  return apiFetch('/collections/' + COL_PACIENTES + '/records', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

/* ---------- Procedimientos ---------- */

async function obtenerProcedimientos() {
  const data = await apiFetch('/collections/' + COL_PROCEDIMIENTOS + '/records?perPage=500&sort=-fecha');
  return data.items || [];
}

// Crea un procedimiento vinculado al paciente.
// Se envían "paciente" y "paciente_id" para soportar ambos nombres de campo
// de relación (PocketBase ignora los campos desconocidos).
async function crearProcedimiento(pacienteId, datos) {
  return apiFetch('/collections/' + COL_PROCEDIMIENTOS + '/records', {
    method: 'POST',
    body: JSON.stringify({ ...datos, paciente: pacienteId, paciente_id: pacienteId }),
  });
}

async function actualizarProcedimiento(id, datos) {
  return apiFetch('/collections/' + COL_PROCEDIMIENTOS + '/records/' + id, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

// Sube archivos al campo tipo archivo del procedimiento (multipart).
async function subirArchivos(procId, archivos) {
  const fd = new FormData();
  [...archivos].forEach((a) => fd.append(CAMPO_ARCHIVO, a));
  return apiFetch('/collections/' + COL_PROCEDIMIENTOS + '/records/' + procId, {
    method: 'PATCH',
    body: fd,
  });
}

// Actualiza el JSON "documentos" (lista de { name, url }).
async function actualizarDocumentos(procId, documentos) {
  return apiFetch('/collections/' + COL_PROCEDIMIENTOS + '/records/' + procId, {
    method: 'PATCH',
    body: JSON.stringify({ documentos }),
  });
}

// URL pública de descarga de un archivo adjunto
function urlArchivo(procId, nombre) {
  return PB_URL + '/api/files/' + COL_PROCEDIMIENTOS + '/' + procId + '/' + encodeURIComponent(nombre);
}