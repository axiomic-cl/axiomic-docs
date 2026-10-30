// Serve Scalar's standalone bundle from this site instead of a third-party CDN: the API
// reference then loads only first-party code, pinned by package-lock.json.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = join(site, 'node_modules/@scalar/api-reference/dist/browser/standalone.js');
mkdirSync(join(site, 'public/scalar'), { recursive: true });
copyFileSync(bundle, join(site, 'public/scalar/standalone.js'));
