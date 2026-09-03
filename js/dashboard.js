/* ============================================================
   MegaSalud · Panel
   Lista de pacientes (ver / filtrar / ordenar) y perfil con
   procedimientos (CRUD + adjuntos).
   ============================================================ */

const POR_PAGINA = 15;

const estado = {
  pacientes: [],
  procedimientos: [],
  pacienteActual: null,
  busqueda: '',
  orden: { campo: 'apellidos', dir: 'asc' },
  pagina: 1,
  editandoProc: null,
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
  calendario: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  medico: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
  papel: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
  descargar: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  basura: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  lapiz: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
};

document.addEventListener('DOMContentLoaded', iniciar);

/* ---------- Inicio ---------- */

async function iniciar() {
  if (!getToken()) { location.href = '../login/index.html'; return; }
  document.getElementById('usuarioEmail').textContent = getUsuarioEmail() || '';
  bindEventos();
  try {
    estado.pacientes = await obtenerPacientes();
  } catch (err) {
    mostrarToast('No se pudieron cargar los pacientes: ' + err.message, 'error');
  }
  renderLista();
}

function bindEventos() {
  // Ordenar por columna
  document.querySelectorAll('th[data-campo]').forEach((th) => {
    th.addEventListener('click', () => {
      const campo = th.dataset.campo;
      if (estado.orden.campo === campo) {
        estado.orden.dir = estado.orden.dir === 'asc' ? 'desc' : 'asc';
      } else {
        estado.orden = { campo, dir: 'asc' };
      }
      estado.pagina = 1;
      renderLista();
    });
  });

  // Buscar / filtrar
  document.getElementById('buscarPaciente').addEventListener('input', (e) => {
    estado.busqueda = e.target.value;
    estado.pagina = 1;
    renderLista();
  });

  document.getElementById('btnSalir').addEventListener('click', cerrarSesion);
  document.getElementById('btnVolver').addEventListener('click', volverALista);
  document.getElementById('btnNuevoPaciente').addEventListener('click', abrirModalNuevoPaciente);
  document.getElementById('formPaciente').addEventListener('submit', guardarPaciente);
  document.getElementById('btnNuevoProc').addEventListener('click', abrirModalNuevo);

  // Búsqueda de DNI con debounce (se dispara al completar 8 dígitos)
  document.getElementById('pacDni').addEventListener('input', (e) => {
    const dni = e.target.value.trim();
    clearTimeout(dniTimer);
    if (/^\d{8}$/.test(dni)) {
      dniTimer = setTimeout(() => buscarDniAutocompletar(dni), 300);
    } else {
      setEstadoDni('');
    }
  });
  document.getElementById('formProc').addEventListener('submit', guardarProcedimiento);

  // Cerrar modales
  document.querySelectorAll('[data-cerrar]').forEach((b) =>
    b.addEventListener('click', () => cerrarModal(b.dataset.cerrar)));
  document.querySelectorAll('.modal-fondo').forEach((m) =>
    m.addEventListener('click', (e) => { if (e.target === m) cerrarModal(m.id); }));

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

/* ---------- Lista de pacientes ---------- */

function pacientesFiltrados() {
  const q = estado.busqueda.trim().toLowerCase();
  let lista = estado.pacientes;
  if (q) {
    lista = lista.filter((p) =>
      String(p.dni || '').toLowerCase().includes(q) ||
      String(p.apellidos || '').toLowerCase().includes(q) ||
      String(p.nombres || '').toLowerCase().includes(q) ||
      String(p.celular || '').toLowerCase().includes(q));
  }
  const { campo, dir } = estado.orden;
  const mult = dir === 'asc' ? 1 : -1;
  return [...lista].sort((a, b) => {
    const va = String(a[campo] ?? '').toLowerCase();
    const vb = String(b[campo] ?? '').toLowerCase();
    if (va === vb) return 0;
    return va < vb ? -1 * mult : 1 * mult;
  });
}

function renderLista() {
  const lista = pacientesFiltrados();
  const totalPaginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  if (estado.pagina > totalPaginas) estado.pagina = totalPaginas;
  const inicio = (estado.pagina - 1) * POR_PAGINA;
  const items = lista.slice(inicio, inicio + POR_PAGINA);

  document.getElementById('contadorPacientes').textContent =
    lista.length + ' paciente' + (lista.length === 1 ? '' : 's');

  // Flechas de orden
  document.querySelectorAll('th[data-campo]').forEach((th) => {
    const f = th.querySelector('.flecha');
    f.textContent = th.dataset.campo === estado.orden.campo
      ? (estado.orden.dir === 'asc' ? '▲' : '▼') : '';
  });

  const tbody = document.getElementById('cuerpoTabla');
  tbody.innerHTML = '';
  const sinResultados = document.getElementById('sinResultados');

  if (!items.length) {
    sinResultados.hidden = false;
  } else {
    sinResultados.hidden = true;
    items.forEach((p) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="dni">' + esc(p.dni) + '</td>' +
        '<td>' + esc(p.apellidos) + '</td>' +
        '<td>' + esc(p.nombres) + '</td>' +
        '<td>' + esc(p.celular) + '</td>';
      tr.title = 'Ver perfil de ' + esc(p.nombres) + ' ' + esc(p.apellidos);
      tr.addEventListener('click', () => abrirPerfil(p.id));
      tbody.appendChild(tr);
    });
  }
  renderPaginacion(totalPaginas);
}

function renderPaginacion(totalPaginas) {
  const cont = document.getElementById('paginacion');
  if (totalPaginas <= 1) { cont.innerHTML = ''; return; }
  cont.innerHTML =
    '<button class="btn btn-ghost btn-sm" id="pagAnt"' + (estado.pagina <= 1 ? ' disabled' : '') + '>← Anterior</button>' +
    '<span class="pag-info">Página ' + estado.pagina + ' de ' + totalPaginas + '</span>' +
    '<button class="btn btn-ghost btn-sm" id="pagSig"' + (estado.pagina >= totalPaginas ? ' disabled' : '') + '>Siguiente →</button>';
  document.getElementById('pagAnt').addEventListener('click', () => { estado.pagina--; renderLista(); });
  document.getElementById('pagSig').addEventListener('click', () => { estado.pagina++; renderLista(); });
}

/* ---------- Alta de pacientes ---------- */

let dniTimer = null;
let dniBusquedaId = 0;

function abrirModalNuevoPaciente() {
  document.getElementById('formPaciente').reset();
  setEstadoDni('');
  abrirModal('modalPaciente');
  document.getElementById('pacDni').focus();
}

// Consulta el DNI en la API y autocompleta apellidos y nombres
async function buscarDniAutocompletar(dni) {
  const id = ++dniBusquedaId;
  setEstadoDni('buscando');
  try {
    const data = await buscarDni(dni);
    if (id !== dniBusquedaId) return; // respuesta obsoleta (el DNI cambió)
    if (data && (data.apellido || data.nombre)) {
      document.getElementById('pacApellidos').value = data.apellido || '';
      document.getElementById('pacNombres').value = data.nombre || '';
      setEstadoDni('ok');
    } else {
      setEstadoDni('no-encontrado');
      mostrarToast('DNI no encontrado', 'error');
    }
  } catch (err) {
    if (id !== dniBusquedaId) return;
    if (err.status >= 400 && err.status < 500) {
      setEstadoDni('no-encontrado');
      mostrarToast('DNI no encontrado', 'error');
    } else {
      setEstadoDni('error');
      mostrarToast('Error al consultar el DNI: ' + err.message, 'error');
    }
  }
}

function setEstadoDni(estado) {
  const el = document.getElementById('estadoDni');
  el.className = 'campo-ayuda' + (estado ? ' estado-' + estado : '');
  el.textContent =
    estado === 'buscando' ? 'Consultando DNI…' :
    estado === 'ok' ? '✓ Datos encontrados' :
    estado === 'no-encontrado' ? 'DNI no encontrado' :
    estado === 'error' ? 'No se pudo consultar el DNI' : '';
}

async function guardarPaciente(e) {
  e.preventDefault();
  const dni = document.getElementById('pacDni').value.trim();
  const apellidos = document.getElementById('pacApellidos').value.trim();
  const nombres = document.getElementById('pacNombres').value.trim();
  const celular = document.getElementById('pacCelular').value.trim();

  // Validaciones antes de guardar
  if (!/^\d{8}$/.test(dni)) {
    mostrarToast('El DNI debe tener 8 dígitos', 'error');
    document.getElementById('pacDni').focus();
    return;
  }
  if (dni === '00000000') {
    mostrarToast('El DNI no puede ser 00000000', 'error');
    document.getElementById('pacDni').focus();
    return;
  }
  if (!apellidos) {
    mostrarToast('Los apellidos son obligatorios', 'error');
    document.getElementById('pacApellidos').focus();
    return;
  }
  if (!nombres) {
    mostrarToast('Los nombres son obligatorios', 'error');
    document.getElementById('pacNombres').focus();
    return;
  }

  const datos = {
    dni,
    apellidos,
    nombres,
    celular,
  };
  const btn = document.getElementById('btnGuardarPaciente');
  btn.disabled = true;
  btn.textContent = 'Guardando…';
  try {
    const nuevo = await crearPaciente(datos);
    estado.pacientes.push(nuevo);
    cerrarModal('modalPaciente');
    renderLista();
    mostrarToast('Paciente registrado', 'ok');
  } catch (err) {
    mostrarToast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}

/* ---------- Perfil del paciente ---------- */

async function abrirPerfil(id) {
  const p = estado.pacientes.find((x) => x.id === id);
  if (!p) return;
  estado.pacienteActual = p;
  document.getElementById('vistaLista').hidden = true;
  document.getElementById('vistaPerfil').hidden = false;
  renderPerfilInfo(p);
  try {
    estado.procedimientos = await obtenerProcedimientos();
  } catch (err) {
    mostrarToast('No se pudieron cargar los procedimientos: ' + err.message, 'error');
  }
  renderProcedimientos();
  window.scrollTo(0, 0);
}

function volverALista() {
  estado.pacienteActual = null;
  document.getElementById('vistaPerfil').hidden = true;
  document.getElementById('vistaLista').hidden = false;
  renderLista();
}

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
      '<span class="dato-valor">' + formatearFechaHora(p.created) + '</span></div>' +
    '</div>';
}

/* ---------- Procedimientos ---------- */

function procedimientosDelPaciente() {
  const id = estado.pacienteActual.id;
  return estado.procedimientos.filter((pr) =>
    pr.paciente === id || pr.paciente_id === id || (pr.paciente && pr.paciente.id === id));
}

function renderProcedimientos() {
  const lista = procedimientosDelPaciente();
  const cont = document.getElementById('listaProcedimientos');
  if (!lista.length) {
    cont.innerHTML = '<div class="vacio"><p>Este paciente aún no tiene procedimientos registrados.</p></div>';
    return;
  }
  cont.innerHTML = lista.map(tarjetaProcedimiento).join('');
}

function tarjetaProcedimiento(pr) {
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
      '<h3>' + esc(pr.titulo || 'Sin título') + '</h3>' +
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

/* ---------- CRUD de procedimientos ---------- */

function abrirModalNuevo() {
  estado.editandoProc = null;
  document.getElementById('formProc').reset();
  document.getElementById('procId').value = '';
  document.getElementById('modalProcTitulo').textContent = 'Nuevo procedimiento';
  document.getElementById('procFecha').value = new Date().toISOString().slice(0, 10);
  abrirModal('modalProc');
}

function abrirModalEditar(pr) {
  estado.editandoProc = pr;
  document.getElementById('procId').value = pr.id;
  document.getElementById('procTitulo').value = pr.titulo || '';
  document.getElementById('procDescripcion').value = pr.descripcion || '';
  document.getElementById('procMedico').value = pr.medico || '';
  document.getElementById('procFecha').value = pr.fecha ? String(pr.fecha).slice(0, 10) : '';
  document.getElementById('procArchivos').value = '';
  document.getElementById('modalProcTitulo').textContent = 'Editar procedimiento';
  abrirModal('modalProc');
}

async function guardarProcedimiento(e) {
  e.preventDefault();
  const datos = {
    titulo: document.getElementById('procTitulo').value.trim(),
    descripcion: document.getElementById('procDescripcion').value.trim(),
    medico: document.getElementById('procMedico').value.trim(),
    fecha: document.getElementById('procFecha').value || null,
  };
  const archivos = document.getElementById('procArchivos').files;
  const btn = document.getElementById('btnGuardarProc');
  btn.disabled = true;
  btn.textContent = 'Guardando…';

  try {
    let proc;
    if (estado.editandoProc) {
      proc = await actualizarProcedimiento(estado.editandoProc.id, datos);
    } else {
      proc = await crearProcedimiento(estado.pacienteActual.id, datos);
    }

    // Subir adjuntos y guardar sus URLs en el JSON "documentos"
    if (archivos.length) {
      const actualizado = await subirArchivos(proc.id, archivos);
      const nombres = Array.isArray(actualizado.adjunto)
        ? actualizado.adjunto
        : (actualizado.adjunto ? [actualizado.adjunto] : []);
      if (!nombres.length) {
        mostrarToast('El procedimiento se guardó, pero no se pudo adjuntar el archivo. Revisa el campo CAMPO_ARCHIVO en js/api.js.', 'error');
      } else {
        const docs = normalizarDocs(actualizado.documentos);
        nombres.forEach((n) => docs.push({ name: n, url: urlArchivo(proc.id, n) }));
        proc = await actualizarDocumentos(proc.id, docs);
      }
    }

    reemplazarProc(proc);
    cerrarModal('modalProc');
    renderProcedimientos();
    mostrarToast(estado.editandoProc ? 'Procedimiento actualizado' : 'Procedimiento registrado', 'ok');
    estado.editandoProc = null;
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

function formatearFechaHora(f) {
  if (!f) return '—';
  const d = new Date(f);
  if (isNaN(d)) return f;
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
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