import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

await mkdir('public/card', { recursive: true });
await build({
  entryPoints: ['src/steel-card.js'],
  outdir: 'public/card',
  bundle: true,
  splitting: true,
  format: 'esm',
  target: ['es2020'],
  minify: true,
  legalComments: 'linked',
  chunkNames: '[name]-[hash]',
  logLevel: 'info',
});
await writeFile('public/card/THREE-LICENSE.txt', await readFile('node_modules/three/LICENSE'));
