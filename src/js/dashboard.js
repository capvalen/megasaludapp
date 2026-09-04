/* ============================================================
   MegaSalud · Panel
   Lista de pacientes (ver / filtrar / ordenar / registrar).
   El perfil del paciente vive en perfil.html (js/perfil.js).
   ============================================================ */

import {
  getToken,
  getUsuarioEmail,
  cerrarSesion,
  buscarDni,
  obtenerPacientes,
  crearPaciente,
} from './api.js';

// Registro del service worker (PWA instalable)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

const POR_PAGINA = 15;

const estado = {
  pacientes: [],
  busqueda: '',
  orden: { campo: 'apellidos', dir: 'asc' },
  pagina: 1,
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
  document.getElementById('btnNuevoPaciente').addEventListener('click', abrirModalNuevoPaciente);
  document.getElementById('btnOrdenPacientes').addEventListener('click', alternarOrden);
  document.getElementById('formPaciente').addEventListener('submit', guardarPaciente);

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

  // Cerrar modales (solo con el botón X o Cancelar; el clic fuera NO cierra)
  document.querySelectorAll('[data-cerrar]').forEach((b) =>
    b.addEventListener('click', () => cerrarModal(b.dataset.cerrar)));
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

// Alterna el orden (asc/desc) del campo activo
function alternarOrden() {
  estado.orden.dir = estado.orden.dir === 'asc' ? 'desc' : 'asc';
  estado.pagina = 1;
  renderLista();
}

// Actualiza el ícono y texto del botón de orden
function actualizarBotonOrden() {
  const btn = document.getElementById('btnOrdenPacientes');
  const texto = document.getElementById('btnOrdenTexto');
  const asc = estado.orden.dir === 'asc';
  btn.querySelector('.ti').className = 'ti ' + (asc ? 'ti-sort-ascending' : 'ti-sort-descending');
  texto.textContent = asc ? 'A-Z' : 'Z-A';
  btn.title = asc ? 'Ordenar de Z a A (descendente)' : 'Ordenar de A a Z (ascendente)';
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
  actualizarBotonOrden();

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
    mostrarToast('Paciente registrado', 'ok');
    // Redirigir al perfil del paciente recién creado
    setTimeout(() => abrirPerfil(nuevo.id), 600);
  } catch (err) {
    mostrarToast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}

/* ---------- Perfil del paciente ---------- */

// Abre el perfil del paciente en su propia página (/perfil/)
function abrirPerfil(id) {
  location.href = '../perfil/?id=' + encodeURIComponent(id);
}

/* ---------- Utilidades ---------- */

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