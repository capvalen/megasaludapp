/* ============================================================
   MegaSalud · Bienvenida
   Página pública: busca por DNI los procesos de una persona
   en la Clínica MegaSalud Huancayo.
   ============================================================ */

import { buscarProcesosPorDni } from './api.js';

// Registro del service worker (PWA instalable)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// Instructivo que se muestra en el panel de resultados (también al limpiar el DNI)
const INSTRUCTIVO_HTML =
  '<div class="bienvenida-instructivo">' +
    '<p>Este aplicativo está desarrollado para <strong>confirmar la veracidad</strong> de los resultados que se hayan obtenido en nuestro centro clínico.</p>' +
    '<p>Empieza ingresando el DNI; a continuación, los resultados aparecerán aquí.</p>' +
  '</div>';

const ICONOS = {
  calendario: '<i class="ti ti-calendar"></i>',
  medico: '<i class="ti ti-stethoscope"></i>',
  papel: '<i class="ti ti-paperclip"></i>',
  descargar: '<i class="ti ti-download"></i>',
};

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('dniBusqueda');
  const btnLupa = document.getElementById('btnBuscarDni');
  const btnLimpiar = document.getElementById('btnLimpiarDni');
  const estado = document.getElementById('estadoBusqueda');
  const resultados = document.getElementById('resultados');
  let timer = null;
  let busquedaId = 0;

  // Botón limpiar: vacía el input, el estado y los resultados
  btnLimpiar.addEventListener('click', () => {
    input.value = '';
    clearTimeout(timer);
    busquedaId++; // invalida cualquier búsqueda en curso
    estado.textContent = '';
    estado.className = 'campo-ayuda';
    resultados.innerHTML = INSTRUCTIVO_HTML;
    input.focus();
  });

  // Búsqueda con Enter
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      buscarDni();
    }
  });

  // Búsqueda con el botón de la lupa
  btnLupa.addEventListener('click', buscarDni);

  // Debounce: también busca automáticamente al completar 8 dígitos
  input.addEventListener('input', () => {
    const dni = input.value.trim();
    clearTimeout(timer);
    if (/^\d{8}$/.test(dni)) {
      timer = setTimeout(buscarDni, 300);
    } else {
      estado.textContent = dni ? 'El DNI debe tener 8 dígitos' : '';
      estado.className = 'campo-ayuda';
      resultados.innerHTML = INSTRUCTIVO_HTML;
    }
  });

  function buscarDni() {
    const dni = input.value.trim();
    clearTimeout(timer);
    if (!/^\d{8}$/.test(dni)) {
      estado.textContent = dni ? 'El DNI debe tener 8 dígitos' : 'Ingresa un DNI de 8 dígitos';
      estado.className = 'campo-ayuda estado-error';
      resultados.innerHTML = INSTRUCTIVO_HTML;
      return;
    }
    buscar(dni);
  }

  async function buscar(dni) {
    const id = ++busquedaId;
    estado.textContent = 'Consultando…';
    estado.className = 'campo-ayuda estado-buscando';
    resultados.innerHTML = '<p class="subtitulo">Buscando…</p>';
    try {
      const data = await buscarProcesosPorDni(dni);
      if (id !== busquedaId) return; // respuesta obsoleta (el DNI cambió)
      if (!data) {
        estado.textContent = 'No se encontraron procesos para este DNI';
        estado.className = 'campo-ayuda estado-no-encontrado';
        resultados.innerHTML = '<p class="subtitulo">No se encontraron procesos para este DNI.</p>';
        return;
      }
      estado.textContent = '✓ Datos encontrados';
      estado.className = 'campo-ayuda estado-ok';
      renderResultados(data);
    } catch (err) {
      if (id !== busquedaId) return;
      estado.textContent = 'Error al consultar: ' + err.message;
      estado.className = 'campo-ayuda estado-error';
      resultados.innerHTML = '<p class="subtitulo">No se pudo completar la consulta.</p>';
    }
  }

  // Muestra los datos del paciente y sus procedimientos en tarjetas
  // (mismo estilo que la lista del perfil, sin acciones de edición)
  function renderResultados({ paciente, procedimientos }) {
    const procHtml = procedimientos.length
      ? procedimientos.map((pr, i) => tarjetaProcedimiento(pr, i + 1)).join('')
      : '<p class="subtitulo">Sin procesos registrados.</p>';

    resultados.innerHTML =
      '<div class="bienvenida-paciente">' +
        '<h3>' + esc(paciente.nombres) + ' ' + esc(paciente.apellidos) + '</h3>' +
        '<p class="subtitulo">DNI: ' + esc(paciente.dni || '—') + '</p>' +
        (paciente.celular ? '<p class="subtitulo">Celular: ' + esc(paciente.celular) + '</p>' : '') +
      '</div>' +
      '<h4 class="bienvenida-proc-titulo">Procedimientos (' + procedimientos.length + ')</h4>' +
      '<div class="lista-proc">' + procHtml + '</div>';
  }

  function tarjetaProcedimiento(pr, numero) {
    const docs = normalizarDocs(pr.documentos);
    const docsHtml = docs.length
      ? '<div class="proc-docs">' + docs.map((d) =>
          '<div class="doc-item">' +
            '<span class="doc-nombre">' + ICONOS.papel + ' ' + esc(d.name || nombreDeUrl(d.url)) + '</span>' +
            '<div class="doc-acciones">' +
              '<a class="btn-enlace" href="' + esc(d.url) + '" target="_blank" rel="noopener" download>' + ICONOS.descargar + ' Descargar</a>' +
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
    '</article>';
  }
});

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

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatearFecha(f) {
  if (!f) return '—';
  const d = new Date(f);
  if (isNaN(d)) return f;
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}