// Pure transforms that turn the backend's tested developer guides into site pages.
// The backend stays the source of truth: CI there runs the quickstart and ties the
// error catalog to the API's ErrorCode enum. This site only reshapes them.

/** Site routes for the backend files that have a public page. */
export const ROUTES = {
	'quickstart.md': '/empezar/quickstart/',
	'errores.md': '/errores/',
	'widget.md': '/conceptos/pagina-de-pago/',
	'payments-api-spec-v1.md': '/api/',
	'payments-v1.json': '/openapi/payments-v1.json',
};

/** The v1 contract is internal; its sections that guides cite map to public concept pages. */
export const CONTRACT_SECTIONS = {
	3: ['Llaves, modos y límites', '/conceptos/llaves-y-modos/'],
	5: ['Referencia de la API', '/api/'],
	6: ['Cómo se identifica un abono', '/conceptos/identificacion-de-abonos/'],
	8: ['Webhooks', '/conceptos/webhooks/'],
	9: ['Página de pago', '/conceptos/pagina-de-pago/'],
	10: ['Modo de prueba', '/conceptos/modo-de-prueba/'],
	11: ['Agentes y mandatos', '/conceptos/agentes/'],
	12: ['Errores', '/errores/'],
	13: ['Pago directo', '/conceptos/pago-directo/'],
};

export const PUBLIC_SERVERS = [
	{ url: 'https://api.axiomic.cl', description: 'Producción, en modo de prueba (banco simulado, sin dinero real)' },
];

const HOSTED_STEP_ONE = `## 1. Consigue tu llave de prueba

El sandbox ya está alojado: no necesitas instalar nada. [Pide acceso](/empezar/pedir-acceso/) y te
enviamos una llave \`axk_test_…\` para tu comercio de prueba. Después, en tu terminal:

\`\`\`sh
export AXIOMIC_API=https://api.axiomic.cl
export AXIOMIC_KEY=axk_test_tu_llave
\`\`\`

La llave \`axk_test_…\` es secreta: vive en tu servidor, nunca en el navegador. Comprueba que la API
responde y que no mueve dinero real:

\`\`\`sh
curl -s "$AXIOMIC_API/ready" | jq .
\`\`\`

\`\`\`json
{"ready": true, "mode": "test", "real_money_enabled": false}
\`\`\`
`;

/** Split a leading "# Title" from the body. */
export function takeTitle(markdown) {
	const match = markdown.match(/^# (.+)\n+/);
	if (!match) throw new Error('every synced guide starts with a level-one title');
	return { title: match[1].trim(), body: markdown.slice(match[0].length) };
}

/** First sentence of the first paragraph, without Markdown emphasis, for <meta description>. */
export function describe(body) {
	const paragraph = body.split(/\n{2,}/).find((block) => block.trim() && !/^[#>`<|-]/.test(block.trim()));
	if (!paragraph) return '';
	const text = paragraph.replace(/\s+/g, ' ').replace(/[*`]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();
	const sentence = text.match(/^.+?[.!?](\s|$)/);
	return (sentence ? sentence[0] : text).trim();
}

/** Rewrite links: public guides go to their routes; backend-internal files keep only their text. */
export function rewriteLinks(body) {
	return body.replace(/(?<!!)\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (whole, text, target) => {
		if (/^(https?:|mailto:|#|\/)/.test(target)) return whole;
		const [path, hash = ''] = target.split('#');
		const file = path.split('/').pop();
		if (file && Object.hasOwn(ROUTES, file)) {
			// The contract's own section anchors do not exist on the public reference.
			const keep = hash && file !== 'payments-api-spec-v1.md';
			return `[${text}](${ROUTES[file]}${keep ? `#${hash}` : ''})`;
		}
		return text;
	});
}

/** "(§8 del contrato)" becomes a link to the concept page that explains that section. */
export function linkContractSections(body) {
	const linked = body.replace(/\(§(\d+)(?:\s+del\s+contrato)?\)/g, (whole, section) => {
		const target = CONTRACT_SECTIONS[section];
		if (!target) throw new Error(`no public page for contract section §${section}`);
		return `([${target[0]}](${target[1]}))`;
	});
	if (linked.includes('§')) throw new Error('a contract reference was left without a public page');
	return linked;
}

/** The backend's own CI note at the end of the catalog's introduction. */
export function dropErrorCatalogNote(body) {
	return replaceOnce(body, /\nUna prueba \(`tests\/[\s\S]*?\.\n(?=\n)/, '', 'the error catalog CI note');
}

/** Replace exactly one match, or fail the sync: a guide that changed must be looked at. */
function replaceOnce(body, pattern, replacement, what) {
	if (!pattern.test(body)) throw new Error(`the backend guide changed: ${what} not found`);
	return body.replace(pattern, replacement);
}

/** A literal phrase as a pattern that tolerates a different line wrap. */
function phrase(text) {
	return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'));
}

/**
 * Sentences of the backend guides written for the private repository or the pay page's own
 * backend, with their public wording. Each must still be there, so a reworded guide is
 * reviewed instead of published as is; delete an entry once the backend says it publicly.
 */
export const PAGE_TEXT = {
	'quickstart.md': [
		[
			'Las reglas completas están en el [contrato v1](../payments-api-spec-v1.md).',
			'Las rutas y los esquemas están en la [referencia de la API](../payments-api-spec-v1.md).',
		],
		[
			'Si no llega en 30 segundos, revisa que el servicio siga corriendo.',
			'Si no llega en 30 segundos, vuelve a consultar.',
		],
		[
			'[Contrato v1](../payments-api-spec-v1.md): estados, revisión de abonos, comisiones y errores.',
			'[Referencia de la API](../payments-api-spec-v1.md): rutas, esquemas, estados y errores.',
		],
		[
			'[Widget de pago](widget.md): el checkout en un modal en escritorio y por redirección en móvil, con los mensajes que recibe tu tienda.',
			'[Página de pago](widget.md): cómo vuelve el pagador a tu tienda y quién puede incrustarla.',
		],
	],
	'errores.md': [
		[' En las rutas internas del alta del sandbox, falta la credencial de servicio del BFF (`axs_test_…`) o no coincide.', ''],
		['tu BFF lo guarda en una cookie `HttpOnly`.', 'la página de pago lo guarda en una cookie `HttpOnly`.'],
		[' En el alta interna del sandbox, el dueño ya tiene 3 comercios de prueba, o el comercio ya tiene 2 llaves vigentes con ese alcance.', ''],
		[' Para emitir otra llave, revoca antes una de las vigentes.', ''],
	],
};

export function publicWording(name, body) {
	return (PAGE_TEXT[name] ?? []).reduce(
		(page, [internal, wording]) => replaceOnce(page, phrase(internal), wording, `"${internal.slice(0, 40)}…"`),
		body,
	);
}

/** What a public page must never carry: backend paths, local setup and internal services. */
const INTERNAL = [
	[/\bBFF\b/, 'the pay page BFF'],
	[/axs_test_/, 'the sandbox service credential'],
	[/alta (interna )?del sandbox|alta interna/, 'the internal sandbox sign-up'],
	[/tests\//, 'a backend test path'],
	[/docker|uv run|\.axiomic\//, 'local setup'],
	[/127\.0\.0\.1:4177/, 'the local API'],
	[/\]\((?!https?:|mailto:|#|\/)[^)]*\)/, 'a link or image into the backend repository'],
];

export function assertPublic(name, page) {
	for (const [pattern, what] of INTERNAL) {
		const found = page.match(pattern);
		if (found) throw new Error(`${name} still cites ${what} ("${found[0]}"); give it public wording`);
	}
	return page;
}

/** Drop the backend's CI markers; they mean nothing on the site. */
export function dropCiComments(body) {
	return body.replace(/^<!-- quickstart:[^>]*-->\n/gm, '');
}

const HOSTED_WEBHOOK_INTRO = `En producción tu backend no consulta: Axiomic le avisa con un webhook firmado y reintenta hasta
que respondes 2xx. La API alojada sólo entrega a URLs HTTPS públicas, así que expón tu receptor
local con un túnel. Con [\`cloudflared\`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/),
en otra terminal:

\`\`\`sh
cloudflared tunnel --url http://127.0.0.1:4190
\`\`\`

Copia la URL \`https://….trycloudflare.com\` que imprime:

\`\`\`sh
export AXIOMIC_WEBHOOK_URL=https://tu-tunel.trycloudflare.com
\`\`\`
`;


/** The local sandbox steps assume the private repository; the site uses the hosted API. */
export function hostQuickstart(body) {
	const start = body.indexOf('## 1. ');
	const next = body.indexOf('\n## 2. ');
	if (start < 0 || next < 0) throw new Error('the quickstart must keep its numbered steps');
	let hosted = body.slice(0, start) + HOSTED_STEP_ONE + body.slice(next);
	hosted = replaceOnce(
		hosted,
		/En producción tu backend no consulta:[\s\S]*?trae los mismos eventos\.\n/,
		HOSTED_WEBHOOK_INTRO,
		'the webhook introduction',
	);
	return replaceOnce(
		hosted,
		/"url": "http:\/\/127\.0\.0\.1:4190\/webhooks\/axiomic"}'/,
		`"url": "'"$AXIOMIC_WEBHOOK_URL"'/webhooks/axiomic"}'`,
		'the webhook registration',
	);
}

/** The intro paragraph about the backend CI does not belong on the public page. */
export function dropBackendCiNote(body) {
	return replaceOnce(body, /\nUna prueba de CI[\s\S]*?antes\s+de que la guía mienta\.\n/, '\n', 'the quickstart CI note');
}

/** Descriptions for guides whose first sentence does not stand alone. */
const DESCRIPTIONS = {
	'errores.md': 'Cada error de la API: su código estable, su HTTP, cuándo aparece y qué hacer.',
};

export function frontmatter({ title, description, sourceCommit }) {
	const quote = (value) => JSON.stringify(value);
	return [
		'---',
		`title: ${quote(title)}`,
		`description: ${quote(description)}`,
		// Synced pages are edited in the backend; an edit here would be overwritten.
		'editUrl: false',
		'---',
		'',
		`{/* Sincronizado desde axiomic-backend ${sourceCommit}. Edita la guía allá, no aquí. */}`,
		'',
	].join('\n');
}

/** Whole page for one backend guide. */
export function toPage(name, markdown, sourceCommit) {
	const { title, body } = takeTitle(markdown);
	let page = publicWording(name, dropCiComments(body));
	if (name === 'quickstart.md') page = hostQuickstart(dropBackendCiNote(page));
	if (name === 'errores.md') page = dropErrorCatalogNote(page);
	page = assertPublic(name, linkContractSections(rewriteLinks(page)));
	return frontmatter({ title, description: DESCRIPTIONS[name] ?? describe(page), sourceCommit }) + page;
}

/**
 * The OpenAPI document with the public servers instead of the local one. An operation's
 * `authorization` header parameter repeats its security scheme, so the reference would ask
 * for the key twice; the scheme stays.
 */
export function publicOpenApi(document) {
	if (!document || typeof document !== 'object' || !document.openapi || !document.paths) {
		throw new Error('expected an OpenAPI document');
	}
	const paths = Object.fromEntries(
		Object.entries(document.paths).map(([path, item]) => [
			path,
			Object.fromEntries(
				Object.entries(item).map(([method, operation]) => [
					method,
					operation?.security && Array.isArray(operation.parameters)
						? {
								...operation,
								parameters: operation.parameters.filter(
									(parameter) => !(parameter.in === 'header' && parameter.name.toLowerCase() === 'authorization'),
								),
							}
						: operation,
				]),
			),
		]),
	);
	return publicText({ ...document, servers: PUBLIC_SERVERS, paths });
}

/** Phrases of the generated OpenAPI that point at backend files, and their public wording. */
const OPENAPI_TEXT = [
	['los códigos están en la spec (§12).', 'cada `code` está en el [catálogo de errores](https://docs.axiomic.cl/errores/).'],
	['Contrato: docs/payments-api-spec-v1.md.', 'Guías y conceptos en [docs.axiomic.cl](https://docs.axiomic.cl/).'],
	['El navegador las llama a través del BFF.', 'Las usa la página de pago de Axiomic.'],
];

function publicText(document) {
	let text = JSON.stringify(document);
	for (const [internal, wording] of OPENAPI_TEXT) text = text.replaceAll(internal, wording);
	const leftover = text.match(/docs\/[\w./-]+\.md|§\d+|\bBFF\b/);
	if (leftover) throw new Error(`the OpenAPI document still cites "${leftover[0]}"; add its public wording`);
	return JSON.parse(text);
}

/** Error codes documented in the catalog, as "### `code`" headings. */
export function errorCodes(markdown) {
	return [...markdown.matchAll(/^### `([a-z0-9_]+)`$/gm)].map((match) => match[1]);
}
