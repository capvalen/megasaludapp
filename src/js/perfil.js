/* ============================================================
   MegaSalud · Perfil del paciente
   Muestra los datos del paciente y el CRUD de procedimientos
   (crear, editar, eliminar, adjuntos). Página: perfil.html
   ============================================================ */

import Dropzone from 'dropzone';
import 'dropzone/dist/dropzone.css';

import {
  getToken,
  getUsuarioEmail,
  cerrarSesion,
  obtenerPaciente,
  obtenerProcedimientos,
  crearProcedimiento,
  actualizarProcedimiento,
  actualizarDocumentos,
  apiFetch,
  COL_PROCEDIMIENTOS,
  CAMPO_ARCHIVO,
  URL_SUBIDA,
  URL_ARCHIVOS_SUBIDA,
} from './api.js';

// Registro del service worker (PWA instalable)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

const estado = {
  paciente: null,
  procedimientos: [],
  editandoProc: null,
  archivosSubidos: [], // nombres devueltos por subida.php
  ordenProc: 'desc',  // 'desc' = más recientes primero | 'asc' = más antiguos primero
};

// Campos opcionales que se muestran en el perfil si existen en msh_pacientes
const CAMPOS_OPCIONALES = [
  ['email', 'Email'],
  ['telefono', 'Teléfono'],
  ['direccion', 'Dirección'],
  ['fecha_nacimiento', 'Fecha de nacimiento'],
  ['sexo', 'Sexo'],
  ['edad', 'Edad'],
  ['historia_clinica', 'Historia clínica'],
];

const ICONOS = {
  calendario: '<i class="ti ti-calendar"></i>',
  medico: '<i class="ti ti-stethoscope"></i>',
  papel: '<i class="ti ti-paperclip"></i>',
  descargar: '<i class="ti ti-download"></i>',
  basura: '<i class="ti ti-trash"></i>',
  lapiz: '<i class="ti ti-pencil"></i>',
  flechaAbajo: '<i class="ti ti-arrow-down"></i>',
  flechaArriba: '<i class="ti ti-arrow-up"></i>',
};

document.addEventListener('DOMContentLoaded', iniciar);

/* ---------- Inicio ---------- */

async function iniciar() {
  if (!getToken()) { location.href = '../login/index.html'; return; }
  document.getElementById('usuarioEmail').textContent = getUsuarioEmail() || '';
  bindEventos();
  actualizarBotonOrden();
  configurarDropzone();

  // El id del paciente viene en la URL: /perfil/?id=...
  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    mostrarToast('Falta el id del paciente en la URL.', 'error');
    setTimeout(() => { location.href = '../dashboard/'; }, 1500);
    return;
  }

  try {
    estado.paciente = await obtenerPaciente(id);
  } catch (err) {
    mostrarToast('No se pudo cargar el paciente: ' + err.message, 'error');
    setTimeout(() => { location.href = '../dashboard/'; }, 1500);
    return;
  }
  renderPerfilInfo(estado.paciente);

  try {
    estado.procedimientos = await obtenerProcedimientos();
  } catch (err) {
    mostrarToast('No se pudieron cargar los procedimientos: ' + err.message, 'error');
  }
  renderProcedimientos();
}

function bindEventos() {
  document.getElementById('btnSalir').addEventListener('click', cerrarSesion);
  document.getElementById('btnVolver').addEventListener('click', () => { location.href = '../dashboard/'; });
  document.getElementById('btnNuevoProc').addEventListener('click', abrirModalNuevo);
  document.getElementById('btnOrdenProc').addEventListener('click', alternarOrden);
  document.getElementById('formProc').addEventListener('submit', guardarProcedimiento);

  // Cerrar modales (solo con el botón X o Cancelar; el clic fuera NO cierra)
  document.querySelectorAll('[data-cerrar]').forEach((b) =>
    b.addEventListener('click', () => cerrarModal(b.dataset.cerrar)));

  // Acciones dentro de las tarjetas de procedimientos (delegación)
  document.getElementById('listaProcedimientos').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-accion]');
    if (!btn) return;
    const proc = estado.procedimientos.find((x) => x.id === btn.dataset.proc);
    if (!proc) return;
    if (btn.dataset.accion === 'editar') abrirModalEditar(proc);
    else if (btn.dataset.accion === 'eliminar') eliminarProcedimiento(proc);
    else if (btn.dataset.accion === 'borrar-doc') borrarDocumento(proc, Number(btn.dataset.doc));
  });
}

/* ---------- Perfil ---------- */

function renderPerfilInfo(p) {
  const opcionales = CAMPOS_OPCIONALES
    .filter(([campo]) => p[campo] !== undefined && p[campo] !== null && String(p[campo]).trim() !== '')
    .map(([campo, etiqueta]) =>
      '<div class="dato"><span class="dato-etiqueta">' + etiqueta + '</span>' +
      '<span class="dato-valor">' + esc(p[campo]) + '</span></div>')
    .join('');

  document.getElementById('perfilInfo').innerHTML =
    '<div class="perfil-avatar">' + iniciales(p) + '</div>' +
    '<h2 class="perfil-nombre">' + esc(p.nombres) + ' ' + esc(p.apellidos) + '</h2>' +
    '<p class="perfil-dni">DNI: ' + esc(p.dni || '—') + '</p>' +
    '<div class="perfil-datos">' +
      '<div class="dato"><span class="dato-etiqueta">DNI</span><span class="dato-valor">' + esc(p.dni || '—') + '</span></div>' +
      '<div class="dato"><span class="dato-etiqueta">Apellidos</span><span class="dato-valor">' + esc(p.apellidos || '—') + '</span></div>' +
      '<div class="dato"><span class="dato-etiqueta">Nombres</span><span class="dato-valor">' + esc(p.nombres || '—') + '</span></div>' +
      '<div class="dato"><span class="dato-etiqueta">Celular</span><span class="dato-valor">' + esc(p.celular || '—') + '</span></div>' +
      opcionales +
      '<div class="dato dato-destacado"><span class="dato-etiqueta">Registrado desde</span>' +
      '<span class="dato-valor">' + formatearFecha(p.created) + '</span></div>' +
    '</div>';
}

function procedimientosDelPaciente() {
  const id = estado.paciente.id;
  return estado.procedimientos.filter((pr) => pr.paciente_id === id);
}

// Ordena por fecha de atención (o fecha de creación si no hay) según estado.ordenProc
function compararProcedimientos(a, b) {
  const fa = a.fecha || a.created || '';
  const fb = b.fecha || b.created || '';
  const cmp = String(fa).localeCompare(String(fb));
  return estado.ordenProc === 'desc' ? -cmp : cmp;
}

function alternarOrden() {
  estado.ordenProc = estado.ordenProc === 'desc' ? 'asc' : 'desc';
  actualizarBotonOrden();
  renderProcedimientos();
}

function actualizarBotonOrden() {
  const btn = document.getElementById('btnOrdenProc');
  const desc = estado.ordenProc === 'desc';
  btn.innerHTML = (desc ? ICONOS.flechaAbajo : ICONOS.flechaArriba) + ' ' +
    (desc ? 'Más recientes' : 'Más antiguos');
  btn.title = desc
    ? 'Ordenar de más antiguo a más reciente'
    : 'Ordenar de más reciente a más antiguo';
}

function renderProcedimientos() {
  const lista = procedimientosDelPaciente().sort(compararProcedimientos);
  const cont = document.getElementById('listaProcedimientos');
  if (!lista.length) {
    cont.innerHTML = '<div class="vacio"><p>Este paciente aún no tiene procedimientos registrados.</p></div>';
    return;
  }
  cont.innerHTML = lista.map((pr, i) => tarjetaProcedimiento(pr, i + 1)).join('');
}

function tarjetaProcedimiento(pr, numero) {
  const docs = normalizarDocs(pr.documentos);
  const docsHtml = docs.length
    ? '<div class="proc-docs">' + docs.map((d, i) =>
        '<div class="doc-item">' +
          '<span class="doc-nombre">' + ICONOS.papel + ' ' + esc(d.name || nombreDeUrl(d.url)) + '</span>' +
          '<div class="doc-acciones">' +
            '<a class="btn-enlace" href="' + esc(d.url) + '" target="_blank" rel="noopener" download>' + ICONOS.descargar + ' Descargar</a>' +
            '<button class="btn-icono btn-peligro" data-accion="borrar-doc" data-proc="' + pr.id + '" data-doc="' + i + '" title="Eliminar archivo">' + ICONOS.basura + '</button>' +
          '</div>' +
        '</div>').join('') + '</div>'
    : '<p class="sin-docs">Sin documentos adjuntos</p>';

  return '<article class="proc-tarjeta">' +
    '<div class="proc-cabecera-tarjeta">' +
      '<div class="proc-titulo-num">' +
        '<span class="badge-num">' + numero + '</span>' +
        '<h3>' + esc(pr.titulo || 'Sin título') + '</h3>' +
      '</div>' +
      '<span class="badge-fecha">' + ICONOS.calendario + ' ' + formatearFecha(pr.fecha) + '</span>' +
    '</div>' +
    '<p class="proc-medico">' + ICONOS.medico + ' ' + esc(pr.medico || 'Médico no registrado') + '</p>' +
    (pr.descripcion ? '<p class="proc-desc">' + esc(pr.descripcion) + '</p>' : '') +
    docsHtml +
    '<div class="proc-acciones">' +
      '<button class="btn btn-ghost btn-sm" data-accion="editar" data-proc="' + pr.id + '">' + ICONOS.lapiz + ' Editar</button>' +
      '<button class="btn btn-peligro btn-sm" data-accion="eliminar" data-proc="' + pr.id + '">' + ICONOS.basura + ' Eliminar</button>' +
    '</div>' +
  '</article>';
}

/* ---------- Dropzone (adjuntos) ---------- */

let dropzone = null;

// Configura la zona de arrastre: cada archivo se sube de inmediato a
// subida.php y su nombre devuelto se acumula en estado.archivosSubidos.
function configurarDropzone() {
  dropzone = new Dropzone('#dropzoneArchivos', {
    url: URL_SUBIDA,
    paramName: 'archivo',
    maxFilesize: 10, // MB
    acceptedFiles: '.pdf,.jpg,.jpeg',
    addRemoveLinks: true,
    dictRemoveFile: 'Quitar',
    dictFileTooBig: 'El archivo es demasiado grande ({{filesize}}MB). Máximo {{maxFilesize}}MB.',
    dictInvalidFileType: 'Tipo de archivo no permitido. Solo PDF, JPG o JPEG.',
    dictResponseError: 'No se pudo subir el archivo.',
  });

  // Subida correcta: guardar el nombre devuelto por subida.php
  dropzone.on('success', (file, resp) => {
    if (resp && resp.ok && resp.nombre) {
      file.nombreSubido = resp.nombre;
      estado.archivosSubidos.push(resp.nombre);
    } else {
      marcarErrorDropzone(file, (resp && resp.error) || 'No se pudo subir el archivo');
    }
  });

  // Validación estricta de tamaño: ningún archivo puede superar 10 MB
  const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
  dropzone.on('addedfile', (file) => {
    if (file.size > MAX_BYTES) {
      dropzone.removeFile(file);
      mostrarToast('El archivo "' + (file.name || '') + '" supera los 10 MB y no se subió.', 'error');
    }
  });

  // Si el usuario quita un archivo, no incluirlo en el JSON
  dropzone.on('removedfile', (file) => {
    if (file.nombreSubido) {
      estado.archivosSubidos = estado.archivosSubidos.filter((n) => n !== file.nombreSubido);
    }
  });
}

function marcarErrorDropzone(file, mensaje) {
  if (!file.previewElement) return;
  file.previewElement.classList.add('dz-error');
  const el = file.previewElement.querySelector('[data-dz-errormessage]');
  if (el) el.textContent = mensaje;
}

function limpiarDropzone() {
  estado.archivosSubidos = [];
  if (dropzone) dropzone.removeAllFiles();
}

/* ---------- CRUD de procedimientos ---------- */

function abrirModalNuevo() {
  estado.editandoProc = null;
  limpiarDropzone();
  document.getElementById('formProc').reset();
  document.getElementById('procId').value = '';
  document.getElementById('modalProcTitulo').textContent = 'Nuevo procedimiento';
  document.getElementById('procFecha').value = new Date().toISOString().slice(0, 10);
  abrirModal('modalProc');
}

function abrirModalEditar(pr) {
  estado.editandoProc = pr;
  limpiarDropzone();
  document.getElementById('procId').value = pr.id;
  document.getElementById('procTitulo').value = pr.titulo || '';
  document.getElementById('procDescripcion').value = pr.descripcion || '';
  document.getElementById('procMedico').value = pr.medico || '';
  document.getElementById('procFecha').value = pr.fecha ? String(pr.fecha).slice(0, 10) : '';
  document.getElementById('modalProcTitulo').textContent = 'Editar procedimiento';
  abrirModal('modalProc');
}

async function guardarProcedimiento(e) {
  e.preventDefault();
  const datos = {
    titulo: capitalizarPrimera(document.getElementById('procTitulo').value),
    descripcion: capitalizarPrimera(document.getElementById('procDescripcion').value),
    medico: capitalizarPrimera(document.getElementById('procMedico').value),
    fecha: document.getElementById('procFecha').value || null,
  };
  const btn = document.getElementById('btnGuardarProc');
  btn.disabled = true;
  btn.textContent = 'Guardando…';

  try {
    let proc;
    if (estado.editandoProc) {
      proc = await actualizarProcedimiento(estado.editandoProc.id, datos);
    } else {
      proc = await crearProcedimiento(estado.paciente.id, datos);
    }

    // Adjuntos subidos vía subida.php: agregar sus URLs al JSON "documentos"
    if (estado.archivosSubidos.length) {
      const docs = normalizarDocs(proc.documentos);
      estado.archivosSubidos.forEach((n) => docs.push({ name: n, url: URL_ARCHIVOS_SUBIDA + n }));
      proc = await actualizarDocumentos(proc.id, docs);
    }

    reemplazarProc(proc);
    // Refrescar la lista desde el servidor para incluir el nuevo registro
    estado.procedimientos = await obtenerProcedimientos();
    cerrarModal('modalProc');
    renderProcedimientos();
    mostrarToast(estado.editandoProc ? 'Procedimiento actualizado' : 'Procedimiento registrado', 'ok');
    estado.editandoProc = null;
    limpiarDropzone();
  } catch (err) {
    mostrarToast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}

async function eliminarProcedimiento(pr) {
  if (!confirm('¿Eliminar el procedimiento "' + (pr.titulo || '') + '"? Esta acción no se puede deshacer.')) return;
  try {
    await apiFetch('/collections/' + COL_PROCEDIMIENTOS + '/records/' + pr.id, { method: 'DELETE' });
    estado.procedimientos = estado.procedimientos.filter((x) => x.id !== pr.id);
    renderProcedimientos();
    mostrarToast('Procedimiento eliminado', 'ok');
  } catch (err) {
    mostrarToast('Error: ' + err.message, 'error');
  }
}

async function borrarDocumento(pr, indice) {
  const docs = normalizarDocs(pr.documentos);
  const doc = docs[indice];
  if (!doc) return;
  if (!confirm('¿Eliminar el archivo "' + (doc.name || nombreDeUrl(doc.url)) + '"?')) return;
  try {
    const nombre = nombreDeUrl(doc.url);
    const adjuntos = Array.isArray(pr.adjunto) ? pr.adjunto : (pr.adjunto ? [pr.adjunto] : []);
    const restantes = adjuntos.filter((f) => f !== nombre);
    const nuevosDocs = docs.filter((_, i) => i !== indice);

    // PATCH multipart: conserva los archivos restantes y actualiza el JSON
    const fd = new FormData();
    restantes.forEach((f) => fd.append(CAMPO_ARCHIVO, f));
    fd.append('documentos', JSON.stringify(nuevosDocs));

    const actualizado = await apiFetch('/collections/' + COL_PROCEDIMIENTOS + '/records/' + pr.id, {
      method: 'PATCH',
      body: fd,
    });
    reemplazarProc(actualizado);
    renderProcedimientos();
    mostrarToast('Archivo eliminado', 'ok');
  } catch (err) {
    mostrarToast('Error: ' + err.message, 'error');
  }
}

function reemplazarProc(proc) {
  const idx = estado.procedimientos.findIndex((x) => x.id === proc.id);
  if (idx >= 0) estado.procedimientos[idx] = proc;
}

/* ---------- Utilidades ---------- */

function normalizarDocs(docs) {
  if (Array.isArray(docs)) return docs;
  if (typeof docs === 'string') {
    try {
      const p = JSON.parse(docs);
      return Array.isArray(p) ? p : [];
    } catch (_) { return []; }
  }
  return [];
}

function nombreDeUrl(url) {
  try { return decodeURIComponent(String(url).split('/').pop() || 'archivo'); }
  catch (_) { return 'archivo'; }
}

function formatearFecha(f) {
  if (!f) return '—';
  const d = new Date(f);
  if (isNaN(d)) return f;
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Pone la primera letra en mayúscula y deja el resto tal como se ingresó
function capitalizarPrimera(v) {
  const s = String(v ?? '').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function iniciales(p) {
  const a = (p.nombres || '?').trim().charAt(0);
  const b = (p.apellidos || '').trim().charAt(0);
  return (a + b).toUpperCase();
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function abrirModal(id) { document.getElementById(id).hidden = false; }
function cerrarModal(id) { document.getElementById(id).hidden = true; }

let toastTimer = null;
function mostrarToast(msg, tipo) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast visible ' + (tipo === 'error' ? 'toast-error' : 'toast-ok');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 4000);
}