<?php
/* ============================================================
   MegaSalud · subida.php
   Sube un archivo (PDF, JPG, JPEG) y devuelve el nombre único
   con el que se guardó. Cualquier otra extensión es rechazada.
   ============================================================ */

header('Content-Type: application/json; charset=utf-8');

// CORS: permite que la app (otro origen) suba archivos desde el navegador
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Cache-Control, X-Requested-With');

// Preflight CORS: el navegador envía OPTIONS antes del POST real.
// Responder 200 sin procesar nada.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Extensiones permitidas
$PERMITIDAS = ['pdf', 'jpg', 'jpeg'];

// MIME types permitidos (validación extra)
$MIMES_PERMITIDOS = [
    'application/pdf' => 'pdf',
    'image/jpeg'      => 'jpg',
];

// Carpeta donde se guardan los archivos
$DIR_UPLOADS = __DIR__ . '/uploads/';

// Crear la carpeta de uploads si no existe
if (!is_dir($DIR_UPLOADS)) {
    mkdir($DIR_UPLOADS, 0755, true);
}

// Solo se acepta POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Método no permitido']);
    exit;
}

// Debe venir un archivo en el campo "archivo"
if (empty($_FILES['archivo'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'No se recibió ningún archivo']);
    exit;
}

$archivo = $_FILES['archivo'];

// Errores de subida del servidor
if ($archivo['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Error al subir el archivo']);
    exit;
}

// Validar extensión
$nombreOriginal = $archivo['name'];
$extension = strtolower(pathinfo($nombreOriginal, PATHINFO_EXTENSION));

if (!in_array($extension, $PERMITIDAS)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'archivo no permitido']);
    exit;
}

// Validar MIME real del archivo
$mime = mime_content_type($archivo['tmp_name']);
if (!isset($MIMES_PERMITIDOS[$mime])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'archivo no permitido']);
    exit;
}

// Nombre único: fecha + uniqid + extensión
$nombreUnico = date('Ymd_His') . '_' . uniqid() . '.' . $extension;
$rutaDestino = $DIR_UPLOADS . $nombreUnico;

// Mover el archivo temporal a la carpeta de uploads
if (!move_uploaded_file($archivo['tmp_name'], $rutaDestino)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'No se pudo guardar el archivo']);
    exit;
}

// Devolver el nombre con el que se guardó
echo json_encode(['ok' => true, 'nombre' => $nombreUnico]);