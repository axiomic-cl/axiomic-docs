// «Pedir acceso»: validate a request, check its Turnstile challenge and keep it in D1 for
// 90 days. Pure apart from the D1 binding and the fetch it is handed, so it runs under
// `node --test` as well as in the Pages Function (functions/solicitudes.js).

export const HOSTNAME = 'docs.axiomic.cl';
export const ACTION = 'pedir-acceso';
export const RETENTION_DAYS = 90;
const MAX_BODY_BYTES = 4096;
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const FIELDS = {
	email: { max: 254, required: true },
	name: { max: 120, required: true },
	company: { max: 120, required: false },
	intended_use: { max: 1000, required: true },
};

const SCHEMA = `CREATE TABLE IF NOT EXISTS access_requests (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	created_at TEXT NOT NULL,
	email TEXT NOT NULL,
	name TEXT NOT NULL,
	company TEXT NOT NULL,
	intended_use TEXT NOT NULL
)`;

function json(status, body) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
	});
}

/** The cleaned fields, or the names of the ones that are missing or malformed. */
export function validate(body) {
	const value = {};
	const invalid = [];
	for (const [field, rule] of Object.entries(FIELDS)) {
		const raw = typeof body?.[field] === 'string' ? body[field].trim() : '';
		// Control characters other than newlines in the free-text field are never legitimate.
		const control = field === 'intended_use' ? /[\u0000-\u0009\u000b-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
		if ((rule.required && !raw) || raw.length > rule.max || control.test(raw)) invalid.push(field);
		value[field] = raw;
	}
	if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) invalid.push('email');
	return invalid.length ? { ok: false, invalid: [...new Set(invalid)] } : { ok: true, value };
}

/** Turnstile's verdict for this token, bound to the docs hostname and the form's action. */
export async function passesChallenge(token, { secret, remoteip, fetchImpl }) {
	if (typeof token !== 'string' || !token || token.length > 2048) return false;
	const form = new URLSearchParams({ secret, response: token });
	if (remoteip) form.set('remoteip', remoteip);
	const response = await fetchImpl(SITEVERIFY, { method: 'POST', body: form });
	if (!response.ok) return false;
	const verdict = await response.json();
	return verdict.success === true && verdict.hostname === HOSTNAME && verdict.action === ACTION;
}

function cutoff(now) {
	return new Date(now.getTime() - RETENTION_DAYS * 86_400_000).toISOString();
}

/** Delete what is past retention; runs on every visit to the form and every request. */
async function purge(db, now) {
	await db.batch([db.prepare(SCHEMA), db.prepare('DELETE FROM access_requests WHERE created_at < ?').bind(cutoff(now))]);
}

/** GET: the public site key, so the page renders the challenge only when the form works. */
export async function describeForm(env, { now }) {
	if (!env.ACCESS_DB || !env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET_KEY) return json(503, { available: false });
	try {
		await purge(env.ACCESS_DB, now);
	} catch {
		return json(503, { available: false });
	}
	return json(200, { available: true, site_key: env.TURNSTILE_SITE_KEY, action: ACTION });
}

/**
 * The body as text, or null past `max` bytes: refused up front by Content-Length, and
 * otherwise cut off while streaming, so an oversized body is never held in memory.
 */
export async function readBounded(request, max) {
	const declared = Number(request.headers.get('Content-Length'));
	if (declared > max) return null;
	if (!request.body) return '';
	const reader = request.body.getReader();
	const chunks = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > max) {
			await reader.cancel();
			return null;
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(bytes);
}

/** POST: keep one access request. Never echoes what was sent, never logs it. */
export async function submit(request, env, { now, fetchImpl }) {
	// Preview deployments have neither binding: the form fails closed there.
	if (!env.ACCESS_DB || !env.TURNSTILE_SECRET_KEY) return json(503, { error: 'unavailable' });
	if (request.headers.get('Origin') !== `https://${HOSTNAME}`) return json(403, { error: 'forbidden' });
	if (!(request.headers.get('Content-Type') ?? '').startsWith('application/json')) {
		return json(415, { error: 'unsupported_media_type' });
	}
	const text = await readBounded(request, MAX_BODY_BYTES);
	if (text === null) return json(413, { error: 'too_large' });
	let body;
	try {
		body = JSON.parse(text);
	} catch {
		return json(400, { error: 'invalid_json' });
	}
	const checked = validate(body);
	if (!checked.ok) return json(422, { error: 'invalid', fields: checked.invalid });
	const human = await passesChallenge(body.turnstile_token, {
		secret: env.TURNSTILE_SECRET_KEY,
		remoteip: request.headers.get('CF-Connecting-IP'),
		fetchImpl,
	}).catch(() => false);
	if (!human) return json(403, { error: 'challenge_failed' });

	const { email, name, company, intended_use } = checked.value;
	const db = env.ACCESS_DB;
	try {
		await purge(db, now);
		await db
			.prepare('INSERT INTO access_requests (created_at, email, name, company, intended_use) VALUES (?, ?, ?, ?, ?)')
			.bind(now.toISOString(), email, name, company, intended_use)
			.run();
	} catch {
		return json(503, { error: 'unavailable' });
	}
	return json(201, { ok: true });
}
