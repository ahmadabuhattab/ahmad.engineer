# ahmad.engineer

A concise, static personal portfolio for Ahmad Abu-Hattab. Black-and-white typography, natural-color photography, selected experience, and contact links.

## Develop

Requires Node.js 20 or newer.

```sh
npm ci
npm run build
npm run dev
```

The site has no runtime or build dependencies. The development command runs the `serve` static server through npm. All pages work without browser JavaScript.

## Deploy

Vercel publishes `public/` from the `main` branch after `npm run build`. The build verifies page headings, local references, JSON-LD, and the absence of executable browser scripts. The existing domain redirects, search verification files, image URLs, and sitemap are preserved.

- `public/index.html`: profile, experience, education, contact.
- `public/photos.html`: a native photo gallery with links to original images.
- `public/404.html`: missing-page response.
- `public/site.css`: shared responsive layout and local font declaration.
- `public/images/`: original photos and optimized WebP alternatives.

The elaborate interactive website was preserved separately before this redesign. Its original production commit is `7e65646630581854ef900e01093400c1f44c0183`.

## Accessibility and performance

Semantic HTML, a keyboard skip link, visible focus outlines, responsive layouts, image dimensions, native navigation, and no motion, GPU rendering, client framework, analytics, or third-party requests. The home page loads one optimized portrait and one self-hosted font.
