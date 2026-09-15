<?php
add_action( 'template_redirect', 'blank_404_if_logged_out' );
/**
 * Serves an empty HTTP 404 response (zero HTML/content) to logged-out frontend visitors.
 * Exception: Allows robots.txt to be served properly for SEO crawlers.
 * Note: Remember to check the "Ask Search Engines Not to Index This Site" option in Settings > Reading if you want to block search engines from indexing your site.
 */
function blank_404_if_logged_out() {
    // If the request is for robots.txt, let WordPress generate it and abort this filter
    // Note: Remember to check the "Ask Search Engines Not to Index This Site" option in Settings > Reading if you want to block search engines from indexing your site.
    if ( is_robots() ) {
        return;
    }

    if ( ! is_user_logged_in() ) {
        status_header( 404 );
        nocache_headers();
        exit;
    }
}

// Remove WordPress REST API and Shortlink headers from HTTP response
add_filter( 'template_redirect', function() {
    if ( ! is_user_logged_in() ) {
        remove_action( 'template_redirect', 'wp_shortlink_header', 11 );
        remove_action( 'template_redirect', 'rest_output_link_header', 11 );
    }
}, 9 );

add_filter( 'rest_authentication_errors', 'restrict_rest_api_to_logged_in_users' );
/**
 * Restricts REST API access to logged-in users.
 */
function restrict_rest_api_to_logged_in_users( $access ) {
    if ( ! is_user_logged_in() ) {
        return new WP_Error(
            'rest_cannot_access',
            __( 'Only logged-in users can access the REST API.', 'textdomain' ),
            array( 'status' => rest_authorization_required_code() )
        );
    }
    return $access;
}