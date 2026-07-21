<?php
// Configuration Constants
define( 'AI4PID_ANALYTICS_TABLE_NAME', 'ai4pid_analytics_daily_visits' );

define( 'AI4PID_ANALYTICS_SETUP_ACTION', 'ai4pid_analytics_setup_action' );
define( 'AI4PID_ANALYTICS_SETUP_NONCE', 'ai4pid_analytics_setup_nonce' );
define( 'AI4PID_ANALYTICS_CLEAR_ACTION', 'ai4pid_analytics_clear_action' );
define( 'AI4PID_ANALYTICS_CLEAR_NONCE', 'ai4pid_analytics_clear_nonce' );
define( 'AI4PID_ANALYTICS_DESTROY_ACTION', 'ai4pid_analytics_destroy_action' );
define( 'AI4PID_ANALYTICS_DESTROY_NONCE', 'ai4pid_analytics_destroy_nonce' );

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

// Render the page and handle the button logic
function ai4pid_analytics_admin_page() {
    // Security check
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    global $wpdb;
    $table_name = $wpdb->prefix . AI4PID_ANALYTICS_TABLE_NAME;
    $message = '';

    // 1. Handle INIT button press securely via nonces
    if ( isset( $_POST['ai4pid_analytics_setup_submit'] ) && check_admin_referer( AI4PID_ANALYTICS_SETUP_ACTION, AI4PID_ANALYTICS_SETUP_NONCE ) ) {

        $sql_table = "CREATE TABLE IF NOT EXISTS $table_name (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            visitor_hash varchar(64) NOT NULL,
            url varchar(255) NOT NULL,
            visit_date date NOT NULL,
            visit_time time NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY unique_daily_visit (visitor_hash, url, visit_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

        $wpdb->query($sql_table);
        $message = '<div class="notice notice-success is-dismissible"><p>✅ Table verified/created successfully.</p></div>';
    }

    // 1.1 Handle CLEAR button press securely via nonces
    if ( isset( $_POST['ai4pid_analytics_clear_submit'] ) && check_admin_referer( AI4PID_ANALYTICS_CLEAR_ACTION, AI4PID_ANALYTICS_CLEAR_NONCE ) ) {
        $wpdb->query("TRUNCATE TABLE $table_name");
        $message = '<div class="notice notice-success is-dismissible"><p>🧹 All analytics data cleared successfully.</p></div>';
    }

    // 1.2 Handle DESTROY button press securely via nonces
    if ( isset( $_POST['ai4pid_analytics_destroy_submit'] ) && check_admin_referer( AI4PID_ANALYTICS_DESTROY_ACTION, AI4PID_ANALYTICS_DESTROY_NONCE ) ) {
        $wpdb->query("DROP TABLE IF EXISTS $table_name");
        $message = '<div class="notice notice-success is-dismissible"><p>💥 Analytics table destroyed successfully.</p></div>';
    }

    // 2. Check if the table exists to prevent SQL errors on fresh installs
    $table_exists = ( $wpdb->get_var( "SHOW TABLES LIKE '$table_name'" ) === $table_name );

    // 3. Render the UI
    echo '<div class="wrap">';
    echo '<h1>AI4PID Unique Visits Analytics</h1>';

    echo $message;

    // Initialization button form
    echo '<form method="post" style="margin: 20px 0; background: #fff; padding: 15px; border: 1px solid #ccd0d4;">';
    echo '<p style="margin-top:0">Use this button to set up the database table for the first time. It is safe to click it multiple times; it will not delete existing data.</p>';
    wp_nonce_field( AI4PID_ANALYTICS_SETUP_ACTION, AI4PID_ANALYTICS_SETUP_NONCE );
    submit_button( 'Initialize System', 'primary', 'ai4pid_analytics_setup_submit', false );
    echo '</form>';

    // Clear data button form (with confirmation prompt)
    echo '<form method="post" style="margin: 20px 0; background: #fff; padding: 15px; border: 1px solid #ccd0d4;" onsubmit="return confirm(\'Are you sure you want to clear all analytics data? This action cannot be undone.\');">';
    echo '<p style="margin-top:0">Use this button to clear all analytics data. This action cannot be undone.</p>';
    wp_nonce_field( AI4PID_ANALYTICS_CLEAR_ACTION, AI4PID_ANALYTICS_CLEAR_NONCE );
    submit_button( 
        'Clear All Data', 
        'secondary', 
        'ai4pid_analytics_clear_submit', 
        false, 
        array( 'style' => 'background: #f0b849; border-color: #cc911c; color: #1d2327; text-shadow: none;' ) 
    );
    echo '</form>';

    // Destroy table button form (with confirmation prompt)
    echo '<form method="post" style="margin: 20px 0; background: #fff; padding: 15px; border: 1px solid #ccd0d4;" onsubmit="return confirm(\'Are you sure you want to destroy the analytics table? This action cannot be undone.\');">';
    echo '<p style="margin-top:0">Use this button to destroy the analytics table. This action cannot be undone and will remove all data and the table itself.</p>';
    wp_nonce_field( AI4PID_ANALYTICS_DESTROY_ACTION, AI4PID_ANALYTICS_DESTROY_NONCE );
    submit_button( 
        'Destroy Table', 
        'secondary', 
        'ai4pid_analytics_destroy_submit', 
        false, 
        array( 'style' => 'background: #d63638; border-color: #b32d2e; color: #fff; text-shadow: none;' ) 
    );
    echo '</form>';

    // Show the analytics data only if the table has been created
    if ( $table_exists ) {
        // Fetch unique global visitors (counting unique hashes regardless of URL)
        $total_visits = $wpdb->get_var("SELECT COUNT(DISTINCT visitor_hash) FROM $table_name");

        echo '<h2>Total Unique Visitors (Platform-wide): <strong>' . intval($total_visits) . '</strong></h2>';

        // Fetch daily unique visitors per day for the last 30 days
        $daily_visits = $wpdb->get_results("
            SELECT visit_date, COUNT(DISTINCT visitor_hash) as unique_visits
            FROM $table_name
            WHERE visit_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY visit_date
            ORDER BY visit_date DESC
        ");

        echo '<h3>Daily Unique Visitors (Last 30 Days)</h3>';
        echo '<table class="wp-list-table widefat fixed striped">';
        echo '<thead><tr><th>Date</th><th>Unique Visits</th></tr></thead>';
        echo '<tbody>';

        if ( $daily_visits ) {
            foreach ( $daily_visits as $row ) {
                echo '<tr>';
                echo '<td>' . esc_html( $row->visit_date ) . '</td>';
                echo '<td>' . esc_html( $row->unique_visits ) . '</td>';
                echo '</tr>';
            }
        } else {
            echo '<tr><td colspan="2">No data available yet.</td></tr>';
        }

        echo '</tbody></table>';

        // Fetch unique global visitors per domain (NOT path nor protocol, just the domain, e.g., ai4pid.eu vs community.ai4pid.eu)
        // NOTE: SUBSTRING_INDEX(s, del, n) takes the first n segments left of the delimiter for n>0 or right for n<0 (Reference: https://www.w3schools.com/SQL/func_mysql_substring_index.asp)
        // Here we use -1 to get the last segment after '://', which removes the protocol (e.g., https://), and then we use 1 to get the first segment before '/', which gives us just the domain.
        $unique_domains = $wpdb->get_results("
            SELECT 
                SUBSTRING_INDEX(SUBSTRING_INDEX(url, '://', -1), '/', 1) AS domain, 
                COUNT(DISTINCT visitor_hash) AS visits
            FROM $table_name
            GROUP BY domain
            ORDER BY visits DESC
            LIMIT 10
        ");

        echo '<h3>Top Domains (all time)</h3>';
        echo '<table class="wp-list-table widefat fixed striped">';
        echo '<thead><tr><th>Domain</th><th>Unique Visits</th></tr></thead>';
        echo '<tbody>';

        if ( $unique_domains ) {
            foreach ( $unique_domains as $row ) {
                echo '<tr>';
                echo '<td><code>' . esc_html( $row->domain ) . '</code></td>';
                echo '<td>' . esc_html( $row->visits ) . '</td>';
                echo '</tr>';
            }
        } else {
            echo '<tr><td colspan="2">No data available yet.</td></tr>';
        }

        echo '</tbody></table>';

        // Fetch top URLs from the last 30 days
        $top_urls = $wpdb->get_results("
            SELECT url, COUNT(DISTINCT visitor_hash) as visits
            FROM $table_name
            WHERE visit_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY url
            ORDER BY visits DESC
            LIMIT 10
        ");

        echo '<h3>Top URLs (Last 30 Days)</h3>';
        echo '<table class="wp-list-table widefat fixed striped">';
        echo '<thead><tr><th>URL</th><th>Unique Visits</th></tr></thead>';
        echo '<tbody>';

        if ( $top_urls ) {
            foreach ( $top_urls as $row ) {
                echo '<tr>';
                echo '<td><code>' . esc_html( $row->url ) . '</code></td>';
                echo '<td>' . esc_html( $row->visits ) . '</td>';
                echo '</tr>';
            }
        } else {
            echo '<tr><td colspan="2">No data available yet.</td></tr>';
        }

        echo '</tbody></table>';

    } else {
        echo '<div class="notice notice-warning inline"><p>⚠️ The data table does not exist yet. Click the "Initialize System" button to begin.</p></div>';
    }

    echo '</div>'; // End of .wrap
}