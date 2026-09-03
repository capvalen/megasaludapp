# megasaludapp

Sistema ligero de gestión de pacientes para **MegaSalud**, hecho con HTML, CSS y JavaScript puro (sin frameworks), con backend **PocketBase**.

## Estructura

```
megasaludapp/
├── src/
│   ├── pages/
│   │   ├── index/index.html      → Bienvenida pública (búsqueda por DNI)
│   │   ├── login/index.html      → Login (usuario + contraseña)
│   │   ├── dashboard/index.html  → Lista de pacientes
│   │   └── perfil/index.html     → Perfil del paciente y sus procedimientos
│   ├── js/
│   │   ├── api.js                → Configuración y llamadas a PocketBase
│   │   ├── index.js              → Lógica de la bienvenida (búsqueda por DNI)
│   │   ├── login.js              → Lógica del login
│   │   ├── dashboard.js          → Lógica del panel (lista de pacientes)
│   │   └── perfil.js             → Lógica del perfil (procedimientos)
│   ├── css/estilos.css           → Tema claro azul / celeste
│   └── assets/logo.jpg           → Logo de la aplicación
├── package.json                  → Scripts npm (dev / build / preview)
└── vite.config.js                → Vite + vite-plugin-mpa (URLs limpias)
```

## Funcionalidades

- **Bienvenida pública** (`/`): saludo e instructivo, con un buscador por DNI (autocomplete desactivado, debounce de 300 ms al completar 8 dígitos). Si el DNI tiene procesos registrados, se muestran al costado (datos del paciente y sus procedimientos en texto simple). Debajo del buscador hay un aviso "¿Eres administrador? Ingresa aquí" con enlace al login.
- **Login**: el usuario se envía con el dominio `@megasaludhyo.com` agregado automáticamente (ej. `juan.perez` → `juan.perez@megasaludhyo.com`). Al autenticarse se guarda el **id** del usuario y el token en `localStorage`.
- **Dashboard**: tabla de pacientes (`msh_pacientes`) con **búsqueda** (DNI, apellidos, nombres, celular), **ordenamiento** por columna, paginación y botón **"+ Nuevo paciente"** para registrar pacientes (DNI, apellidos, nombres, celular).
- **Autocompletado por DNI**: al escribir 8 dígitos en el campo DNI (con debounce de 300 ms) se consulta `https://dnis.infocat.workers.dev/api/dni/{dni}/{token}` y se autocompletan apellidos y nombres. Si la API devuelve 0 resultados o un error 40x, aparece la notificación "DNI no encontrado" abajo a la derecha.
- **Perfil del paciente**: al hacer clic en un paciente se abre `/perfil/?id=...` con sus datos básicos y "Registrado desde" a la izquierda; a la derecha, sus **procedimientos** (`msh_procedimientos`) con título, descripción, médico, fecha y adjuntos (subir, descargar y eliminar archivos por procedimiento).

## Configuración

Todo se configura en `js/api.js`:

| Constante | Descripción |
|---|---|
| `PB_URL` | URL base de PocketBase (`https://pb.infocatsoluciones.com`) |
| `AUTH_URL` | Endpoint de autenticación (derivado de la URL de la colección `users`) |
| `COL_PACIENTES` | Colección de pacientes (`msh_pacientes`) |
| `COL_PROCEDIMIENTOS` | Colección de procedimientos (`msh_procedimientos`) |
| `CAMPO_ARCHIVO` | Nombre del campo **tipo archivo** en `msh_procedimientos` donde se suben los adjuntos (por defecto `adjunto`). Si tu colección usa otro nombre, cámbialo aquí. |
| `DNI_TOKEN` | Token de la API de consulta de DNI (proviene de `.env`). El navegador no puede leer `.env` directamente, por eso se define en `js/api.js`. |
| `DNI_API_URL` | URL base de la API de DNI (`https://dnis.infocat.workers.dev/api/dni`). |

### Supuestos sobre el esquema

- `msh_pacientes` tiene al menos: `dni`, `apellidos`, `nombres`, `celular` (y `created` para "Registrado desde").
- `msh_procedimientos` tiene: `titulo`, `descripcion`, `medico`, `fecha`, `documentos` (campo JSON con lista de `{ name, url }`) y un campo de relación al paciente. Al crear se envían tanto `paciente` como `paciente_id` (PocketBase ignora los campos desconocidos), y al listar se filtra por cualquiera de los dos.
- Los adjuntos se suben al campo tipo archivo (`CAMPO_ARCHIVO`) del procedimiento y su URL (`/api/files/msh_procedimientos/{id}/{archivo}`) se guarda en el JSON `documentos`.

### Autenticación en las peticiones (regla `@request.auth.id != ""`)

- En PocketBase, las colecciones tienen la regla de API `@request.auth.id != ""` (listar, ver, crear, actualizar y eliminar), por lo que **toda petición CRUD debe ir autenticada**.
- El frontend cumple esa regla enviando el token en el header `Authorization: Bearer <token>` en **todas** las peticiones CRUD (función `apiFetch()` en `js/api.js`).
- La **única excepción** es el login (`login()`), que se envía sin token porque es la petición que lo obtiene.
- Si una petición CRUD devuelve `401` o `403` (token ausente/expirado), la app cierra la sesión y redirige al login.

## Cómo ejecutar

Con Vite (recomendado):

```bash
npm install
npm run dev
# → http://localhost:5173/login/  (abre automáticamente)
```

El proyecto usa `vite-plugin-mpa`, que escanea `src/pages/**/index.html` y permite URLs limpias:

| URL | Página |
|---|---|
| `/` | Bienvenida pública (búsqueda por DNI) |
| `/login/` | Login |
| `/dashboard/` | Lista de pacientes |
| `/perfil/?id=...` | Perfil del paciente |

Para generar la versión de producción:

```bash
npm run build      # genera la carpeta dist/ (y copia el login a dist/index.html)
npm run preview    # sirve dist/ localmente
```

## Despliegue en GitHub Pages

1. Sube el proyecto a un repositorio de GitHub (rama `main`).
2. En GitHub: **Settings → Pages → Source: GitHub Actions**.
3. El workflow `.github/workflows/deploy.yml` compila con `npm run build` y publica `dist/` en cada push a `main`.
4. La app queda en `https://<usuario>.github.io/<repo>/login/`.

> Nota: los scripts usan módulos ES (`type="module"`), por lo que necesitan servirse por HTTP (Vite o cualquier servidor estático); abrir los HTML directamente desde el explorador de archivos ya no funciona.
