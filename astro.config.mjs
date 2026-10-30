// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLlmsTxt from 'starlight-llms-txt';

export default defineConfig({
	site: 'https://docs.axiomic.cl',
	trailingSlash: 'ignore',
	integrations: [
		starlight({
			title: 'Axiomic Docs',
			description:
				'Cobros por transferencia bancaria en Chile, para devs y sus agentes: API, webhooks firmados, recibos verificables y modo de prueba.',
			logo: { src: './src/assets/wordmark.png', replacesTitle: true, alt: 'Axiomic' },
			favicon: '/favicon.png',
			defaultLocale: 'root',
			locales: { root: { label: 'Español', lang: 'es-CL' } },
			customCss: ['./src/styles/axiomic.css'],
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/axiomic-cl/axiomic-docs' }],
			editLink: { baseUrl: 'https://github.com/axiomic-cl/axiomic-docs/edit/main/' },
			lastUpdated: true,
			tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
			head: [
				{ tag: 'meta', attrs: { name: 'theme-color', content: '#0354f6' } },
				{ tag: 'link', attrs: { rel: 'alternate', type: 'text/plain', href: '/llms.txt', title: 'llms.txt' } },
			],
			sidebar: [
				{
					label: 'Empezar',
					items: [
						{ label: 'Tu primer cobro de prueba', slug: 'empezar/quickstart' },
						{ label: 'Pedir acceso', slug: 'empezar/pedir-acceso' },
					],
				},
				{ label: 'Conceptos', items: [{ autogenerate: { directory: 'conceptos' } }] },
				{
					label: 'Referencia',
					items: [
						{ label: 'API de cobros', link: '/api/' },
						{ label: 'Errores', slug: 'errores' },
						{ label: 'Novedades', slug: 'referencia/novedades' },
					],
				},
			],
			plugins: [
				starlightLlmsTxt({
					projectName: 'Axiomic',
					description:
						'Axiomic es una pasarela de cobros por transferencia bancaria en Chile, con API REST, webhooks firmados, recibos verificables, modo de prueba con banco simulado y mandatos para agentes de IA.',
					details:
						'Todo corre hoy en modo de prueba: `https://api.axiomic.cl` usa un banco simulado y ningún peso real. Montos en CLP como enteros. Autenticación con `Authorization: Bearer axk_test_…` desde el servidor, nunca desde el navegador.',
					optionalLinks: [
						{
							label: 'OpenAPI 3.1',
							url: 'https://docs.axiomic.cl/openapi/payments-v1.json',
							description: 'Todas las rutas, esquemas, errores y webhooks de la API de cobros v1',
						},
					],
					promote: ['empezar/quickstart*', 'conceptos/*'],
				}),
			],
		}),
	],
});
