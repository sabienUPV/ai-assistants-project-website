<?php
// Hook to inject the tracking script into the WordPress footer
add_action( 'wp_footer', 'ai4pid_inject_analytics_script', 100 );

function ai4pid_inject_analytics_script() {
    // Only run on the frontend, never in the admin dashboard
    if ( is_admin() ) {
        return;
    }
    ?>
    <script>
        (function() {
            // Wait for the page to fully load so it doesn't block rendering or slow down metrics
            window.addEventListener('load', function() {
                const currentUrl = window.location.href;
                
                // Fetch request to our custom analytics endpoint
                fetch('/api-visits.php', {
                    method: 'POST',
                    headers: {
                        // This exact header is required for PHP to read it via $_POST['url']
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        'url': currentUrl
                    })
                }).catch(function(e) {
                    // Fail silently in the background (e.g., if blocked by an adblocker)
                    console.debug('Analytics fetch blocked or failed');
                });
            });
        })();
    </script>
    <?php
}