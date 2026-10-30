import assert from 'node:assert/strict';
import { test } from 'node:test';
import { noticeEmail, notifyTeam } from './notify.mjs';

const REQUEST = {
	email: 'dev@tienda.cl',
	name: 'Ana Dev',
	company: '',
	intended_use: 'Cobrar pedidos.\n<b>sin HTML</b>',
	created_at: '2026-10-30T12:00:00.000Z',
};

test('the notice is plain text with a fixed subject and replies go to the requester', () => {
	const email = noticeEmail(REQUEST, { to: 'equipo@axiomic.cl' });
	assert.equal(email.from, 'Axiomic Docs <onboarding@resend.dev>');
	assert.deepEqual(email.to, ['equipo@axiomic.cl']);
	assert.equal(email.reply_to, 'dev@tienda.cl');
	assert.equal(email.subject, 'Nueva solicitud de acceso a la API de prueba');
	assert.equal(email.html, undefined);
	assert.match(email.text, /Empresa: \(no indicó\)/);
	assert.match(email.text, /<b>sin HTML<\/b>/);
	assert.equal(noticeEmail(REQUEST, { to: 'x@axiomic.cl', from: 'Axiomic <avisos@axiomic.cl>' }).from, 'Axiomic <avisos@axiomic.cl>');
});

test('without its key or recipient the notice is skipped without a request', async () => {
	let calls = 0;
	const fetchImpl = async () => {
		calls += 1;
		return new Response('{}');
	};
	assert.equal(await notifyTeam(REQUEST, { NOTIFY_TO: 'equipo@axiomic.cl' }, fetchImpl), false);
	assert.equal(await notifyTeam(REQUEST, { RESEND_KEY: 're_test' }, fetchImpl), false);
	assert.equal(calls, 0);
});

test('a refused or unreachable Resend is reported by status only', async (t) => {
	const logged = [];
	t.mock.method(console, 'error', (line) => logged.push(line));
	const env = { RESEND_KEY: 're_test', NOTIFY_TO: 'equipo@axiomic.cl' };
	assert.equal(await notifyTeam(REQUEST, env, async () => new Response('{"echo":"dev@tienda.cl"}', { status: 422 })), false);
	assert.equal(await notifyTeam(REQUEST, env, async () => { throw new Error('dev@tienda.cl'); }), false);
	assert.deepEqual(logged, ['access notice: Resend answered 422', 'access notice: Resend unreachable']);
});
