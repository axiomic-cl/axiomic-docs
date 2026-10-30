// Copy the backend's tested developer guides and OpenAPI into this site. The widget contract
// (widget.md) stays in the backend until axiomic.js ships; the payment page concept covers it.
// Usage: npm run sync -- [path to an axiomic-backend checkout]   (default ../axiomic-backend)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicOpenApi, toPage } from './sync-lib.mjs';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backend = resolve(process.argv[2] ?? join(site, '..', 'axiomic-backend'));
const sourceCommit = execFileSync('git', ['-C', backend, 'rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).trim();

const pages = {
	'quickstart.md': 'src/content/docs/empezar/quickstart.mdx',
	'errores.md': 'src/content/docs/errores.mdx',
};

for (const [name, target] of Object.entries(pages)) {
	const markdown = readFileSync(join(backend, 'docs/desarrolladores', name), 'utf8');
	const path = join(site, target);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, toPage(name, markdown, sourceCommit));
	console.log(`${name} -> ${target}`);
}

const openapi = JSON.parse(readFileSync(join(backend, 'docs/openapi/payments-v1.json'), 'utf8'));
mkdirSync(join(site, 'public/openapi'), { recursive: true });
writeFileSync(join(site, 'public/openapi/payments-v1.json'), `${JSON.stringify(publicOpenApi(openapi), null, 2)}\n`);
writeFileSync(join(site, 'src/sync.json'), `${JSON.stringify({ backendCommit: sourceCommit }, null, 2)}\n`);
console.log(`openapi -> public/openapi/payments-v1.json (axiomic-backend ${sourceCommit})`);
