// Fail the build on a broken internal link or anchor, or on an API error code whose doc_url
// (https://docs.axiomic.cl/errores#<code>) would land on nothing.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiErrorCodes, collectIds, collectLinks, resolveLink } from './check-lib.mjs';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(site, 'dist');

function htmlFiles(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return htmlFiles(path);
		return entry.name.endsWith('.html') ? [path] : [];
	});
}

const pages = new Map();
for (const file of htmlFiles(dist)) {
	const route = `/${relative(dist, file).split(sep).join('/')}`;
	pages.set(route, readFileSync(file, 'utf8'));
}
const ids = new Map([...pages].map(([route, html]) => [route, collectIds(html)]));

const problems = [];
for (const [route, html] of pages) {
	const from = route.replace(/index\.html$/, '');
	for (const href of collectLinks(html)) {
		const { file, hash } = resolveLink(href, from);
		if (!pages.has(file) && !existsSync(join(dist, file))) {
			problems.push(`${route}: ${href} does not exist`);
		} else if (hash && pages.has(file) && !ids.get(file).has(hash)) {
			problems.push(`${route}: ${href} has no #${hash}`);
		}
	}
}

const errorIds = ids.get('/errores/index.html') ?? new Set();
const openapi = JSON.parse(readFileSync(join(dist, 'openapi/payments-v1.json'), 'utf8'));
for (const code of apiErrorCodes(openapi)) {
	if (!errorIds.has(code)) problems.push(`/errores/ has no #${code} for the API's doc_url`);
}
for (const required of ['llms.txt', 'llms-full.txt', 'scalar/standalone.js', 'pagefind/pagefind.js']) {
	if (!existsSync(join(dist, required))) problems.push(`${required} was not built`);
}

if (problems.length) {
	console.error(`check-site: ${problems.length} problem(s)\n${problems.map((line) => `  ${line}`).join('\n')}`);
	process.exit(1);
}
console.log(`check-site: ${pages.size} pages, links, anchors and ${apiErrorCodes(openapi).length} error codes OK`);
