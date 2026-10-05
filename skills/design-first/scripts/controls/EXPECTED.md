# Control pages for check.mjs

Run: `node ../check.mjs . --widths 390` from this folder. Expected:

| File | Must be |
|---|---|
| bad-group-opacity.html | FAIL unreadable (about 2.85 — the panel and the text fade together) |
| good-alpha-panel.html | clean (about 8.8; a naive calculation gives a false 1.26) |
| bad-low-contrast.html | FAIL unreadable |
| bad-overflow.html | FAIL horizontal scroll |
| bad-stuck-reveal.html | FAIL invisible after full scroll |
| good-clean.html | clean |

When you change check.mjs, run this set: every bad-* must fail, every good-* must pass.
