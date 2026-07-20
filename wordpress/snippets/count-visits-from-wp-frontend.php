<?php
// Hook to inject the tracking script into the WordPress footer
add_action( 'wp_footer', 'ai4pid_inject_analytics_script', 100 );

function ai4pid_inject_analytics_script() {
    // Only run on the frontend, never in the admin dashboard
    if ( is_admin() ) {
        return;
    }
    // --- JS DOCUMENTATION (Hidden from frontend) ---
    // 1. window.addEventListener('load'): Waits for full page load to avoid blocking rendering.
    // 2. fetch: POST request to our custom endpoint.
    // 3. Content-Type: application/x-www-form-urlencoded is strictly required for PHP $_POST.
    // 4. catch: Fails silently in the background (e.g., if blocked by an adblocker).
    ?>
    <script>
        (function(){window.addEventListener('load',function(){fetch('/api-visits.php',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({'url':window.location.href})}).catch(function(){})})})();
    </script>
    <?php
}