<?php
// Custom analytics file to count anonymously unique daily visits to our platform (both the Astro and WordPress websites).
// This file should be placed in the root of the WordPress installation (next to wp-load.php) and can be accessed via https://community.ai4pid.eu/api-visits.php

// This system only stores a hashed IP address of each visitor with a daily rotating salt, meaning that after 24 hours at most (specifically, at the end of each day at midnight server time) every visitor's hash will be fully anonymized and irreversible, ensuring that no personal data is stored longer than strictly necessary, and that the system is fully GDPR compliant. It also does not use cookies or any other tracking mechanism that could compromise user privacy.

// DISCLAIMER: This file is in development, and it is NOT being used in the Astro website yet (https://ai4pid.eu). Once this is fully tested, a privacy policy will be added to the Astro website in order to ensure GDPR compliance for the Astro website.
// During development, it will be used in the WordPress website (https://community.ai4pid.eu). However, the WordPress website is also currently in development, so it is NOT considered a production website yet. Once the WordPress website is fully developed and tested and it moves into production, our Privacy Policy from the Astro website will be linked from the WordPress website as well, ensuring GDPR compliance for both websites.

// Configuration Constants
define( 'AI4PID_ANALYTICS_TABLE_NAME', 'ai4pid_analytics_daily_visits' );
define( 'AI4PID_ANALYTICS_OPTION_NAME', 'ai4pid_analytics_salt_data' );

// 1. CORS Headers (Allows requests from Astro without blocking)

// Allowed explicit URLs (only keep localhost for testing or development, comment it out on prod)
// Note: All daily visits to any of these websites from the same IP will count as 1 unique visit per day to the entire platform
// (this is good because both Astro and WP are part of the same project)
$allowed_origins = [
    'https://ai4pid.eu', // prod Astro website
    'https://community.ai4pid.eu', // WordPress website (it makes a client request as well so cached pages still count visits)
    'http://localhost:4321' 
];

// Check who makes the request
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';

// If the origin is in our allowlist, allow it
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: " . $origin);
} else {
    // Fallback to only allow prod website
    header("Access-Control-Allow-Origin: https://ai4pid.eu");
}

header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// 2. Resolve ultra-fast browser Preflight (without loading WP)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Block any non-POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

// 3. Load ultra-light WordPress core
// NOTE: SHORTINIT is used to load only the essential parts of WordPress, making this script faster and more efficient for our analytics purpose than loading the full WordPress environment.
// Apparently it has no official documentation because it is meant only for advanced developers, but it is widely used in the WordPress community for performance optimization in specific scenarios.
// (Example: https://wordpress.stackexchange.com/questions/327137/understanding-shortinit-with-wordpress-5)
define( 'SHORTINIT', true );
require_once( dirname( __FILE__ ) . '/wp-load.php' );
global $wpdb;

// Get and sanitize the visited URL
$visited_url = isset($_POST['url']) ? trim(wp_strip_all_tags($_POST['url'])) : '';
if (empty($visited_url)) {
    http_response_code(400);
    exit;
}

// Get the real IP address
$ip = $_SERVER['REMOTE_ADDR'];
if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
    $ip = $_SERVER['HTTP_CLIENT_IP'];
} elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
    $ip = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
}

$today_date = date('Y-m-d');

// Fetch the salt data directly from wp_options
$option_row = $wpdb->get_row(
    $wpdb->prepare(
        "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s",
        AI4PID_ANALYTICS_OPTION_NAME
    )
);

$current_salt = '';
$regenerate_salt = false;

// Check if salt exists and is from today
if ($option_row) {
    $salt_data = json_decode($option_row->option_value, true);
    if (isset($salt_data['date']) && $salt_data['date'] === $today_date) {
        $current_salt = $salt_data['salt'];
    } else {
        $regenerate_salt = true; // Salt is outdated, destroy and regenerate
    }
} else {
    $regenerate_salt = true; // First time running
}

// Generate new random salt if day changed or missing
if ($regenerate_salt) {
    $current_salt = bin2hex(random_bytes(16));
    $new_data = wp_json_encode(['date' => $today_date, 'salt' => $current_salt]);

    // Insert or update the option safely
    // NOTE: This overwrites the previous salt data, so once the day changes, the old salt is destroyed and a new one is generated.
    // This means that once the day changes, we lose previous salts, so visitors' hashed IPs from previous days will no longer be reversible to their original IPs (not even by us, since the salt is needed to reverse the hash), ensuring anonymity.
    // This also means that hashes for the same IP will be different each day, maintaining anonymity while still allowing us to count unique daily visits.
    $wpdb->query($wpdb->prepare(
        "INSERT INTO {$wpdb->options} (option_name, option_value, autoload) VALUES (%s, %s, 'no')
         ON DUPLICATE KEY UPDATE option_value = VALUES(option_value)",
        AI4PID_ANALYTICS_OPTION_NAME, $new_data
    ));
}

// Generate the irreversible hash using today's salt
$visitor_hash = hash('sha256', $ip . $current_salt);
$table_name = $wpdb->prefix . AI4PID_ANALYTICS_TABLE_NAME;

// Insert the visit. INSERT IGNORE prevents duplicates for the same hash + url + date
$wpdb->query( $wpdb->prepare(
    "INSERT IGNORE INTO $table_name (visitor_hash, url, visit_date) VALUES (%s, %s, %s)",
    $visitor_hash,
    $visited_url,
    $today_date
));

// Fast response to the client
http_response_code(200);
echo "OK";