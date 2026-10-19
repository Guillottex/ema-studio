// Build del motor SCORM: genera dist/player.js, dist/scorm12.js, dist/player.css y dist/fonts/*
import { build } from 'esbuild';
import { mkdirSync, copyFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dist = resolve(root, 'dist');
mkdirSync(resolve(dist, 'fonts'), { recursive: true });

// En el player, el adaptador SCORM se toma de scorm/scorm12.js (window.EMAScorm)
const scormShim = {
  name: 'scorm-shim',
  setup(b) {
    b.onResolve({ filter: /\/scorm12$/ }, (args) => {
      if (args.importer.endsWith('scorm12-shim.ts')) return undefined;
      return { path: resolve(root, 'src/runtime/scorm12-shim.ts') };
    });
  },
};

const common = { bundle: true, minify: true, target: ['es2019', 'chrome70', 'firefox68', 'safari12'], legalComments: 'none', logLevel: 'info' };

await build({ ...common, entryPoints: [resolve(root, 'src/entry-scorm.ts')], outfile: resolve(dist, 'scorm12.js'), format: 'iife', minify: false });
await build({ ...common, entryPoints: [resolve(root, 'src/entry-player.ts')], outfile: resolve(dist, 'player.js'), format: 'iife', globalName: 'EMAPlayer', plugins: [scormShim] });
await build({ ...common, entryPoints: [resolve(root, 'src/css/player.css')], outfile: resolve(dist, 'player.css'), loader: { '.css': 'css' } });

// Fuentes embebidas (latin 400/700, woff2)
for (const pkg of ['outfit', 'poppins', 'inter', 'roboto', 'open-sans', 'montserrat', 'lato', 'merriweather']) {
  const dir = resolve(root, 'node_modules/@fontsource', pkg, 'files');
  if (!existsSync(dir)) continue;
  for (const w of [400, 700]) {
    const f = `${pkg}-latin-${w}-normal.woff2`;
    if (readdirSync(dir).includes(f)) copyFileSync(resolve(dir, f), resolve(dist, 'fonts', f));
  }
}
console.log('scorm-engine: build OK');
