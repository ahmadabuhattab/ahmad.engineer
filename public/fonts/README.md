# Locally served fonts

These are unmodified WOFF2 files returned by the website's existing Google Fonts stylesheet on September 6, 2026:

https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500&display=swap

The request used a current desktop Chromium user agent. `src/fonts.css` retains the original Latin and Latin-ext unicode ranges, `font-display: swap`, styles and individual weights; only the source URLs point to these local files. Unused Latin-ext subsets load only if the page needs those characters. No font file was regenerated or modified.

Inter's Google Fonts CSS uses the same variable WOFF2 binary for 300, 400 and 500. The stylesheet intentionally retains three separate weight declarations to preserve the original weight matching and synthesis behavior.

## Licenses and authors

- Inter: Copyright 2020 The Inter Project Authors. Licensed under SIL Open Font License 1.1; see `inter-OFL.txt`. Project: https://github.com/rsms/inter. License source: https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt
- Instrument Serif: Copyright 2022 The Instrument Serif Project Authors. Licensed under SIL Open Font License 1.1; see `instrument-serif-OFL.txt`. Project: https://github.com/Instrument/instrument-serif. License source: https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentserif/OFL.txt

## Original binary sources

- `inter-v20-latin.woff2`: https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2
- `inter-v20-latin-ext.woff2`: https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa25L7SUc.woff2
- `instrument-serif-v5-latin-regular.woff2`: https://fonts.gstatic.com/s/instrumentserif/v5/jizBRFtNs2ka5fXjeivQ4LroWlx-6zUTjg.woff2
- `instrument-serif-v5-latin-ext-regular.woff2`: https://fonts.gstatic.com/s/instrumentserif/v5/jizBRFtNs2ka5fXjeivQ4LroWlx-6zsTjmbI.woff2
- `instrument-serif-v5-latin-italic.woff2`: https://fonts.gstatic.com/s/instrumentserif/v5/jizHRFtNs2ka5fXjeivQ4LroWlx-6zAjjH7M.woff2
- `instrument-serif-v5-latin-ext-italic.woff2`: https://fonts.gstatic.com/s/instrumentserif/v5/jizHRFtNs2ka5fXjeivQ4LroWlx-6zAjgn7MsNo.woff2
