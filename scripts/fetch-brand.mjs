// Descarga los recursos de marca públicos de www.emaservicios.com.ar a frontend/public/brand.
// Si no hay conexión, la app usa el logotipo tipográfico incorporado.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.BRAND_SITE || 'https://www.emaservicios.com.ar';
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../frontend/public/brand');
mkdirSync(out, { recursive: true });
const files = { 'logo-color.png': '/images/logo-color.png', 'logo-azul.png': '/images/logo-azul.png', 'favicon.svg': '/favicon.svg' };
for (const [name, path] of Object.entries(files)) {
  try {
    const r = await fetch(base + path, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    writeFileSync(resolve(out, name), Buffer.from(await r.arrayBuffer()));
    console.log('✔ marca:', name);
  } catch (e) {
    console.warn(`⚠ No se pudo descargar ${name} (${e.message}). Se usará el logotipo alternativo.`);
  }
}
