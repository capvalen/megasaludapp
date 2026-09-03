# megasaludapp

Sistema ligero de gestión de pacientes para **MegaSalud**, hecho con HTML, CSS y JavaScript puro (sin frameworks), con backend **PocketBase**.

## Estructura

```
megasaludapp/
├── login/index.html     → Login (usuario + contraseña)
├── dashboard/index.html → Lista de pacientes y perfil con procedimientos
├── css/estilos.css      → Tema claro azul / celeste
├── js/
│   ├── api.js           → Configuración y llamadas a PocketBase
│   ├── login.js         → Lógica del login
│   └── dashboard.js     → Lógica del panel
└── public/logo.jpg      → Logo de la aplicación
```

## Funcionalidades

- **Login**: el usuario se envía con el dominio `@megasaludhyo.com` agregado automáticamente (ej. `juan.perez` → `juan.perez@megasaludhyo.com`). Al autenticarse se guarda el **id** del usuario y el token en `localStorage`.
- **Dashboard**: tabla de pacientes (`msh_pacientes`) con **búsqueda** (DNI, apellidos, nombres, celular), **ordenamiento** por columna, paginación y botón **"+ Nuevo paciente"** para registrar pacientes (DNI, apellidos, nombres, celular).
- **Autocompletado por DNI**: al escribir 8 dígitos en el campo DNI (con debounce de 300 ms) se consulta `https://dnis.infocat.workers.dev/api/dni/{dni}/{token}` y se autocompletan apellidos y nombres. Si la API devuelve 0 resultados o un error 40x, aparece la notificación "DNI no encontrado" abajo a la derecha.
- **Perfil del paciente**: al hacer clic en un paciente se muestra a la izquierda sus datos básicos y "Registrado desde"; a la derecha, sus **procedimientos** (`msh_procedimientos`) con título, descripción, médico, fecha y adjuntos (subir, descargar y eliminar archivos por procedimiento).

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

## Cómo ejecutar

Sirve la carpeta con cualquier servidor estático y abre `login/index.html`:

```bash
# Opción 1: Python
python3 -m http.server 8000
# → http://localhost:8000/login/

# Opción 2: Node
npx serve .
```

> Nota: PocketBase habilita CORS por defecto, por lo que también funciona abriendo `index.html` directamente desde el explorador de archivos.
