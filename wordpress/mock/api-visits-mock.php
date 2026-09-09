<?php
// Mock to test the frontend locally. Does not require WordPress.

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
header("Access-Control-Allow-Origin: " . $origin);
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $visited_url = isset($_POST['url']) ? trim($_POST['url']) : 'URL_NO_RECIBIDA';
    
    // Print the visit in the Docker container logs
    error_log("\n[✅ MOCK ANALYTICS] New visit registered at: " . $visited_url . "\n");
    
    http_response_code(200);
    echo "OK";
    exit;
}

http_response_code(405);
echo "Method Not Allowed";