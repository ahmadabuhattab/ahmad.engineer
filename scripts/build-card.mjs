import { build } from 'esbuild';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const outputDirectory = resolve('public/card');
if (dirname(outputDirectory) !== resolve('public')) throw new Error('Unexpected build output directory');
await rm(outputDirectory, { recursive: true, force: true });
await mkdir('public/card', { recursive: true });
await build({
  entryPoints: ['src/steel-card.js', 'src/energy-loader.js', 'src/experience.js', 'src/fonts.css'],
  outdir: 'public/card',
  bundle: true,
  external: ['/fonts/*'],
  splitting: true,
  format: 'esm',
  target: ['es2020'],
  minify: true,
  legalComments: 'linked',
  chunkNames: '[name]-[hash]',
  logLevel: 'info',
});
await writeFile('public/card/THREE-LICENSE.txt', await readFile('node_modules/three/LICENSE'));
