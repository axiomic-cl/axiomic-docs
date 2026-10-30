import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	describe,
	errorCodes,
	dropErrorCatalogNote,
	hostQuickstart,
	linkContractSections,
	publicOpenApi,
	rewriteLinks,
	assertPublic,
	takeTitle,
	toPage,
} from './sync-lib.mjs';

test('the level-one title becomes the page title', () => {
	assert.deepEqual(takeTitle('# Errores\n\nTexto.\n'), { title: 'Errores', body: 'Texto.\n' });
	assert.throws(() => takeTitle('Sin título\n'));
});

test('the description is the first plain sentence', () => {
	assert.equal(describe('## Tabla\n\nCreas un **cobro** y lo pagas. Después más.\n'), 'Creas un cobro y lo pagas.');
	assert.equal(describe('Responde `real_money_enabled` en falso.\n'), 'Responde real_money_enabled en falso.');
});

test('public guides link to their routes and internal files keep only their text', () => {
	assert.equal(rewriteLinks('[contrato](../payments-api-spec-v1.md#12-errores)'), '[contrato](/api/)');
	assert.equal(rewriteLinks('[OpenAPI](../openapi/payments-v1.json)'), '[OpenAPI](/openapi/payments-v1.json)');
	assert.equal(rewriteLinks('[errores](errores.md#invalid_api_key)'), '[errores](/errores/#invalid_api_key)');
	assert.equal(rewriteLinks('[plan](../plan-experiencia-desarrollador.md)'), 'plan');
	assert.equal(rewriteLinks('[web](https://axiomic.cl) y [ancla](#paso)'), '[web](https://axiomic.cl) y [ancla](#paso)');
	assert.equal(rewriteLinks('[Pide acceso](/empezar/pedir-acceso/)'), '[Pide acceso](/empezar/pedir-acceso/)');
	assert.equal(rewriteLinks('![diagrama](img/flujo.png)'), '![diagrama](img/flujo.png)');
	assert.equal(rewriteLinks('[plan](../plan.md "Plan interno")'), 'plan');
});

const LOCAL_QUICKSTART = [
	'Intro.\n\n## 1. Arranca el sandbox\n\nCuando exista el sandbox alojado...\ndocker compose up\n',
	'\n## 2. Crea un cobro\n\ncurl\n\n## 6. Recibe el webhook firmado\n\n',
	'En producción tu backend no consulta: avisa.\nCon Docker, el feed\ndel paso 4 trae los mismos eventos.\n\n',
	`  -d '{"url": "http://127.0.0.1:4190/webhooks/axiomic"}' | jq -er .secret)\n`,
].join('');

test('the quickstart starts from the hosted sandbox', () => {
	const hosted = hostQuickstart(LOCAL_QUICKSTART);
	assert.match(hosted, /## 1\. Consigue tu llave de prueba/);
	assert.match(hosted, /https:\/\/api\.axiomic\.cl/);
	assert.doesNotMatch(hosted, /docker compose/);
	assert.match(hosted, /## 2\. Crea un cobro/);
});

test('the hosted webhook goes through a public HTTPS tunnel', () => {
	const hosted = hostQuickstart(LOCAL_QUICKSTART);
	assert.match(hosted, /cloudflared tunnel --url http:\/\/127\.0\.0\.1:4190/);
	assert.match(hosted, /"url": "'"\$AXIOMIC_WEBHOOK_URL"'\/webhooks\/axiomic"}'/);
	assert.doesNotMatch(hosted, /Con Docker/);
	assert.doesNotMatch(hosted, /127\.0\.0\.1:4190\/webhooks/);
});

test('a backend quickstart that drifted fails the sync instead of shipping stale steps', () => {
	assert.throws(() => hostQuickstart('## 1. a\n\n## 2. b\n'), /webhook introduction/);
	assert.throws(() => hostQuickstart('Sin pasos\n'), /numbered steps/);
});

test('a synced page carries frontmatter and its source commit', () => {
	const page = toPage('guia.md', '# Una guía\n\nCada error trae un código.\n\n### `invalid_api_key`\n', 'abc123');
	assert.match(page, /^---\ntitle: "Una guía"\ndescription: "Cada error trae un código\."\neditUrl: false\n---/);
	assert.match(page, /Sincronizado desde axiomic-backend abc123/);
});

test('the OpenAPI document points at the public servers only', () => {
	const document = publicOpenApi({ openapi: '3.1.0', paths: {}, servers: [{ url: 'http://127.0.0.1:4177' }] });
	assert.deepEqual(document.servers.map((server) => server.url), ['https://api.axiomic.cl']);
	assert.throws(() => publicOpenApi({}));
});

test('the security scheme alone asks for the key', () => {
	const operation = {
		security: [{ merchantKey: [] }],
		parameters: [
			{ in: 'header', name: 'authorization' },
			{ in: 'header', name: 'idempotency-key', required: true },
		],
	};
	const open = { in: 'header', name: 'authorization' };
	const document = publicOpenApi({
		openapi: '3.1.0',
		paths: { '/v1/payment_intents': { post: operation }, '/v1/banks': { get: { parameters: [open] } } },
	});
	assert.deepEqual(document.paths['/v1/payment_intents'].post.parameters, [{ in: 'header', name: 'idempotency-key', required: true }]);
	assert.deepEqual(document.paths['/v1/banks'].get.parameters, [open]);
});

test('error codes come from the catalog headings', () => {
	assert.deepEqual(errorCodes('## 401\n\n### `invalid_api_key`\n\n### `invalid_token`\n'), ['invalid_api_key', 'invalid_token']);
});

test('contract sections link to the public page that explains them', () => {
	assert.equal(
		linkContractSections('un aviso (§8 del\ncontrato) y otro (§10).'),
		'un aviso ([Webhooks](/conceptos/webhooks/)) y otro ([Modo de prueba](/conceptos/modo-de-prueba/)).',
	);
	assert.throws(() => linkContractSections('(§99)'), /§99/);
	assert.throws(() => linkContractSections('ver §8 arriba'), /without a public page/);
});

test('the catalog drops the backend CI note but keeps the rest', () => {
	const body = 'Intro.\n\nUna prueba (`tests/x.py`) exige que cada\ncódigo esté [aquí](a.md).\n\n## 400\n';
	assert.equal(dropErrorCatalogNote(body), 'Intro.\n\n## 400\n');
});

test('the OpenAPI text cites public pages, never backend files', () => {
	const document = publicOpenApi({
		openapi: '3.1.0',
		info: { description: 'Modo de prueba. Contrato: docs/payments-api-spec-v1.md.' },
		paths: { '/ready': { get: { description: 'Error: `{detail, code}`; los códigos están en la spec (§12).' } } },
	});
	assert.equal(document.info.description, 'Modo de prueba. Guías y conceptos en [docs.axiomic.cl](https://docs.axiomic.cl/).');
	assert.match(document.paths['/ready'].get.description, /catálogo de errores\]\(https:\/\/docs\.axiomic\.cl\/errores\/\)/);
	assert.throws(() => publicOpenApi({ openapi: '3.1.0', paths: {}, info: { description: 'Ver docs/plan.md' } }), /docs\/plan\.md/);
});

test('a page that still cites internals fails the sync', () => {
	for (const text of ['tu BFF', 'uv run python', 'ver tests/x.py', 'http://127.0.0.1:4177', '[plan](plan.md "t")', '![flujo](img/flujo.png)', 'docker compose']) {
		assert.throws(() => assertPublic('guia.md', text), /give it public wording/, text);
	}
	assert.equal(assertPublic('guia.md', '[ok](/api/) [web](https://axiomic.cl) 127.0.0.1:4190'), '[ok](/api/) [web](https://axiomic.cl) 127.0.0.1:4190');
});
