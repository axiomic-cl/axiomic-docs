import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACTION, HOSTNAME, describeForm, passesChallenge, submit, validate } from './request.mjs';

const NOW = new Date('2026-10-30T12:00:00Z');

function fakeDb() {
	const statements = [];
	const statement = (sql, params = []) => ({
		sql,
		params,
		bind: (...values) => statement(sql, values),
		run: async () => statements.push({ sql, params }),
	});
	return {
		statements,
		prepare: (sql) => statement(sql),
		batch: async (list) => list.forEach(({ sql, params }) => statements.push({ sql, params })),
	};
}

function siteverify(verdict) {
	const calls = [];
	const fetchImpl = async (url, init) => {
		calls.push({ url, body: Object.fromEntries(init.body) });
		return new Response(JSON.stringify(verdict), { status: 200 });
	};
	return { calls, fetchImpl };
}

const GOOD = { email: 'dev@tienda.cl', name: 'Ana Dev', company: 'Tienda', intended_use: 'Cobrar pedidos.', turnstile_token: 'tok' };
const PASS = { success: true, hostname: HOSTNAME, action: ACTION };

function post(body, headers = {}) {
	return new Request('https://docs.axiomic.cl/solicitudes', {
		method: 'POST',
		headers: { Origin: `https://${HOSTNAME}`, 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7', ...headers },
		body: typeof body === 'string' ? body : JSON.stringify(body),
	});
}

const env = (db = fakeDb()) => ({ ACCESS_DB: db, TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'secret' });

test('a valid, human request is stored and nothing is echoed', async () => {
	const db = fakeDb();
	const { calls, fetchImpl } = siteverify(PASS);
	const response = await submit(post(GOOD), env(db), { now: NOW, fetchImpl });
	assert.equal(response.status, 201);
	assert.deepEqual(await response.json(), { ok: true });
	assert.deepEqual(calls[0].body, { secret: 'secret', response: 'tok', remoteip: '203.0.113.7' });
	const insert = db.statements.find((s) => s.sql.startsWith('INSERT'));
	assert.deepEqual(insert.params, [NOW.toISOString(), 'dev@tienda.cl', 'Ana Dev', 'Tienda', 'Cobrar pedidos.']);
});

test('requests older than 90 days are deleted on every write', async () => {
	const db = fakeDb();
	await submit(post(GOOD), env(db), { now: NOW, fetchImpl: siteverify(PASS).fetchImpl });
	const purge = db.statements.find((s) => s.sql.startsWith('DELETE'));
	assert.deepEqual(purge.params, ['2026-08-01T12:00:00.000Z']);
});

test('a failed or foreign challenge stores nothing', async () => {
	for (const verdict of [{ success: false }, { ...PASS, hostname: 'evil.example' }, { ...PASS, action: 'otra' }]) {
		const db = fakeDb();
		const response = await submit(post(GOOD), env(db), { now: NOW, fetchImpl: siteverify(verdict).fetchImpl });
		assert.equal(response.status, 403);
		assert.equal(db.statements.length, 0);
	}
	const thrown = await submit(post(GOOD), env(), { now: NOW, fetchImpl: async () => { throw new Error('down'); } });
	assert.equal(thrown.status, 403);
});

test('other origins, content types and oversized bodies are refused before the challenge', async () => {
	const { calls, fetchImpl } = siteverify(PASS);
	assert.equal((await submit(post(GOOD, { Origin: 'https://evil.example' }), env(), { now: NOW, fetchImpl })).status, 403);
	assert.equal((await submit(post(GOOD, { 'Content-Type': 'text/plain' }), env(), { now: NOW, fetchImpl })).status, 415);
	assert.equal((await submit(post({ ...GOOD, intended_use: 'x'.repeat(5000) }), env(), { now: NOW, fetchImpl })).status, 413);
	assert.equal((await submit(post('{'), env(), { now: NOW, fetchImpl })).status, 400);
	assert.equal(calls.length, 0);
});

test('invalid fields are named without their values', async () => {
	const response = await submit(post({ ...GOOD, email: 'no-es-correo', name: '' }), env(), { now: NOW, fetchImpl: siteverify(PASS).fetchImpl });
	assert.equal(response.status, 422);
	assert.deepEqual(await response.json(), { error: 'invalid', fields: ['name', 'email'] });
});

test('validation trims, keeps the company optional and rejects control characters', () => {
	assert.deepEqual(validate({ ...GOOD, company: '  ', email: ' dev@tienda.cl ' }).value.company, '');
	assert.equal(validate({ ...GOOD, intended_use: 'Línea uno\nLínea dos' }).ok, true);
	assert.deepEqual(validate({ ...GOOD, name: 'Ana\u0007' }).invalid, ['name']);
});

test('a deployment without its bindings fails closed', async () => {
	const response = await submit(post(GOOD), { TURNSTILE_SECRET_KEY: 'secret' }, { now: NOW, fetchImpl: siteverify(PASS).fetchImpl });
	assert.equal(response.status, 503);
	assert.equal((await describeForm({}, { now: NOW })).status, 503);
});

test('the form learns the public site key and the action', async () => {
	const response = await describeForm(env(), { now: NOW });
	assert.deepEqual(await response.json(), { available: true, site_key: 'site', action: ACTION });
	assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('an empty or huge token never reaches Turnstile', async () => {
	const { calls, fetchImpl } = siteverify(PASS);
	assert.equal(await passesChallenge('', { secret: 's', fetchImpl }), false);
	assert.equal(await passesChallenge('x'.repeat(3000), { secret: 's', fetchImpl }), false);
	assert.equal(calls.length, 0);
});
