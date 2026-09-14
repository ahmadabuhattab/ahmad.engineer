import { readFile, access, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

// Remove the previous site's generated bundles when rebuilding an older checkout.
const legacyOutput = resolve('public/card');
if (dirname(legacyOutput) !== resolve('public')) throw new Error('Unexpected output directory');
await rm(legacyOutput, { recursive: true, force: true });

const pages = ['index.html', 'photos.html', '404.html'];
for (const name of pages) {
  const html = await readFile(`public/${name}`, 'utf8');
  if (!/<h1[\s>]/.test(html)) throw new Error(`${name}: missing page heading`);
  if (/<(?:canvas|video|audio)\b|<script(?![^>]*type="application\/ld\+json")/i.test(html)) {
    throw new Error(`${name}: this site must remain static and free of animation runtimes`);
  }
  for (const match of html.matchAll(/(?:src|href)="(\/[^"#?]*)/g)) {
    if (['/', '/photos', '/site.webmanifest', '/sitemap.xml'].includes(match[1])) continue;
    await access(resolve('public', `.${match[1]}`));
  }
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(match[1]);
}
JSON.parse(await readFile('public/site.webmanifest', 'utf8'));
await access('public/site.css');
console.log(`Static portfolio verified: ${pages.length} pages, no browser JavaScript.`);
