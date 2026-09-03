/* ============================================================
   MegaSalud · Bienvenida
   Página pública: busca por DNI los procesos de una persona
   en la Clínica MegaSalud Huancayo.
   ============================================================ */

import { buscarProcesosPorDni } from './api.js';

// Instructivo que se muestra en el panel de resultados (también al limpiar el DNI)
const INSTRUCTIVO_HTML =
  '<div class="bienvenida-instructivo">' +
    '<p>Este aplicativo está desarrollado para <strong>confirmar la veracidad</strong> de los resultados que se hayan obtenido en nuestro centro clínico.</p>' +
    '<p>Empieza ingresando el DNI; a continuación, los resultados aparecerán aquí.</p>' +
  '</div>';

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('dniBusqueda');
  const estado = document.getElementById('estadoBusqueda');
  const resultados = document.getElementById('resultados');
  let timer = null;
  let busquedaId = 0;

  // Búsqueda con debounce: se dispara al completar 8 dígitos
  input.addEventListener('input', () => {
    const dni = input.value.trim();
    clearTimeout(timer);
    if (/^\d{8}$/.test(dni)) {
      timer = setTimeout(() => buscar(dni), 300);
    } else {
      estado.textContent = dni ? 'El DNI debe tener 8 dígitos' : '';
      estado.className = 'campo-ayuda';
      resultados.innerHTML = INSTRUCTIVO_HTML;
    }
  });

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

  // Muestra los datos del paciente y sus procesos (texto simple por ahora)
  function renderResultados({ paciente, procedimientos }) {
    const procHtml = procedimientos.length
      ? procedimientos.map((pr) =>
          '<div class="proc-mini">' +
            '<strong>' + esc(pr.titulo || 'Sin título') + '</strong>' +
            (pr.fecha ? ' · ' + formatearFecha(pr.fecha) : '') +
            (pr.medico ? '<br>Médico: ' + esc(pr.medico) : '') +
            (pr.descripcion ? '<br>' + esc(pr.descripcion) : '') +
          '</div>').join('')
      : '<p class="subtitulo">Sin procesos registrados.</p>';

    resultados.innerHTML =
      '<h3>' + esc(paciente.nombres) + ' ' + esc(paciente.apellidos) + '</h3>' +
      '<p class="subtitulo">DNI: ' + esc(paciente.dni || '—') + '</p>' +
      '<h4>Procesos (' + procedimientos.length + ')</h4>' +
      procHtml;
  }
});

/* ---------- Utilidades ---------- */

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