import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apiErrorCodes, collectIds, collectLinks, resolveLink } from './check-lib.mjs';

test('ids and internal links come out of built HTML', () => {
	const html = '<h3 id="invalid_api_key">x</h3><a href="/errores/#rate_limited">a</a>'
		+ '<a class="x" href="https://axiomic.cl">b</a><a href="mailto:contact@axiomic.cl">c</a><a href="../webhooks/">d</a>';
	assert.deepEqual([...collectIds(html)], ['invalid_api_key']);
	assert.deepEqual(collectLinks(html), ['/errores/#rate_limited', '../webhooks/']);
});

test('links resolve to the files Astro writes', () => {
	assert.deepEqual(resolveLink('/errores/#rate_limited', '/'), { file: '/errores/index.html', hash: 'rate_limited' });
	assert.deepEqual(resolveLink('../webhooks/', '/conceptos/agentes/'), { file: '/conceptos/webhooks/index.html', hash: '' });
	assert.deepEqual(resolveLink('/openapi/payments-v1.json', '/'), { file: '/openapi/payments-v1.json', hash: '' });
	assert.deepEqual(resolveLink('#l%C3%ADmites', '/conceptos/llaves-y-modos/'), {
		file: '/conceptos/llaves-y-modos/index.html',
		hash: 'límites',
	});
	assert.deepEqual(resolveLink('#_top', '/404.html'), { file: '/404.html', hash: '_top' });
	assert.deepEqual(resolveLink('/errores#no_such_code', '/'), { file: '/errores/index.html', hash: 'no_such_code' });
});

test('the API error codes come from the OpenAPI ApiError schema', () => {
	const openapi = { components: { schemas: { ApiError: { properties: { code: { enum: ['not_found'] } } } } } };
	assert.deepEqual(apiErrorCodes(openapi), ['not_found']);
	assert.throws(() => apiErrorCodes({}));
});
