# ahmad.engineer

Ahmad Abu-Hattab’s static portfolio. Vercel builds `public/` from the `main` branch.

## Run

```sh
npm ci
npm run build
npm run dev
```

Run the build before previewing. It regenerates the ignored `public/card/` asset directory, including the portfolio styles, local font declarations, and split JavaScript bundles.

## Experience

- `public/index.html` contains the complete crawlable portfolio, biography, experience, project descriptions, and contact links.
- `src/experience.*` provides layout, motion controls, scroll reveals, and progress. Content remains readable without JavaScript.
- `src/energy-loader.js` upgrades the immediately visible core artwork to interactive WebGL on larger screens. Mobile, reduced-motion, and data-saving users receive lightweight artwork. The motion control pauses portfolio animation; the collector card retains its original independent controls.
- `src/energy-core.*` creates the orbital scene. Rendering stops outside the viewport and while the page is hidden; resolution and frame rate are bounded. Loss of WebGL falls back to the original rendered artwork.
- `src/steel-card.js`, `src/steel-card.css`, `src/steelworks.js`, and the collector-card markup are preserved from the existing STELCO experience.
- `public/photos.html` keeps the existing gallery with accurate image metadata. `public/sitemap.xml` lists canonical pages and the gallery images.
- Fonts are the same Google Fonts versions, now served locally. Licenses and exact source URLs are in `public/fonts/README.md`.

The share preview is `public/og-portfolio-2026.jpg` (1200 × 630). The lightweight hero artwork is `public/energy-core-2026.jpg` (900 × 900). Both are rendered from the portfolio’s original orbital scene.

## Release verification — September 6, 2026

- Clean production build passed.
- Browser checks passed at 360, 390, 768, 1024, and 1440px widths with no page errors or failed local asset requests.
- Navigation, project disclosures, FAQs, collector-card flip, scene pause/resume, reduced motion, gallery navigation, and content without JavaScript verified.
- Automated WCAG A/AA accessibility scan: zero violations.
- Local Lighthouse mobile audit: performance 96, accessibility 100, best practices 100, SEO 100; CLS 0 and total blocking time 0ms. These are lab measurements, not guarantees of field performance or search rankings.

Production verification must also check the canonical domain, Vercel redirects, sitemap, robots, verification files, share image, and real 404 responses.
