// Pure helpers for check-site.mjs: read ids and links out of built HTML and resolve links
// to the files Astro wrote.
import { posix } from 'node:path';

/** Every id="…" in a page, decoded the way a browser matches a #fragment. */
export function collectIds(html) {
	return new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => decodeEntities(match[1])));
}

/** Internal links of a page: href values that are not external, protocol or same-page only. */
export function collectLinks(html) {
	return [...html.matchAll(/<a\s[^>]*?href="([^"]*)"/g)]
		.map((match) => decodeEntities(match[1]))
		.filter((href) => href && !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href));
}

function decodeEntities(value) {
	return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/**
 * The built file a link points at, and its fragment. `from` is the page's own route
 * ("/conceptos/webhooks/"), so relative links resolve as a browser would.
 */
export function resolveLink(href, from) {
	const [rawPath, rawHash = ''] = href.split('#');
	const hash = decodeURIComponent(rawHash);
	const target = rawPath.split('?')[0];
	const path = target ? posix.resolve(posix.dirname(`${from}x`), target) : from;
	const directory = target ? target.endsWith('/') : from.endsWith('/');
	return { file: directory ? `${path.replace(/\/$/, '')}/index.html` : path, hash };
}

/** The error codes the API can return, from the OpenAPI ApiError schema. */
export function apiErrorCodes(openapi) {
	const codes = openapi?.components?.schemas?.ApiError?.properties?.code?.enum;
	if (!Array.isArray(codes) || codes.length === 0) throw new Error('the OpenAPI document lists no error codes');
	return codes;
}
