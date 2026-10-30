# Axiomic Docs

El código de [docs.axiomic.cl](https://docs.axiomic.cl): la documentación pública de la API de
cobros por transferencia de Axiomic. Está hecha con [Astro Starlight](https://starlight.astro.build),
la referencia de la API con [Scalar](https://scalar.com) y la búsqueda con Pagefind.

## Desarrollo

Necesitas Node 22 o superior.

```sh
npm ci
npm run dev
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Sirve el sitio en `http://localhost:4321` y recarga al editar. |
| `npm run build` | Construye `dist/` y falla si hay un enlace o un ancla rota, o un código de error de la API sin su sección en `/errores`. |
| `npm test` | Prueba la sincronización y el verificador de enlaces. |
| `npm run check` | Revisa los tipos de las páginas Astro. |
| `npm run sync -- ../axiomic-backend` | Trae las guías probadas y el OpenAPI desde un checkout del backend. |

## De dónde sale el contenido

- **El backend es la fuente de verdad de lo probado.** Su CI corre el Quickstart y ata el catálogo
  de errores al enum `ErrorCode`. `npm run sync` copia `quickstart.md`, `errores.md` y el OpenAPI,
  los adapta a la API alojada y anota el commit de origen. No edites esas páginas aquí: cambia la
  guía en el backend y vuelve a sincronizar.
  - `src/content/docs/empezar/quickstart.mdx`
  - `src/content/docs/errores.mdx`
  - `public/openapi/payments-v1.json`
- **El resto se escribe aquí:** la portada, los conceptos, «Pedir acceso» y las novedades.

Si la sincronización falla porque una guía del backend cambió de forma, ajusta
`scripts/sync-lib.mjs` y su prueba: es mejor que publicar pasos viejos.

## «Pedir acceso»

El formulario de [/empezar/pedir-acceso/](src/content/docs/empezar/pedir-acceso.mdx) envía a la
Pages Function [`functions/solicitudes.js`](functions/solicitudes.js). La Function valida los campos,
comprueba el desafío de Turnstile (hostname `docs.axiomic.cl` y acción `pedir-acceso`) y guarda la
solicitud en D1 por 90 días. La lógica vive en [`access/request.mjs`](access/request.mjs), con sus
pruebas.

Los bindings (`ACCESS_DB`, `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`) los define
`axiomic-infra` solo para producción. En un preview o en local, el formulario queda oculto y la
página muestra el correo.

## Publicación

Cada push a `main` construye el sitio y lo sube a Cloudflare Pages con `wrangler pages deploy`.
Usa el secreto `CLOUDFLARE_PAGES_TOKEN`, un token que solo tiene *Cloudflare Pages: Edit*, y la
variable `CLOUDFLARE_ACCOUNT_ID`.

## Contribuir

Abre un PR contra `main`. El CI construye el sitio y verifica enlaces, anclas y códigos de error.
El contenido va en español de Chile; el código y los commits, en inglés.

## Licencia

[MIT](LICENSE).
