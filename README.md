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
- `src/world-environment.js` and `src/world-life.js` supply the procedural observatory: portal, luminous floor, skyline, intelligence lattice, industrial landmark, drones, drifting fragments, and atmospheric particles. HDR bloom, filmic shading, optical arrival effects, and generated environment reflections give the scene depth without downloaded models or textures.
- `src/world-explorer.js` moves the existing canvas into a native modal dialog. A camera arrival and optional guided journey introduce three districts. Visitors can select landmarks, drag, scroll, use labeled camera buttons, or press 0–3 to navigate. Interactive studies activate resonance, send a signal through the lattice, and ignite the foundry. These are imaginative visual studies, not live industrial data. Escape restores the opener and page position, while chapter links return to the portfolio.
- Scene snapshots, interface hiding, and feature-detected fullscreen are available inside the observatory. `src/world-audio.js` creates optional procedural ambience only after the visitor enables sound; it fades and suspends with pause, a hidden page, or a closed world.
- “Bend spacetime” (keyboard B) draws the observatory into a gravitational core and unfolds it again over 12 seconds. `src/world-spacetime.js` supplies one reversible timeline for the geometry, camera, lens distortion, and lightweight renderer. The event clears visual controls temporarily while keeping Pause, Exit, and Restore available. It respects subsequent pause/visibility changes, cancels on navigation, and restores the original scene.
- `src/world-singularity.js` adds inclined accretion streams, field filaments, orbital dust, polar outflows, and a transient event horizon in four to six batched draws. Its shaders clamp power bases for numerically stable HDR bloom. `src/world-pointer.js` adds a small desktop landmark annotation without replacing the native cursor or running an idle animation loop.
- `src/energy-loader.js` upgrades the immediately visible artwork to WebGL on capable phones and computers. A lightweight Canvas renderer supports data-saving visitors and initialization failures. The renderer is selected once per page and resizes in place. Reduced-motion preferences default to static artwork, with an explicit “Enable animation” option.
- `src/energy-core.*` and `src/energy-mobile.js` animate metallic orbit fragments, nucleus shards, shockwaves, and luminous particles. The shared `src/energy-cycle.js` timeline charges, explodes, suspends, and reconstructs the sculpture every 15 seconds. “Release energy” or a short tap on the sculpture starts the sequence when it is in orbit.
- The motion control freezes the scene at its current position. Rendering also stops outside the viewport and while the page is hidden, and resumes without advancing through the elapsed hidden time. Resolution and frame rate are bounded. Loss of WebGL returns to the artwork and recovery restores the scene. The collector card retains its original independent controls.
- Explicitly entering the observatory initializes a still, manually explorable scene even with reduced motion. Camera and study inputs redraw without resuming ambient motion; the guided journey explicitly enables motion. Mobile rendering caps resolution, multisampling, and bloom cost. Enlarged text uses a scrollable layout; ordinary short screens retain the full-viewport world.
- `src/steel-card.js`, `src/steel-card.css`, and `src/steelworks.js` are preserved from the existing STELCO experience. The card's design, structure, and behavior are unchanged; its punctuation follows the requested site-wide copy cleanup.
- `public/photos.html` keeps the existing gallery with accurate image metadata. `public/sitemap.xml` lists canonical pages and the gallery images.
- Fonts are the same Google Fonts versions, now served locally. Licenses and exact source URLs are in `public/fonts/README.md`.

The share preview is `public/og-portfolio-2026.jpg` (1200 × 630). Hero artwork is served responsively: `public/observatory-gravity-2026.jpg` on desktop and `public/observatory-gravity-mobile-2026.jpg` on phones. These images are rendered from the actual portfolio scenes and appear before interactive rendering starts.

## Spacetime verification: September 10, 2026

- Production build passes. The complete five-phase sequence, repeat activation, B/0–3 shortcuts, pause, page visibility, cancellation, capture, close/reopen, and the data-saving Canvas fallback were checked with no browser errors.
- Layouts pass at 320, 390, 639, 844, and 1440px, including short landscape and 200% text enlargement. Pause and Exit remain accessible above the scene in enlarged-text mode. The pointer respects coarse touch, reduced motion, paused motion, and cinematic mode.
- Collapse, release, and restored frames were visually checked through the actual HDR pipeline on desktop and mobile. New GPU resources dispose cleanly, and the shader module performs no per-frame geometry allocations.
- Requested punctuation was removed from page content, accessibility labels, metadata, and generated CSS. Gallery image URLs, captions, schema, and sitemap now use neutral Toronto portrait wording. Renamed images retain their original bytes; all current image references resolve.
- Local Lighthouse mobile audit: performance 91, accessibility 100, best practices 100, SEO 100, CLS 0, and total blocking time 130ms. These are lab measurements, not guarantees of field performance or search rankings.

## Living observatory verification: September 9, 2026

- Production build passes. Desktop and emulated phone checks cover the journey, all studies, landmark selection, camera controls, snapshot downloads, fullscreen, hidden interface, optional audio, close/reopen, and reduced motion, with no page errors.
- Responsive checks cover 320–1440px, short landscape, and 200% text enlargement. WebGL context loss/recovery and resource cleanup were checked; the generated environment map and background restore correctly.
- Audio checks verify gesture-only initialization, pause/visibility handling, disabled or unavailable audio, and disposal. The original collector-card source and markup remain unchanged.
- Local Lighthouse mobile audit: performance 94, accessibility 100, best practices 100, SEO 100, CLS 0, and total blocking time 60ms. These are lab measurements, not guarantees of field performance or search rankings.

## Release verification: September 6, 2026

- Clean production build passed.
- Browser checks passed at 360, 390, 768, 1024, and 1440px widths with no page errors or failed local asset requests.
- Navigation, project disclosures, FAQs, collector-card flip, scene pause/resume, reduced motion, gallery navigation, and content without JavaScript verified.
- Explosion and reconstruction verified on desktop and mobile, including keyboard activation, unchanged pixels while paused, offscreen suspension, resizing across the breakpoint, and WebGL context loss/recovery. The shared timeline restores exact home positions across 30 sampled cycles.
- Automated WCAG A/AA accessibility scan: zero violations.
- Local Lighthouse mobile audit after the interaction fixes: performance 96, accessibility 100, best practices 100, SEO 100; CLS 0 and total blocking time 60ms. These are lab measurements, not guarantees of field performance or search rankings.

Production verification must also check the canonical domain, Vercel redirects, sitemap, robots, verification files, share image, and real 404 responses.

## Interaction and responsive audit

- Exercised every homepage link, all seven project/FAQ disclosures, and hero controls at 320, 390, 768, and 1440px: 124 checks passed with zero page errors. Email actions were checked without sending mail; external-link targets were verified. LinkedIn blocks automated HTTP checks, while the configured profile link opens correctly.
- All 25 collector-card checks pass, including keyboard, touch, permission-result simulations for phone tilt, reduced motion, renderer fallbacks, and no-JavaScript readability. The card source and markup remain unchanged; a page-level no-script style hides its inactive controls when scripting is disabled.
- All gallery navigation links, seven photos, captions, deep links, and 404 recovery links were checked. Fixed the breadcrumb overlay blocking navigation, low-contrast gallery text, delayed photo reveals, and photo anchor positioning.
- Layout inspection covered 320–1920px widths and landscape. Fixed enlarged-text clipping, wrapping navigation, metric columns, photo heading layout, and zero-width waveform bars on narrow screens. Follow-up checks at 200% text enlargement pass without text overflow.
- Chrome and Edge desktop/mobile checks pass. Gallery and homepage accessibility scans report zero violations. Phone layouts and sensor permission results are emulated; physical sensor calibration depends on the visitor's device.
