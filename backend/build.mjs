// Bundle del backend (incluye el código fuente compartido del scorm-engine)
import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const root = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const engine = process.env.ENGINE_SRC || resolve(root, '../scorm-engine/src');

await build({
  entryPoints: {
    server: 'src/server.ts',
    'create-admin': 'src/scripts/create-admin.ts',
    seed: 'src/scripts/seed.ts',
    migrate: 'src/scripts/migrate.ts',
  },
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  external: Object.keys(pkg.dependencies).filter((d) => d !== 'lucide'),
  alias: { '@engine': engine + '/index.ts' },
  logLevel: 'info',
});
