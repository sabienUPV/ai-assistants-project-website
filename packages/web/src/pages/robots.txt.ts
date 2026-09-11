/**
 * This file is an API route that generates a `robots.txt` file for the website.
 * It allows all user agents to crawl the site and provides the location of the sitemap.
 * The sitemap URL is dynamically generated based on the site's base URL.
 *
 * @see https://docs.astro.build/en/guides/integrations-guide/sitemap/#sitemap-link-in-robotstxt
 * @see https://developers.google.com/search/docs/crawling-indexing/robots/intro
 */

import type { APIRoute } from 'astro';

const getRobotsTxt = (sitemapURL: URL) => `\
User-agent: *
Allow: /

Sitemap: ${sitemapURL.href}
`;

export const GET: APIRoute = ({ site }) => {
  const sitemapURL = new URL('sitemap-index.xml', site);
  return new Response(getRobotsTxt(sitemapURL));
};