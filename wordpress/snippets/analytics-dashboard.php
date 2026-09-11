<?php
// Configuration Constants
define( 'AI4PID_ANALYTICS_TABLE_NAME', 'ai4pid_analytics_daily_visits' );

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

// Handle Form Submissions securely via POST-Redirect-GET pattern (prevents F5 resubmission)
add_action( 'admin_init', 'ai4pid_analytics_process_actions' );

function ai4pid_analytics_process_actions() {
    if ( ! isset( $_GET['page'] ) || $_GET['page'] !== 'ai4pid-analytics' ) return;
    if ( ! current_user_can( 'manage_options' ) ) return;
    if ( $_SERVER['REQUEST_METHOD'] !== 'POST' ) return;

    global $wpdb;
    $table_name = $wpdb->prefix . AI4PID_ANALYTICS_TABLE_NAME;
    $base_url = admin_url( 'admin.php?page=ai4pid-analytics' );

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
            visit_timestamp bigint(20) unsigned NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY unique_hash_url (visitor_hash, url),
            KEY timestamp_idx (visit_timestamp),
            KEY domain_idx (domain)
        ) $charset_collate;";

        dbDelta( $sql );

        // Migration step 1: Populate empty domains for older records
        $wpdb->query("UPDATE $table_name SET domain = SUBSTRING_INDEX(SUBSTRING_INDEX(url, '://', -1), '/', 1) WHERE domain = ''");
        
        // Migration step 2: Convert old visit_date and visit_time to the new visit_timestamp (dbDelta keeps old columns, so we can read them)
        // This fixes old rows having a timestamp of '0' (1970) which excluded them from "Last 30 Days" queries.
        $wpdb->query("UPDATE $table_name SET visit_timestamp = UNIX_TIMESTAMP(CONCAT(visit_date, ' ', visit_time)) WHERE visit_timestamp = 0 AND visit_date IS NOT NULL");

        wp_safe_redirect( add_query_arg( 'msg', 'initialized', $base_url ) );
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
        wp_safe_redirect( add_query_arg( 'msg', $msg, $base_url ) );
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
        wp_safe_redirect( add_query_arg( 'msg', $msg, $base_url ) );
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
        if ( $msg === 'destroy_mismatch' ) echo '<div class="notice notice-error is-dismissible"><p>❌ Destruction aborted: You must type DESTROY in uppercase.</p></div>';
        if ( $msg === 'clear_mismatch' ) echo '<div class="notice notice-error is-dismissible"><p>❌ Clear aborted: You must type CLEAR in uppercase.</p></div>';
        if ( $msg === 'error' ) echo '<div class="notice notice-error is-dismissible"><p>❌ A database error occurred. Check logs if WP_DEBUG is enabled.</p></div>';
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

        // --- SUMMARY METRICS ---
        $metric_today = $wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT visitor_hash) FROM $table_name WHERE visit_timestamp >= %d", $start_today));
        $metric_yesterday = $wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT visitor_hash) FROM $table_name WHERE visit_timestamp >= %d AND visit_timestamp < %d", $start_yesterday, $start_today));
        
        // Grouping by localized day mathematically: FLOOR((timestamp + offset) / 86400)
        $metric_7d = $wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT CONCAT(visitor_hash, FLOOR((visit_timestamp + %d) / 86400))) FROM $table_name WHERE visit_timestamp >= %d", $wp_offset_seconds, $start_7d));
        $metric_30d = $wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT CONCAT(visitor_hash, FLOOR((visit_timestamp + %d) / 86400))) FROM $table_name WHERE visit_timestamp >= %d", $wp_offset_seconds, $start_30d));

        echo '<div style="display: flex; gap: 15px; margin: 20px 0;">';
        echo ai4pid_render_metric_card('Unique Visitors Today', $metric_today, '#007cba');
        echo ai4pid_render_metric_card('Unique Visitors Yesterday', $metric_yesterday, '#50575e');
        echo ai4pid_render_metric_card('Unique Visitor-Days (Last 7D)', $metric_7d, '#50575e');
        echo ai4pid_render_metric_card('Unique Visitor-Days (Last 30D)', $metric_30d, '#50575e');
        echo '</div>';

        // --- DAILY VISITS CHART (CSS ONLY) & TABLE ---
        $daily_visits = $wpdb->get_results($wpdb->prepare("
            SELECT 
                FLOOR((visit_timestamp + %d) / 86400) as day_id, 
                COUNT(DISTINCT visitor_hash) as uniques
            FROM $table_name
            WHERE visit_timestamp >= %d
            GROUP BY day_id
            ORDER BY day_id ASC
        ", $wp_offset_seconds, $start_30d));

        echo '<h3>Daily Unique Visitors (Last 30 Days)</h3>';
        
        if ( $daily_visits ) {
            $max_visits = 0;
            foreach ($daily_visits as $d) { if ($d->uniques > $max_visits) $max_visits = $d->uniques; }
            
            // Calculate Y-axis values (ensure max_visits is at least 2 to avoid division by zero)
            if ($max_visits < 2) $max_visits = 2; // Minimum 2 so the graph makes sense
            $mid_visits = ceil($max_visits / 2);

            // Adaptive X-Axis Logic: Detect if data spans multiple months or years
            $months = [];
            $years = [];
            foreach ($daily_visits as $d) {
                $ts = $d->day_id * 86400;
                $months[gmdate('m', $ts)] = true;
                $years[gmdate('Y', $ts)] = true;
            }
            
            $is_multi_year = count($years) > 1;
            $is_multi_month = count($months) > 1;
            
            if ($is_multi_year) {
                $x_label = 'Date (DD/MM/YY)';
            } elseif ($is_multi_month) {
                $x_label = 'Date (DD/MM)';
            } else {
                $month_name = gmdate('F Y', $daily_visits[0]->day_id * 86400); 
                $x_label = 'Day (' . $month_name . ')';
            }
            
            // Global Wrapper to hold Axis Labels and Chart cleanly
            echo '<div style="font-family: sans-serif; margin-bottom: 30px;">';

            // Y-axis global label (Top Left)
            echo '<div style="font-size: 11px; font-weight: bold; color: #646970; margin-bottom: 8px;">Visits</div>';

            // Main Flex Container
            echo '<div style="display: flex; gap: 10px; height: 250px;">';
            
            // Left Column: Y-axis (Numbers)
            echo '<div style="display: flex; flex-direction: column; justify-content: space-between; text-align: right; color: #8c8f94; font-size: 11px; padding: 10px 0 25px 0; width: 30px;">';
            echo '<span>' . $max_visits . '</span>';
            echo '<span>' . $mid_visits . '</span>';
            echo '<span>0</span>';
            echo '</div>';
            
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
                        if ($is_multi_year) {
                            $display_date = gmdate('d/m/y', $ts);
                        } elseif ($is_multi_month) {
                            $display_date = gmdate('d/m', $ts);
                        } else {
                            $display_date = gmdate('d', $ts);
                        }
                        
                        // Bar
                        echo "<div title=\"$title\" style=\"flex-grow: 1; min-width: 20px; max-width: 40px; background: #007cba; height: {$height}%; position: relative; border-radius: 2px 2px 0 0; z-index: 2; transition: opacity 0.2s;\" onmouseover=\"this.style.opacity='0.8'\" onmouseout=\"this.style.opacity='1'\">";
                        // Day label (X-axis)
                        echo "<span style=\"position: absolute; bottom: -22px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #8c8f94; white-space: nowrap;\">" . $display_date . "</span>";
                        echo "</div>";
                    }
                
                echo '</div>'; // End Graph Track

                // Spacer for X-axis labels
                echo '<div style="height: 45px; flex-shrink: 0; position: relative;">';
                    // X-axis global label (Bottom Left)
                    echo '<div style="position: absolute; bottom: 5px; left: 0; font-size: 11px; font-weight: bold; color: #646970;">' . esc_html($x_label) . '</div>';
                echo '</div>';

            echo '</div>'; // End Right Column Container
            echo '</div>'; // End Main Flex Container
            echo '</div>'; // End Global Wrapper
        }

        // --- TOP DOMAINS ---
        $unique_domains = $wpdb->get_results($wpdb->prepare("
            SELECT domain, COUNT(DISTINCT CONCAT(visitor_hash, FLOOR((visit_timestamp + %d) / 86400))) AS visits
            FROM $table_name
            GROUP BY domain
            ORDER BY visits DESC
            LIMIT 10
        ", $wp_offset_seconds));

        echo '<h3>Top Domains (All Time Visitor-Days)</h3>';
        echo '<table class="wp-list-table widefat fixed striped">';
        echo '<thead><tr><th>Domain</th><th>Visitor-Days</th></tr></thead><tbody>';
        if ( $unique_domains ) {
            foreach ( $unique_domains as $row ) {
                echo '<tr><td><code>' . esc_html( $row->domain ) . '</code></td><td>' . intval( $row->visits ) . '</td></tr>';
            }
        } else {
            echo '<tr><td colspan="2">No data available.</td></tr>';
        }
        echo '</tbody></table>';

        // --- TOP URLS ---
        $top_urls = $wpdb->get_results($wpdb->prepare("
            SELECT url, COUNT(DISTINCT CONCAT(visitor_hash, FLOOR((visit_timestamp + %d) / 86400))) as visits
            FROM $table_name
            WHERE visit_timestamp >= %d
            GROUP BY url
            ORDER BY visits DESC
            LIMIT 10
        ", $wp_offset_seconds, $start_30d));

        echo '<h3>Top URLs (Last 30 Days Visitor-Days)</h3>';
        echo '<table class="wp-list-table widefat fixed striped" style="margin-bottom: 30px;">';
        echo '<thead><tr><th>Normalized URL</th><th>Visitor-Days</th></tr></thead><tbody>';
        if ( $top_urls ) {
            foreach ( $top_urls as $row ) {
                echo '<tr><td><code>' . esc_html( $row->url ) . '</code></td><td>' . intval( $row->visits ) . '</td></tr>';
            }
        } else {
            echo '<tr><td colspan="2">No data available.</td></tr>';
        }
        echo '</tbody></table>';

        // Markdown Export
        ai4pid_render_markdown_export_ui($table_name, $wp_offset_seconds, $start_30d);

    } else {
        echo '<div class="notice notice-warning inline"><p>⚠️ The data table does not exist yet. Initialize it using the settings below.</p></div>';
    }

    // --- SYSTEM CONTROLS (Always at the bottom) ---
    echo '<hr style="margin: 40px 0;"><h2 style="color:#d63638">System Controls</h2>';
    echo '<div style="display: flex; flex-wrap: wrap; gap: 20px;">';

    // INIT Form
    echo '<form method="post" style="flex: 1; min-width: 250px; background: #fff; padding: 15px; border: 1px solid #ccd0d4;">';
    echo '<h4>1. Initialize / Upgrade Schema</h4>';
    echo '<p style="font-size: 13px; color: #646970;">Creates the table or upgrades indexes/columns safely without deleting data.</p>';
    wp_nonce_field( 'ai4pid_analytics_setup', 'ai4pid_analytics_nonce' );
    submit_button( 'Initialize System', 'primary', 'ai4pid_analytics_setup_submit', false );
    echo '</form>';

    // CLEAR Form
    echo '<form method="post" style="flex: 1; min-width: 250px; background: #fffdf0; padding: 15px; border: 1px solid #f0b849;">';
    echo '<h4 style="color: #a17000;">2. Clear Analytics Data</h4>';
    echo '<p style="font-size: 13px; color: #646970;">Deletes all rows but preserves the database table structure. Type <strong>CLEAR</strong> below to confirm.</p>';
    echo '<input type="text" name="clear_confirm_text" placeholder="Type CLEAR" style="margin-bottom: 10px; display: block; width: 100%;">';
    wp_nonce_field( 'ai4pid_analytics_clear', 'ai4pid_analytics_nonce' );
    submit_button( 'Clear All Data', 'secondary', 'ai4pid_analytics_clear_submit', false, ['style' => 'color: #8c5f00; border-color: #f0b849;'] );
    echo '</form>';

    // DESTROY Form
    echo '<form method="post" style="flex: 1; min-width: 250px; background: #fcf0f1; padding: 15px; border: 1px solid #d63638;">';
    echo '<h4 style="color: #d63638;">3. Destroy Analytics Table</h4>';
    echo '<p style="font-size: 13px; color: #646970;">Completely deletes the table and all data. Type <strong>DESTROY</strong> below to confirm.</p>';
    echo '<input type="text" name="destroy_confirm_text" placeholder="Type DESTROY" style="margin-bottom: 10px; display: block; width: 100%;">';
    wp_nonce_field( 'ai4pid_analytics_destroy', 'ai4pid_analytics_nonce' );
    submit_button( 'Drop Table', 'secondary', 'ai4pid_analytics_destroy_submit', false, ['style' => 'color: #d63638; border-color: #d63638;'] );
    echo '</form>';
    
    echo '</div>'; // End flex controls
    echo '</div>'; // End wrap
}

// Helper: Render Metric Card
function ai4pid_render_metric_card($label, $value, $color) {
    return '
    <div style="flex: 1; background: #fff; padding: 20px; border-left: 4px solid '.esc_attr($color).'; border-radius: 3px; box-shadow: 0 1px 1px rgba(0,0,0,.04);">
        <h4 style="margin: 0 0 10px 0; color: #646970; font-weight: 500;">'.esc_html($label).'</h4>
        <div style="font-size: 28px; font-weight: 600; color: #1d2327;">'.intval($value).'</div>
    </div>';
}

// Render the Markdown Export Box
function ai4pid_render_markdown_export_ui($table_name, $wp_offset, $start_30d) {
    global $wpdb;

    $md = "### 📊 Analytics Export (" . wp_date('Y-m-d H:i') . ")\n\n";
    
    $daily_visits = $wpdb->get_results($wpdb->prepare("SELECT FLOOR((visit_timestamp + %d) / 86400) as day_id, COUNT(DISTINCT visitor_hash) as uniques FROM $table_name WHERE visit_timestamp >= %d GROUP BY day_id ORDER BY day_id ASC", $wp_offset, $start_30d));
    $md .= "**Daily Unique Visitors (Last 30 Days)**\n";
    $md .= "| Date | Unique Visits |\n|---|---|\n";
    if ($daily_visits) {
        foreach ($daily_visits as $day) { $md .= "| " . gmdate('Y-m-d', $day->day_id * 86400) . " | " . intval($day->uniques) . " |\n"; }
    }
    $md .= "\n";

    $top_urls = $wpdb->get_results($wpdb->prepare("SELECT url, COUNT(DISTINCT CONCAT(visitor_hash, FLOOR((visit_timestamp + %d) / 86400))) as uniques FROM $table_name WHERE visit_timestamp >= %d GROUP BY url ORDER BY uniques DESC LIMIT 15", $wp_offset, $start_30d));
    $md .= "**Top URLs (Last 30 Days Visitor-Days)**\n";
    $md .= "| URL | Visitor-Days |\n|---|---|\n";
    if ($top_urls) {
        foreach ($top_urls as $url_row) { $md .= "| {$url_row->url} | " . intval($url_row->uniques) . " |\n"; }
    }

    ?>
    <div style="margin-top: 2rem; background: #fff; padding: 1.5rem; border: 1px solid #ccd0d4;">
        <h2 style="margin-top: 0;">Export to Markdown</h2>
        <textarea id="ai4pid-md-export" style="width: 100%; height: 200px; font-family: monospace; background: #f0f0f1; padding: 1rem;" readonly><?php echo esc_textarea($md); ?></textarea>
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