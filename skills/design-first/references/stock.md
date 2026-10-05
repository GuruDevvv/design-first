# Stock photos — the first screen is built around a found photograph

The page does not get a photo "inserted". The photo is chosen first, measured, and the layout,
palette and text placement follow from it. A stock photo dropped into a ready layout reads as stock;
a layout cut around one strong frame reads as art direction.

Tools: `stock_search` and `stock_download` (the plugin's own tools — they hold the stock key),
and `scripts/photo.mjs` (`sheet` — the contact sheet, `analyze` — calm zone, text colour, palette,
focus point). All paths given to the tools are absolute.

## 1. A shot brief per screen, before any search

For every screen that carries a photo, write one line into BRIEF.md from the vibe card:

`subject · light · colour temperature · people (none / hands / back / face) · where the text sits · shot type`

Shot types: wide scene · building · close detail · person · object from above · texture. **No two of
the six screens share a photo, and a shot type repeats at most once.** A type-led poster takes no
photo at all.

## 2. Queries: three ladders, in English

Stock search matches tags, not meaning. Two or three concrete nouns per query, 4–6 queries per screen,
taken from three ladders:

1. **The thing itself** — the place, the object, the activity (`kaliningrad`, `pottery wheel`).
2. **The mood without the thing** — what the light and air look like (`street lamp fog`,
   `cobblestone evening`, `sunlight water surface`).
3. **A detail or material** — what a hand would touch (`amber`, `brick arch`, `old map`).

Stock is weak on specific places and events (expect postcards and wrong hits) and strong on moods,
details and materials. When ladder 1 gives postcards, the screen is built on ladder 2 or 3 — a foggy
lamp-lit quay sells an evening walk better than a saturated landmark.

Call `stock_search` with `queries` and `out_dir` = `<abs>/prototypes/stock/<set>` (one set per
screen or per ladder; `vertical: true` for phone crops). Then build the sheet:

```bash
node <skill-dir>/scripts/photo.mjs sheet <abs>/prototypes/stock/<set>/candidates.json
```

## 3. Look at the sheet — reject first, then choose

Open `sheet.jpg` with your eyes. The bold number under each picture is its index in `candidates.json`.

Reject without discussion:
- **wrong subject** — a tag matched, the meaning didn't (a zoo giraffe for a city name, a dish named
  after the city, another country's cathedral);
- **postcard look** — oversaturated sky, HDR halos, noon sun from the front, everything sharp and flat;
- staged smiles at the camera, handshakes, pointing at screens;
- text, watermarks, logos, dates in the frame (postcards, stamps and old documents used *as
  texture* are the exception: there the printed text is the material);
- **a recognisable place that is not the client's** — another city's landmark, skyline or signage.
  Mood and detail shots must be placeless (fog, a lamp, cobbles, brick, hands, water); a famous
  bridge of another city is a lie about the product, however beautiful;
- **a stranger's face standing in for a named person** (the guide, the coach, the founder). Use a
  back view, hands, the place, a detail — and ask the user for their own portrait for the real page;
- no calm area at all — the frame is busy edge to edge.

Prefer: one clear subject, light from a side or from behind, depth (something near, something far),
a calm area of at least a third of the frame, a colour mood you can name in two words.

Fewer than two survivors for a screen → more queries from ladders 2 and 3, not a weaker photo.
Still nothing → that screen becomes a texture or type screen; say so in BRIEF.md.

## 4. Measure the shortlist

Download two or three survivors per screen and measure each:

Call `stock_download` with `candidates`, `assets_dir` = `<abs>/prototypes/assets` and
`picks: [{index: 16, name: "arcade"}, …]`, then:

```bash
node <skill-dir>/scripts/photo.mjs analyze prototypes/assets/arcade.jpg --out prototypes/_an/arcade.png
```

`analyze` returns: `best_zone` (left / right / top / bottom / center — the calmest area, or
`null` when no zone is calm enough: busy above 0.20 or contrast below 3), `text_on_photo` (yes /
with a local gradient or panel / no), per-zone `busy`, `text` (white or black) and `worst_contrast`;
`focus` (x, y of the visual weight); `palette` (six colours, most frequent first). Open the overlay:
a red box is a usable zone, a grey one is only the least busy.

**`best_zone: null` → no text on this photo.** It becomes a framed object, a strip or a backdrop,
and the words sit on a flat field beside it.

When only part of the frame will be visible (`object-fit: cover` in a narrow or tall box), measure
that window: `--crop x0,y0,x1,y1` in fractions of the frame. Zone and focus shift with the crop.

Pick the photo whose calm zone fits the planned skeleton. **If the best photo's calm zone is on the
other side, the layout flips — the photo is never mirrored or forced.**

## 5. Layout follows the photo

- Headline, subheadline and button go **inside the calm zone**, nowhere else.
- `object-fit: cover; object-position: <focus x>% <focus y>%` — the crop keeps the focus, at every width.
- **Size limit: the files are 1280 px wide.** A sharp-subject photo fills at most ~60% of a 1440 screen
  (split, card, framed). Full-bleed is for photos that survive softness: fog, night, water, blur,
  texture — and gets grain on top. `stock_download` warns when a file is heavily compressed (under 120 KB):
  such a file is for fog, night and texture only.
- **Backdrop route:** any photo may go full-bleed when it is deliberately blurred and darkened or
  lightened into a surface (a desk, a wall, a table) and the sharp things — a map, a ticket, a card —
  are drawn in HTML/SVG on top of it.
- Text contrast: `worst_contrast` ≥ 4.5 in the zone → text straight on the photo. Lower → a gradient
  of the photo's own darkest (or lightest) colour **under the text zone only**, or a solid panel.
  Never a grey veil over the whole frame.

## 6. One treatment per screen — this is what removes the "stock" look

Choose one and apply it fully:
- **Graded**: CSS `filter` (contrast, saturate ≤ 0.85, slight sepia or hue shift) + a colour overlay
  in `mix-blend-mode: multiply | soft-light | color` taken from the palette.
- **Duotone**: `grayscale(1)` photo under a two-colour gradient with `mix-blend-mode`.
- **Cut and framed**: the photo as an object — arch, circle, torn edge (`clip-path`), with a
  shadow or a tilt, on a flat field of a palette colour.
- **Grain**: an inline SVG `feTurbulence` layer at 6–10% on top of any of the above.

Hard crops beat whole frames: a third of a good photo is usually stronger than all of it.

**Collage and texture screens** take two to four photos. One leads — the one with the largest area:
its palette is the page's palette and the others are graded to it. Words sit on the flat field or on
a calm object (a blank card), never across the seams.

## 7. Palette comes out of the photo

From `palette`: page background = the photo's lightest or darkest colour (pushed a little further),
text = its opposite, **one accent** = the most saturated colour in the photo; when the photo is
monochrome, its complement or the colour of an object from the topic (stamp ink, pencil red, signal
yellow). Across the six screens the accents must differ — if three come out the same, change two.
Write the hexes into BRIEF.md. Fonts by `typography.md`.

## 8. Phone

Check a 9:16 window around `focus` (`analyze --crop`): if the subject and a calm band above or below
both fit, crop the same photo (`object-position` by focus). If not, search again with
`vertical: true` for the same shot brief. Never squeeze the desktop frame; never stretch.

## 9. Further sections

Same author first (`author` in candidates.json — one photographer, one light), then the same query
family, always the same treatment. A second photo with a different grade breaks the page.

## 10. Files, credits, limits

- Everything is downloaded into the page's `assets/`; no hotlinks (the stock forbids them and the URLs
  expire). `credits.json` is written by `stock_download`; the page footer carries a "Photos: Pixabay" line —
  on a first screen with no footer yet, a small author line in a corner.
- Search is limited (100 requests a minute); previews and downloads are throttled — the tools wait
  and retry on their own. Reuse `candidates.json` instead of repeating a query. The reported total is
  capped at 500, so it says nothing about how good a query is; tags are a hint, the sheet is the proof.
- **No key** → `stock_search` answers with the steps for getting one; pass them to the user as they
  are and go on without stock: type-led screens, texture and objects drawn in CSS/SVG, and the user's
  own photos if they give any (measure those with `analyze` the same way). No network → the same.
