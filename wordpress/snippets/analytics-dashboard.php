<?php
// Configuration Constants
define( 'AI4PID_ANALYTICS_TABLE_NAME', 'ai4pid_analytics_daily_visits' );
define( 'AI4PID_ANALYTICS_GEOIP_CONTENT_DIR', 'uploads/ai4pid-geoip' ); // Relative to WP_CONTENT_DIR
define( 'AI4PID_ANALYTICS_GEOIP_FLAGS_DIR_NAME', 'flags' );
define( 'AI4PID_ANALYTICS_GEOIP_DB_FILE_NAME', 'GeoLite2-Country.mmdb' );
define( 'AI4PID_ANALYTICS_GEOIP_READER_LOAD_FILE_REL_PATH', 'MaxMind-DB-Reader-php/autoload.php' );

// Calculated Paths based on the above constants
// (Note: "CONTENT" variants are for paths relative to WP_CONTENT_DIR for use in the content_url() function, while the others are absolute paths)
define( 'AI4PID_ANALYTICS_GEOIP_DIR', WP_CONTENT_DIR . '/' . AI4PID_ANALYTICS_GEOIP_CONTENT_DIR );
define( 'AI4PID_ANALYTICS_GEOIP_FLAGS_DIR', AI4PID_ANALYTICS_GEOIP_DIR . '/' . AI4PID_ANALYTICS_GEOIP_FLAGS_DIR_NAME );
define( 'AI4PID_ANALYTICS_GEOIP_FLAGS_CONTENT_DIR', AI4PID_ANALYTICS_GEOIP_CONTENT_DIR . '/' . AI4PID_ANALYTICS_GEOIP_FLAGS_DIR_NAME );
define( 'AI4PID_ANALYTICS_GEOIP_DB_FILE', AI4PID_ANALYTICS_GEOIP_DIR . '/' . AI4PID_ANALYTICS_GEOIP_DB_FILE_NAME );
define( 'AI4PID_ANALYTICS_GEOIP_READER_LOAD_FILE', AI4PID_ANALYTICS_GEOIP_DIR . '/' . AI4PID_ANALYTICS_GEOIP_READER_LOAD_FILE_REL_PATH );

// Hook to add the admin menu
add_action( 'admin_menu', 'ai4pid_analytics_admin_menu' );

function ai4pid_analytics_admin_menu() {
    add_menu_page(
        'AI4PID Analytics',            // Page title
        'AI4PID Analytics',            // Menu title
        'manage_options',             // Capability (admins only)
        'ai4pid-analytics',            // Menu slug
        'ai4pid_analytics_admin_page', // Callback function to render page
        'dashicons-chart-area',       // Icon
        30                            // Position
    );
}

// Handle Form Submissions securely via POST-Redirect-GET pattern
add_action( 'admin_init', 'ai4pid_analytics_process_actions' );

function ai4pid_analytics_process_actions() {
    if ( ! isset( $_GET['page'] ) || $_GET['page'] !== 'ai4pid-analytics' ) return;
    if ( ! current_user_can( 'manage_options' ) ) return;
    if ( $_SERVER['REQUEST_METHOD'] !== 'POST' ) return;

    global $wpdb;
    $table_name = $wpdb->prefix . AI4PID_ANALYTICS_TABLE_NAME;
    
    // Preserve the current period parameter in redirects
    $current_period = isset($_GET['period']) ? sanitize_text_field($_GET['period']) : '30';
    $base_url = admin_url( 'admin.php?page=ai4pid-analytics' );
    $base_url_with_period = add_query_arg( 'period', $current_period, $base_url );

    // 1. INIT TABLE
    if ( isset( $_POST['ai4pid_analytics_setup_submit'] ) && check_admin_referer( 'ai4pid_analytics_setup', 'ai4pid_analytics_nonce' ) ) {
        require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
        $charset_collate = $wpdb->get_charset_collate();

        // Storing visits with universal UNIX timestamps for maximum performance and timezone decoupling
        $sql = "CREATE TABLE $table_name (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            visitor_hash varchar(64) NOT NULL,
            domain varchar(100) NOT NULL,
            url varchar(255) NOT NULL,
            country varchar(2) DEFAULT NULL,
            is_mobile tinyint(1) NOT NULL DEFAULT 0,
            visit_timestamp bigint(20) unsigned NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY unique_hash_url (visitor_hash, url),
            KEY timestamp_idx (visit_timestamp),
            KEY domain_idx (domain),
            KEY country_idx (country)
        ) $charset_collate;";

        dbDelta( $sql );

        // Migration step 1: Populate empty domains for older records
        $wpdb->query("UPDATE $table_name SET domain = SUBSTRING_INDEX(SUBSTRING_INDEX(url, '://', -1), '/', 1) WHERE domain = ''");
        
        // Migration step 2: Convert old visit_date and visit_time to the new visit_timestamp (dbDelta keeps old columns, so we can read them)
        // This fixes old rows having a timestamp of '0' (1970) which excluded them from "Last 30 Days" queries.
        $wpdb->query("UPDATE $table_name SET visit_timestamp = UNIX_TIMESTAMP(CONCAT(visit_date, ' ', visit_time)) WHERE visit_timestamp = 0 AND visit_date IS NOT NULL");

        wp_safe_redirect( add_query_arg( 'msg', 'initialized', $base_url_with_period ) );
        exit;
    }

    // 2. CLEAR DATA
    if ( isset( $_POST['ai4pid_analytics_clear_submit'] ) && check_admin_referer( 'ai4pid_analytics_clear', 'ai4pid_analytics_nonce' ) ) {
        if ( isset($_POST['clear_confirm_text']) && trim($_POST['clear_confirm_text']) === 'CLEAR' ) {
            $result = $wpdb->query("TRUNCATE TABLE $table_name");
            $msg = ($result !== false) ? 'cleared' : 'error';
        } else {
            $msg = 'clear_mismatch';
        }
        wp_safe_redirect( add_query_arg( 'msg', $msg, $base_url_with_period ) );
        exit;
    }

    // 3. DESTROY TABLE
    if ( isset( $_POST['ai4pid_analytics_destroy_submit'] ) && check_admin_referer( 'ai4pid_analytics_destroy', 'ai4pid_analytics_nonce' ) ) {
        if ( isset($_POST['destroy_confirm_text']) && trim($_POST['destroy_confirm_text']) === 'DESTROY' ) {
            $result = $wpdb->query("DROP TABLE IF EXISTS $table_name");
            $msg = ($result !== false) ? 'destroyed' : 'error';
        } else {
            $msg = 'destroy_mismatch';
        }
        wp_safe_redirect( add_query_arg( 'msg', $msg, $base_url ) ); // Remove period arg on destroy (using $base_url instead of $base_url_with_period)
        exit;
    }

    // 4. SETUP GEOIP
    if ( isset( $_POST['ai4pid_geoip_setup_submit'] ) && check_admin_referer( 'ai4pid_geoip_setup', 'ai4pid_geoip_nonce' ) ) {
        // Create the directory if it doesn't exist, ensuring proper permissions
        if ( ! file_exists( AI4PID_ANALYTICS_GEOIP_DIR ) ) {
            wp_mkdir_p( AI4PID_ANALYTICS_GEOIP_DIR );
        }

        // Generate security files (index.php and .htaccess) automatically to prevent direct access
        file_put_contents( AI4PID_ANALYTICS_GEOIP_DIR . '/index.php', "<?php\n// Silence is golden.\n" );
        file_put_contents( AI4PID_ANALYTICS_GEOIP_DIR . '/.htaccess', "<IfModule mod_authz_core.c>\n    Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n    Order deny,allow\n    Deny from all\n</IfModule>\n" );

        $upload_error = false;

        // 1. Process the GeoIP database (.mmdb)
        if ( ! empty( $_FILES['mmdb_file']['tmp_name'] ) ) {
            $mmdb_name = $_FILES['mmdb_file']['name'];
            if ( substr( $mmdb_name, -5 ) === '.mmdb' ) {
                move_uploaded_file( $_FILES['mmdb_file']['tmp_name'], AI4PID_ANALYTICS_GEOIP_DB_FILE );
            } else {
                $upload_error = true; // Probablemente subieron el .gz sin extraer
            }
        }

        // 2. Process the reader (ZIP from GitHub)
        if ( ! empty( $_FILES['reader_zip']['tmp_name'] ) && ! $upload_error ) {
            require_once( ABSPATH . '/wp-admin/includes/file.php' );
            WP_Filesystem();
            
            $unzip_target = AI4PID_ANALYTICS_GEOIP_DIR . '/temp_reader';
            $result = unzip_file( $_FILES['reader_zip']['tmp_name'], $unzip_target );
            
            if ( ! is_wp_error( $result ) ) {
                // GitHub ZIPs contain a root folder (e.g., MaxMind-DB-Reader-php-main). We rename it.
                $extracted_items = glob( $unzip_target . '/*' );
                $target_reader_dir = AI4PID_ANALYTICS_GEOIP_DIR . '/MaxMind-DB-Reader-php';
                
                if ( ! empty( $extracted_items ) && is_dir( $extracted_items[0] ) ) {
                    // If the target directory already exists from a previous installation, delete it first to avoid conflicts.
                    if ( file_exists( $target_reader_dir ) ) {
                        global $wp_filesystem;
                        $wp_filesystem->delete( $target_reader_dir, true );
                    }
                    rename( $extracted_items[0], $target_reader_dir );
                }
                // Remove the temporary unzip directory after moving the reader to its final location
                rmdir( $unzip_target );
            } else {
                $upload_error = true;
            }
        }

        $msg = $upload_error ? 'geoip_error' : 'geoip_success';
        wp_safe_redirect( add_query_arg( 'msg', $msg, $base_url_with_period ) );
        exit;
    }
}

// Render the Dashboard Page
function ai4pid_analytics_admin_page() {
    if ( ! current_user_can( 'manage_options' ) ) return;

    global $wpdb;
    $table_name = $wpdb->prefix . AI4PID_ANALYTICS_TABLE_NAME;

    // Check if table exists securely using prepared statement
    $table_exists_query = $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $table_name ) );
    $table_exists = ( $wpdb->get_var( $table_exists_query ) === $table_name );

    echo '<div class="wrap">';
    echo '<h1>AI4PID Privacy-First Analytics</h1>';

    // Show feedback messages
    if ( isset( $_GET['msg'] ) ) {
        $msg = sanitize_text_field( $_GET['msg'] );
        if ( $msg === 'initialized' ) echo '<div class="notice notice-success is-dismissible"><p>✅ Database table verified/created/migrated successfully.</p></div>';
        if ( $msg === 'cleared' ) echo '<div class="notice notice-success is-dismissible"><p>🧹 All analytics data cleared (table preserved).</p></div>';
        if ( $msg === 'destroyed' ) echo '<div class="notice notice-success is-dismissible"><p>💥 Analytics table destroyed successfully.</p></div>';
        if ( $msg === 'geoip_success' ) echo '<div class="notice notice-success is-dismissible"><p>🌍 GeoIP module initialized and secured successfully.</p></div>';
        if ( $msg === 'destroy_mismatch' ) echo '<div class="notice notice-error is-dismissible"><p>❌ Destruction aborted: You must type DESTROY in uppercase.</p></div>';
        if ( $msg === 'clear_mismatch' ) echo '<div class="notice notice-error is-dismissible"><p>❌ Clear aborted: You must type CLEAR in uppercase.</p></div>';
        if ( $msg === 'geoip_error' ) echo '<div class="notice notice-error is-dismissible"><p>❌ Failed to install GeoIP. Ensure the database is extracted (.mmdb) and the reader is a valid .zip file.</p></div>';
        if ( $msg === 'error' ) echo '<div class="notice notice-error is-dismissible"><p>❌ A database error occurred. Check logs if WP_DEBUG is enabled.</p></div>';
    }

    // Check if we are on the GeoIP setup screen
    if ( isset($_GET['action']) && $_GET['action'] === 'setup-geoip' ) {
        ai4pid_render_geoip_setup_page();
        return; // Stop rendering the normal dashboard
    }

    // GeoIP Status Check (for normal dashboard)
    $geoip_active = file_exists(AI4PID_ANALYTICS_GEOIP_DB_FILE) && file_exists(AI4PID_ANALYTICS_GEOIP_READER_LOAD_FILE);
    if ($geoip_active) {
        $file_date = wp_date('Y-m-d', filemtime(AI4PID_ANALYTICS_GEOIP_DB_FILE));
        echo '<div style="margin-top: 10px; display: inline-block; background: #e5f5fa; color: #007cba; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">🌍 GeoIP Active (Database from ' . $file_date . ')</div>';
    } else {
        echo '<div style="margin-top: 10px; display: inline-block; background: #fcf0f1; color: #d63638; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">⚠️ GeoIP Missing: Setup required to track countries.</div>';
        echo '<div style="margin-top: 10px;">';
        echo '<a href="' . esc_url(add_query_arg('action', 'setup-geoip')) . '" class="button button-primary">Launch GeoIP Setup Wizard</a>';
        
        // The manual FTP instructions are provided in a collapsible section for users who prefer not to use the wizard.
        echo '<details style="margin-top: 10px; background: #fff; padding: 15px; border: 1px solid #ccd0d4; max-width: 650px;">';
        echo '<summary style="cursor: pointer; font-weight: 600; color: #007cba;">Or view manual FTP instructions</summary>';
        echo '<p style="margin-top: 15px;">If you prefer not to use the wizard, create <code>wp-content/uploads/ai4pid-geoip/</code> and place the following 4 items inside:</p>';
        echo '<ol style="margin-bottom: 0;">';
        
        // 1. Database
        echo '<li style="margin-bottom: 15px;"><code>GeoLite2-Country.mmdb</code><br><span style="font-size: 13px; color: #646970;">Extract the .gz archive (<a href="https://cdn.jsdelivr.net/npm/geolite2-country/GeoLite2-Country.mmdb.gz" target="_blank">Download Archive</a> | <a href="https://github.com/wp-statistics/GeoLite2-Country" target="_blank">View Source Repo</a>)</span></li>';
        
        // 2. Reader
        echo '<li style="margin-bottom: 15px;">The extracted <code>MaxMind-DB-Reader-php</code> folder<br><span style="font-size: 13px; color: #646970;">Extract the GitHub zip (<a href="https://github.com/maxmind/MaxMind-DB-Reader-php/archive/refs/heads/main.zip" target="_blank">Download ZIP</a> | <a href="https://github.com/maxmind/MaxMind-DB-Reader-php" target="_blank">View Source</a>).<br><span style="color: #8a6d3b; font-weight: 600;">⚠️ Note:</span> The extracted folder is typically named <code>MaxMind-DB-Reader-php-main</code>. You must rename it to exactly <code>MaxMind-DB-Reader-php</code> in your FTP folder for this to work.</span></li>';
        
        // 3. index.php
        echo '<li style="margin-bottom: 15px;">An <code>index.php</code> file containing ONLY this exact line of code:<br>';
        echo '<code style="display:block; margin-top:5px; padding:10px; background:#f6f7f7; border-left: 3px solid #ccd0d4; color: #2271b1;">&lt;?php // Silence is golden.</code></li>';
        
        // 4. .htaccess
        echo '<li style="margin-bottom: 5px;">An <code>.htaccess</code> file containing exactly this block of code:<br>';
        echo '<pre style="margin-top:5px; padding:12px; background:#f6f7f7; border-left: 3px solid #ccd0d4; overflow-x:auto; font-size: 13px; color: #2c3338;"><code>&lt;IfModule mod_authz_core.c&gt;
    Require all denied
&lt;/IfModule&gt;
&lt;IfModule !mod_authz_core.c&gt;
    Order deny,allow
    Deny from all
&lt;/IfModule&gt;</code></pre></li>';
        
        echo '</ol></details></div>';
    }

    if ( $table_exists ) {
        // Get WordPress Timezone Data to calculate localized metrics from UNIX timestamps
        $tz = wp_timezone();
        $wp_offset_seconds = $tz->getOffset(new DateTime('now', new DateTimeZone('UTC')));
        
        // Calculate timestamp boundaries based on the local WordPress timezone
        $dt_today = new DateTime('today', $tz);
        $start_today = $dt_today->getTimestamp();
        $start_yesterday = $start_today - DAY_IN_SECONDS;
        $start_7d = $start_today - (6 * DAY_IN_SECONDS);
        $start_30d = $start_today - (29 * DAY_IN_SECONDS);

        // --- SUMMARY METRICS (Always Global) ---
        $metric_today = $wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT visitor_hash) FROM $table_name WHERE visit_timestamp >= %d", $start_today));
        $metric_yesterday = $wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT visitor_hash) FROM $table_name WHERE visit_timestamp >= %d AND visit_timestamp < %d", $start_yesterday, $start_today));
        
        // Grouping by localized day mathematically: FLOOR((timestamp + offset) / 86400)
        $metric_7d = $wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT CONCAT(visitor_hash, FLOOR((visit_timestamp + %d) / 86400))) FROM $table_name WHERE visit_timestamp >= %d", $wp_offset_seconds, $start_7d));
        $metric_30d = $wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT CONCAT(visitor_hash, FLOOR((visit_timestamp + %d) / 86400))) FROM $table_name WHERE visit_timestamp >= %d", $wp_offset_seconds, $start_30d));
        $metric_all = $wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT CONCAT(visitor_hash, FLOOR((visit_timestamp + %d) / 86400))) FROM $table_name", $wp_offset_seconds));

        echo '<div style="display: flex; gap: 15px; margin: 20px 0; flex-wrap: wrap;">';
        echo ai4pid_render_metric_card('Unique Today', $metric_today, '#007cba');
        echo ai4pid_render_metric_card('Unique Yesterday', $metric_yesterday, '#50575e');
        echo ai4pid_render_metric_card('Visitor-Days (7D)', $metric_7d, '#50575e');
        echo ai4pid_render_metric_card('Visitor-Days (30D)', $metric_30d, '#50575e');
        echo ai4pid_render_metric_card('Visitor-Days (All Time)', $metric_all, '#8c5f00');
        echo '</div>';

        // --- PERIOD SELECTOR FOR CHARTS AND TABLES ---
        $current_period = isset($_GET['period']) ? sanitize_text_field($_GET['period']) : '30';
        $period_label = 'Last 30 Days';
        $filter_timestamp = $start_30d;

        if ($current_period === '7') { $filter_timestamp = $start_7d; $period_label = 'Last 7 Days'; }
        elseif ($current_period === '90') { $filter_timestamp = $start_today - (89 * DAY_IN_SECONDS); $period_label = 'Last 90 Days'; }
        elseif ($current_period === 'all') { $filter_timestamp = 0; $period_label = 'All Time'; }

        echo '<form method="get" style="background: #fff; padding: 15px; border: 1px solid #ccd0d4; margin-bottom: 20px; display: flex; align-items: center; gap: 15px;">';
        echo '<input type="hidden" name="page" value="ai4pid-analytics">';
        echo '<strong><label for="ai4pid_period">Reporting Period:</label></strong>';
        echo '<select name="period" id="ai4pid_period" onchange="this.form.submit()">';
        echo '<option value="7" ' . selected($current_period, '7', false) . '>Last 7 Days</option>';
        echo '<option value="30" ' . selected($current_period, '30', false) . '>Last 30 Days</option>';
        echo '<option value="90" ' . selected($current_period, '90', false) . '>Last 90 Days</option>';
        echo '<option value="all" ' . selected($current_period, 'all', false) . '>All Time</option>';
        echo '</select>';
        echo '<noscript><button type="submit" class="button">Apply</button></noscript>';
        echo '</form>';

        // --- DAILY VISITS CHART (CSS ONLY) ---
        $daily_visits = $wpdb->get_results($wpdb->prepare("
            SELECT FLOOR((visit_timestamp + %d) / 86400) as day_id, COUNT(DISTINCT visitor_hash) as uniques
            FROM $table_name
            WHERE visit_timestamp >= %d
            GROUP BY day_id
            ORDER BY day_id ASC
        ", $wp_offset_seconds, $filter_timestamp));

        echo '<h3>Daily Unique Visitors (' . esc_html($period_label) . ')</h3>';
        
        if ( $daily_visits ) {
            $max_visits = 0;
            foreach ($daily_visits as $d) { if ($d->uniques > $max_visits) $max_visits = $d->uniques; }
            
            // Calculate Y-axis values (ensure max_visits is at least 2 to avoid division by zero)
            if ($max_visits < 2) $max_visits = 2; // Minimum 2 so the graph makes sense
            $mid_visits = ceil($max_visits / 2);

            // Adaptive X-Axis Logic: Detect if data spans multiple months or years
            $months = []; $years = [];
            foreach ($daily_visits as $d) {
                $ts = $d->day_id * 86400;
                $months[gmdate('m', $ts)] = true;
                $years[gmdate('Y', $ts)] = true;
            }
            $is_multi_year = count($years) > 1;
            $is_multi_month = count($months) > 1;
            
            if ($is_multi_year) { $x_label = 'Date (DD/MM/YY)'; } 
            elseif ($is_multi_month) { $x_label = 'Date (DD/MM)'; } 
            else { $x_label = 'Day (' . gmdate('F Y', $daily_visits[0]->day_id * 86400) . ')'; }
            
            // Global Wrapper to hold Axis Labels and Chart cleanly
            echo '<div style="font-family: sans-serif; margin-bottom: 30px;">';

            // Y-axis global label (Top Left)
            echo '<div style="font-size: 11px; font-weight: bold; color: #646970; margin-bottom: 8px;">Visits</div>';

            // Main Flex Container
            echo '<div style="display: flex; gap: 10px; height: 250px;">';
            
            // Left Column: Y-axis (Numbers)
            echo '<div style="display: flex; flex-direction: column; justify-content: space-between; text-align: right; color: #8c8f94; font-size: 11px; padding: 10px 0 25px 0; width: 30px;">';
            echo '<span>' . $max_visits . '</span><span>' . $mid_visits . '</span><span>0</span></div>';
            
            // Right Column: Graph Area Container
            echo '<div style="flex-grow: 1; background: #fff; display: flex; flex-direction: column; padding: 10px 10px 0 10px; overflow-x: auto; overflow-y: hidden; border: 1px solid #ccd0d4; border-bottom: 0;">';
            
                // Graph Track
                echo '<div style="flex-grow: 1; position: relative; display: flex; align-items: flex-end; gap: 4px;">';
                    // Horizontal reference lines (background)
                    echo '<div style="position: absolute; top: 0; left: 0; right: 0; border-top: 1px solid #e2e4e7; z-index: 1;"></div>'; // Line Top
                    echo '<div style="position: absolute; top: 50%; left: 0; right: 0; border-top: 1px dashed #dcdcde; z-index: 1;"></div>'; // Line Middle
                    echo '<div style="position: absolute; bottom: 0; left: 0; right: 0; border-top: 1px solid #8c8f94; z-index: 1;"></div>'; // Line Base (X-axis)

                    // Data bars
                    foreach ($daily_visits as $d) {
                        $ts = $d->day_id * 86400;
                        $local_date = gmdate('Y-m-d', $ts); 
                        $height = round(($d->uniques / $max_visits) * 100);
                        $title = esc_attr( $local_date . ': ' . $d->uniques . ' visits' );
                        // Apply the adaptive date format
                        $display_date = $is_multi_year ? gmdate('d/m/y', $ts) : ($is_multi_month ? gmdate('d/m', $ts) : gmdate('d', $ts));
                        
                        // Bar with hover effect and tooltip
                        echo "<div title=\"$title\" style=\"flex-grow: 1; min-width: 20px; max-width: 40px; background: #007cba; height: {$height}%; position: relative; border-radius: 2px 2px 0 0; z-index: 2; transition: opacity 0.2s;\" onmouseover=\"this.style.opacity='0.8'\" onmouseout=\"this.style.opacity='1'\">";
                        // Day label (X-axis)
                        echo "<span style=\"position: absolute; bottom: -22px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #8c8f94; white-space: nowrap;\">" . $display_date . "</span></div>";
                    }
                echo '</div>'; // End Graph Track
                // Spacer for X-axis labels
                echo '<div style="height: 45px; flex-shrink: 0; position: relative;">';
                    // X-axis global label (Bottom Left)
                    echo '<div style="position: absolute; bottom: 5px; left: 0; font-size: 11px; font-weight: bold; color: #646970;">' . esc_html($x_label) . '</div>';
                echo '</div>';
            echo '</div></div></div>'; // End Right Column Container, Main Flex Container, Global Wrapper
        } else {
            echo '<p>No data available for this period.</p>';
        }

        // --- DEVICE TYPES (CSS Pie Chart) ---
        $device_stats = $wpdb->get_row($wpdb->prepare("
            SELECT 
                SUM(is_mobile) as mobile_visits,
                COUNT(is_mobile) - SUM(is_mobile) as desktop_visits,
                COUNT(is_mobile) as total_visits
            FROM (
                SELECT MAX(CAST(is_mobile AS UNSIGNED)) as is_mobile
                FROM $table_name
                WHERE visit_timestamp >= %d
                GROUP BY CONCAT(visitor_hash, FLOOR((visit_timestamp + %d) / 86400))
            ) as daily_uniques
        ", $filter_timestamp, $wp_offset_seconds));

        $mobile = intval($device_stats->mobile_visits);
        $desktop = intval($device_stats->desktop_visits);
        $total = $mobile + $desktop;
        
        $mobile_pct = $total > 0 ? round(($mobile / $total) * 100, 1) : 0;
        $desktop_pct = $total > 0 ? round(($desktop / $total) * 100, 1) : 0;

        echo '<div style="background: #fff; padding: 20px; border: 1px solid #ccd0d4; display: flex; align-items: center; gap: 30px; margin-bottom: 20px;">';
        echo '<div><h4 style="margin: 0 0 15px 0; color: #646970;">Devices (' . esc_html($period_label) . ')</h4>';
        
        if ($total > 0) {
            // CSS Conic Gradient Pie Chart
            echo '<div style="width: 100px; height: 100px; border-radius: 50%; background: conic-gradient(#d63638 0% ' . $mobile_pct . '%, #007cba ' . $mobile_pct . '% 100%);"></div>';
            echo '</div>';
            
            // Legend
            echo '<div style="display: flex; flex-direction: column; gap: 10px;">';
            echo '<div style="display: flex; align-items: center; gap: 8px;"><div style="width: 12px; height: 12px; background: #d63638; border-radius: 2px;"></div> <strong>Mobile:</strong> ' . $mobile_pct . '% (' . $mobile . ')</div>';
            echo '<div style="display: flex; align-items: center; gap: 8px;"><div style="width: 12px; height: 12px; background: #007cba; border-radius: 2px;"></div> <strong>Desktop / Other:</strong> ' . $desktop_pct . '% (' . $desktop . ')</div>';
            echo '</div>';
        } else {
            echo '<p>No data yet.</p></div>';
        }
        echo '</div>';

        // --- TOP DOMAINS ---
        $unique_domains = $wpdb->get_results($wpdb->prepare("
            SELECT domain, COUNT(DISTINCT CONCAT(visitor_hash, FLOOR((visit_timestamp + %d) / 86400))) AS visits
            FROM $table_name
            WHERE visit_timestamp >= %d
            GROUP BY domain
            ORDER BY visits DESC
            LIMIT 10
        ", $wp_offset_seconds, $filter_timestamp));

        echo '<h3>Top Domains (' . esc_html($period_label) . ' Visitor-Days)</h3>';
        echo '<table class="wp-list-table widefat fixed striped">';
        echo '<thead><tr><th>Domain</th><th>Visitor-Days</th></tr></thead><tbody>';
        if ( $unique_domains ) {
            foreach ( $unique_domains as $row ) {
                echo '<tr><td><code>' . esc_html( $row->domain ) . '</code></td><td>' . intval( $row->visits ) . '</td></tr>';
            }
        } else { echo '<tr><td colspan="2">No data available.</td></tr>'; }
        echo '</tbody></table>';

        // --- TOP URLS ---
        $top_urls = $wpdb->get_results($wpdb->prepare("
            SELECT url, COUNT(DISTINCT CONCAT(visitor_hash, FLOOR((visit_timestamp + %d) / 86400))) as visits
            FROM $table_name
            WHERE visit_timestamp >= %d
            GROUP BY url
            ORDER BY visits DESC
            LIMIT 15
        ", $wp_offset_seconds, $filter_timestamp));

        echo '<h3>Top URLs (' . esc_html($period_label) . ' Visitor-Days)</h3>';
        echo '<table class="wp-list-table widefat fixed striped" style="margin-bottom: 30px;">';
        echo '<thead><tr><th>Normalized URL</th><th>Visitor-Days</th></tr></thead><tbody>';
        if ( $top_urls ) {
            foreach ( $top_urls as $row ) {
                echo '<tr><td><code>' . esc_html( $row->url ) . '</code></td><td>' . intval( $row->visits ) . '</td></tr>';
            }
        } else { echo '<tr><td colspan="2">No data available.</td></tr>'; }
        echo '</tbody></table>';

        // --- TOP COUNTRIES ---
        $top_countries = $wpdb->get_results($wpdb->prepare("
            SELECT country, COUNT(DISTINCT CONCAT(visitor_hash, FLOOR((visit_timestamp + %d) / 86400))) as visits
            FROM $table_name
            WHERE visit_timestamp >= %d AND country IS NOT NULL
            GROUP BY country
            ORDER BY visits DESC
            LIMIT 10
        ", $wp_offset_seconds, $filter_timestamp));

        echo '<h3>Top Countries (' . esc_html($period_label) . ' Visitor-Days)</h3>';
        echo '<table class="wp-list-table widefat fixed striped" style="margin-bottom: 30px;">';
        echo '<thead><tr><th>Country</th><th>Visitor-Days</th></tr></thead><tbody>';
        if ( $top_countries ) {
            foreach ( $top_countries as $row ) {
                $code = strtolower($row->country);
                $upper_code = strtoupper($code);
                
                // 1. Get Country Name
                $country_name = ai4pid_get_country_name($upper_code);

                // 2. SVG Flag Caching Logic
                $flag_filename = esc_attr($code) . '.svg';
                $local_flag_path = AI4PID_ANALYTICS_GEOIP_FLAGS_DIR . '/' . $flag_filename;
                $local_flag_url = content_url(AI4PID_ANALYTICS_GEOIP_FLAGS_CONTENT_DIR . '/' . $flag_filename);
                $cdn_flag_url = 'https://flagcdn.com/' . esc_attr($code) . '.svg';
                
                $final_flag_url = $cdn_flag_url; // Default fallback

                // Override parent .htaccess to allow public access to the SVGs
                $flags_htaccess_file = AI4PID_ANALYTICS_GEOIP_FLAGS_DIR . '/.htaccess';
                if (!file_exists($flags_htaccess_file)) {
                    $htaccess_content = "<IfModule mod_authz_core.c>\n    Require all granted\n</IfModule>\n<IfModule !mod_authz_core.c>\n    Order allow,deny\n    Allow from all\n</IfModule>\n";
                    file_put_contents($flags_htaccess_file, $htaccess_content);
                }

                // Check and download if missing
                if (!file_exists($local_flag_path)) {
                    if (!file_exists(AI4PID_ANALYTICS_GEOIP_FLAGS_DIR)) { 
                        wp_mkdir_p(AI4PID_ANALYTICS_GEOIP_FLAGS_DIR);
                    }
                    // Fetch from CDN with a fast 2-second timeout so the dashboard never hangs
                    $response = wp_remote_get($cdn_flag_url, ['timeout' => 2]);
                    if (!is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200) {
                        file_put_contents($local_flag_path, wp_remote_retrieve_body($response));
                        $final_flag_url = $local_flag_url;
                    }
                } else {
                    $final_flag_url = $local_flag_url;
                }

                echo '<tr>';
                echo '<td>';
                echo '<div style="display: flex; align-items: center; gap: 10px;">';
                echo '<img src="' . esc_url($final_flag_url) . '" width="24" alt="' . $upper_code . ' Flag" style="border-radius: 2px; box-shadow: 0 0 2px rgba(0,0,0,0.3); height: auto;">';
                echo '<span><strong>' . esc_html($country_name) . '</strong> <span style="color: #646970; font-size: 12px;">(' . $upper_code . ')</span></span>';
                echo '</div>';
                echo '</td>';
                echo '<td>' . intval( $row->visits ) . '</td>';
                echo '</tr>';
            }
        } else { echo '<tr><td colspan="2">No data available or GeoIP not active.</td></tr>'; }
        echo '</tbody></table>';

        // Markdown Export (Passing all summary metrics and period details)
        $summary_metrics = [
            'today' => $metric_today,
            'yesterday' => $metric_yesterday,
            '7d' => $metric_7d,
            '30d' => $metric_30d,
            'all' => $metric_all,
            'mobile_pct' => $mobile_pct,
            'desktop_pct' => $desktop_pct,
            'mobile' => $mobile,
            'desktop' => $desktop,
        ];
        ai4pid_render_markdown_export_ui($table_name, $wp_offset_seconds, $filter_timestamp, $period_label, $summary_metrics);

    } else {
        echo '<div class="notice notice-warning inline"><p>⚠️ The data table does not exist yet. Initialize it using the settings below.</p></div>';
    }

    // --- SYSTEM CONTROLS ---
    echo '<hr style="margin: 40px 0;"><h2 style="color:#d63638">System Controls</h2>';
    echo '<div style="display: flex; flex-wrap: wrap; gap: 20px;">';
    
    // Setup
    echo '<form method="post" style="flex: 1; min-width: 250px; background: #fff; padding: 15px; border: 1px solid #ccd0d4;">';
    echo '<h4>1. Initialize / Upgrade Schema</h4>';
    echo '<p style="font-size: 13px; color: #646970;">Creates the table or upgrades indexes/columns safely without deleting data.</p>';
    wp_nonce_field( 'ai4pid_analytics_setup', 'ai4pid_analytics_nonce' );
    submit_button( 'Initialize System', 'primary', 'ai4pid_analytics_setup_submit', false );
    echo '</form>';

    // Clear
    echo '<form method="post" style="flex: 1; min-width: 250px; background: #fffdf0; padding: 15px; border: 1px solid #f0b849;">';
    echo '<h4 style="color: #a17000;">2. Clear Analytics Data</h4>';
    echo '<p style="font-size: 13px; color: #646970;">Deletes all rows but preserves the database table structure. Type <strong>CLEAR</strong> below to confirm.</p>';
    echo '<input type="text" name="clear_confirm_text" placeholder="Type CLEAR" style="margin-bottom: 10px; display: block; width: 100%;">';
    wp_nonce_field( 'ai4pid_analytics_clear', 'ai4pid_analytics_nonce' );
    submit_button( 'Clear All Data', 'secondary', 'ai4pid_analytics_clear_submit', false, ['style' => 'color: #8c5f00; border-color: #f0b849;'] );
    echo '</form>';

    // Destroy
    echo '<form method="post" style="flex: 1; min-width: 250px; background: #fcf0f1; padding: 15px; border: 1px solid #d63638;">';
    echo '<h4 style="color: #d63638;">3. Destroy Analytics Table</h4>';
    echo '<p style="font-size: 13px; color: #646970;">Completely deletes the table and all data. Type <strong>DESTROY</strong> below to confirm.</p>';
    echo '<input type="text" name="destroy_confirm_text" placeholder="Type DESTROY" style="margin-bottom: 10px; display: block; width: 100%;">';
    wp_nonce_field( 'ai4pid_analytics_destroy', 'ai4pid_analytics_nonce' );
    submit_button( 'Drop Table', 'secondary', 'ai4pid_analytics_destroy_submit', false, ['style' => 'color: #d63638; border-color: #d63638;'] );
    echo '</form>';
    
    echo '</div></div>'; // End flex controls and wrap
}

// Helper: Render Metric Card
function ai4pid_render_metric_card($label, $value, $color) {
    return '
    <div style="flex: 1; min-width: 150px; background: #fff; padding: 20px; border-left: 4px solid '.esc_attr($color).'; border-radius: 3px; box-shadow: 0 1px 1px rgba(0,0,0,.04);">
        <h4 style="margin: 0 0 10px 0; color: #646970; font-weight: 500;">'.esc_html($label).'</h4>
        <div style="font-size: 28px; font-weight: 600; color: #1d2327;">'.intval($value).'</div>
    </div>';
}

// Helper: Get Country Name from Code
function ai4pid_get_country_name($country_code) {
    $country_code = strtoupper($country_code);
    if (class_exists('Locale')) {
        return \Locale::getDisplayRegion('-' . $country_code, 'en');
    } else {
        // Fallback for common countries
        $fallbacks = ['ES'=>'Spain','FR'=>'France','DE'=>'Germany','IT'=>'Italy','PT'=>'Portugal','HR'=>'Croatia','US'=>'United States','GB'=>'United Kingdom'];
        return isset($fallbacks[$country_code]) ? $fallbacks[$country_code] : $country_code;
    }
}

// Render the Markdown Export Box
function ai4pid_render_markdown_export_ui($table_name, $wp_offset, $filter_timestamp, $period_label, $metrics) {
    global $wpdb;

    $md = "### 📊 Analytics Export (" . wp_date('Y-m-d H:i') . ")\n\n";
    
    // Add Summary Metrics to Markdown
    $md .= "### Summary Metrics\n";
    $md .= "- **Unique Visitors Today:** " . intval($metrics['today']) . "\n";
    $md .= "- **Unique Visitors Yesterday:** " . intval($metrics['yesterday']) . "\n";
    $md .= "- **Visitor-Days (Last 7 Days):** " . intval($metrics['7d']) . "\n";
    $md .= "- **Visitor-Days (Last 30 Days):** " . intval($metrics['30d']) . "\n";
    $md .= "- **Visitor-Days (All Time):** " . intval($metrics['all']) . "\n\n";
    $md .= "- **Mobile Visits:** " . $metrics['mobile_pct'] . "% (" . $metrics['mobile'] . ")\n";
    $md .= "- **Desktop / Other Visits:** " . $metrics['desktop_pct'] . "% (" . $metrics['desktop'] . ")\n\n";

    $daily_visits = $wpdb->get_results($wpdb->prepare("SELECT FLOOR((visit_timestamp + %d) / 86400) as day_id, COUNT(DISTINCT visitor_hash) as uniques FROM $table_name WHERE visit_timestamp >= %d GROUP BY day_id ORDER BY day_id ASC", $wp_offset, $filter_timestamp));
    $md .= "### Daily Unique Visitors ({$period_label})\n";
    $md .= "| Date | Unique Visits |\n|---|---|\n";
    if ($daily_visits) {
        foreach ($daily_visits as $day) { $md .= "| " . gmdate('Y-m-d', $day->day_id * 86400) . " | " . intval($day->uniques) . " |\n"; }
    }
    $md .= "\n";

    $top_urls = $wpdb->get_results($wpdb->prepare("SELECT url, COUNT(DISTINCT CONCAT(visitor_hash, FLOOR((visit_timestamp + %d) / 86400))) as uniques FROM $table_name WHERE visit_timestamp >= %d GROUP BY url ORDER BY uniques DESC LIMIT 15", $wp_offset, $filter_timestamp));
    $md .= "### Top URLs ({$period_label} Visitor-Days)\n";
    $md .= "| URL | Visitor-Days |\n|---|---|\n";
    if ($top_urls) {
        foreach ($top_urls as $url_row) { $md .= "| {$url_row->url} | " . intval($url_row->uniques) . " |\n"; }
    }
    $md .= "\n";

    $top_countries = $wpdb->get_results($wpdb->prepare("SELECT country, COUNT(DISTINCT CONCAT(visitor_hash, FLOOR((visit_timestamp + %d) / 86400))) as uniques FROM $table_name WHERE visit_timestamp >= %d AND country IS NOT NULL GROUP BY country ORDER BY uniques DESC LIMIT 10", $wp_offset, $filter_timestamp));
    
    $md .= "### Top Countries ({$period_label} Visitor-Days)\n";
    $md .= "| Country | Country Code | Visitor-Days |\n|---|---|---|\n";
    if ($top_countries) {
        foreach ($top_countries as $c_row) { $md .= "| " . ai4pid_get_country_name($c_row->country) . " | " . strtoupper($c_row->country) . " | " . intval($c_row->uniques) . " |\n"; }
    }

    ?>
    <div style="margin-top: 2rem; background: #fff; padding: 1.5rem; border: 1px solid #ccd0d4;">
        <h2 style="margin-top: 0;">Export to Markdown</h2>
        <textarea id="ai4pid-md-export" style="width: 100%; height: 250px; font-family: monospace; background: #f0f0f1; padding: 1rem;" readonly><?php echo esc_textarea($md); ?></textarea>
        <div style="margin-top: 1rem;">
            <button type="button" class="button button-primary" onclick="copyAnalyticsMD()">Copy to Clipboard</button>
            <span id="ai4pid-copy-feedback" style="color: #00a32a; margin-left: 10px; display: none;">✓ Copied!</span>
        </div>
        <script>
        function copyAnalyticsMD() {
            const copyText = document.getElementById("ai4pid-md-export");
            copyText.select();
            navigator.clipboard.writeText(copyText.value).then(() => {
                const f = document.getElementById("ai4pid-copy-feedback");
                f.style.display = "inline"; setTimeout(() => f.style.display = "none", 2500);
            });
        }
        </script>
    </div>
    <?php
}

// Render the GeoIP Setup Wizard Page
function ai4pid_render_geoip_setup_page() {
    echo '<div class="wrap">';
    
    echo '<div style="margin-bottom: 15px;"><a href="' . esc_url(admin_url('admin.php?page=ai4pid-analytics')) . '" class="button">← Back to Dashboard</a></div>';
    echo '<h1 style="margin-top: 0;">GeoIP Setup Wizard</h1>';
    
    echo '<p style="font-size: 14px; max-width: 800px; color: #3c434a;">Upload the required files to enable local, GDPR-compliant country tracking. This wizard will automatically extract the files, create the secure directory (<code>wp-content/uploads/ai4pid-geoip/</code>), and generate the required <code>.htaccess</code> and <code>index.php</code> files to block public access.</p>';

    echo '<form method="post" enctype="multipart/form-data" action="' . esc_url(admin_url('admin.php?page=ai4pid-analytics')) . '">';
    wp_nonce_field( 'ai4pid_geoip_setup', 'ai4pid_geoip_nonce' );

    echo '<div style="display: flex; gap: 20px; flex-wrap: wrap; margin-top: 20px;">';

    // Left Column: MaxMind Reader
    echo '<div style="flex: 1; min-width: 300px; padding: 20px; border: 2px dashed #ccd0d4; background: #fff; text-align: center;">';
    echo '<h3 style="margin-top: 0;">1. MaxMind DB Reader (PHP)</h3>';
    echo '<p style="font-size: 13px; color: #646970;">The pure PHP library required to read the binary database.</p>';
    
    echo '<div style="margin-bottom: 15px; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">';
    echo '<a href="https://github.com/maxmind/MaxMind-DB-Reader-php/archive/refs/heads/main.zip" target="_blank" class="button button-primary">Download GitHub ZIP</a>';
    echo '<a href="https://github.com/maxmind/MaxMind-DB-Reader-php" target="_blank" class="button">View Source</a>';
    echo '</div>';
    
    echo '<div style="text-align: left; background: #f6f7f7; padding: 10px; border: 1px solid #dcdcde;">';
    echo '<label style="font-weight: 600; display: block; margin-bottom: 5px;">Upload the raw .zip file:</label>';
    echo '<input type="file" name="reader_zip" accept=".zip" required>';
    echo '</div>';
    echo '</div>';

    // Right Column: GeoLite2 Country DB
    echo '<div style="flex: 1; min-width: 300px; padding: 20px; border: 2px dashed #ccd0d4; background: #fff; text-align: center;">';
    echo '<h3 style="margin-top: 0;">2. GeoLite2 Country Database</h3>';
    echo '<p style="font-size: 13px; color: #646970;">The geolocation mapping file (provided via jsDelivr CDN).</p>';
    
    echo '<div style="margin-bottom: 15px; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">';
    echo '<a href="https://cdn.jsdelivr.net/npm/geolite2-country/GeoLite2-Country.mmdb.gz" target="_blank" class="button button-primary">Download .gz Archive</a>';
    echo '<a href="https://github.com/wp-statistics/GeoLite2-Country" target="_blank" class="button">View Source Repo</a>';
    echo '</div>';
    
    echo '<div style="text-align: left; background: #fcf9e8; padding: 10px; border: 1px solid #f0c33c;">';
    echo '<p style="margin-top: 0; font-size: 12px; font-weight: 600; color: #8a6d3b;">⚠️ Important: You must extract the .gz file on your computer first.</p>';
    echo '<label style="font-weight: 600; display: block; margin-bottom: 5px;">Upload the extracted .mmdb file:</label>';
    echo '<input type="file" name="mmdb_file" accept=".mmdb" required>';
    echo '</div>';
    echo '</div>';

    echo '</div>'; // End flex container

    echo '<div style="margin-top: 30px;">';
    submit_button( 'Initialize GeoIP Module', 'primary large', 'ai4pid_geoip_setup_submit', false );
    echo '</div>';
    echo '</form></div>';
}