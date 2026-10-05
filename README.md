# Design First

A Claude plugin for people who are not designers and still need a page that looks like somebody
cared. Instead of one "clean modern" layout, you get **six genuinely different first screens** for
your topic, pick the one that feels right, and it grows into a live page for desktop and phone.

It works in **Claude Code**. In the Claude apps without a terminal it can still read the topic and
write the screens, but it cannot search photos or check the result.

## What it does

1. Reads your project and asks only what it could not find out itself.
2. Reads the *vibe*: who is looking, what pages in this genre usually look like, which moods fit.
3. Fixes the words (headline, subheadline, button) so that you compare design, not copy.
4. Finds stock photographs, looks at them, and **measures** each one: where the calm area for text
   is, whether text will be readable there, what palette the photo carries.
5. Builds six first screens, each around its own photo, type or texture — the layout follows the
   photo, not the other way round.
6. Checks every screen in a real browser (contrast, overflow, missing fonts, broken images) and
   shows you a gallery. You pick one or mix two.
7. Builds the phone version and the next sections, checks again.

Finding photos and building the six screens takes **about twenty minutes** (21 minutes in our
measured run). The phone step is newer and less tested than the desktop one.

## Example prompts

- `Design a landing page for a private city guide in Kaliningrad, people should book a walk.`
- `Сделай дизайн лендинга детской школы плавания, нужна запись на пробное занятие.`
- `Redesign the dashboard in this project — show me six directions before touching the code.`

## Requirements

- Claude Code with a shell.
- Node.js 22 or newer.
- Chrome, Edge or Chromium installed (set `CHROME_PATH` if it lives somewhere unusual).
- Optional but recommended: a free Pixabay API key (below).

## Getting the photo key (two minutes, free)

Photo search uses [Pixabay](https://pixabay.com). Without a key the plugin still works, but builds
screens from type and drawn textures only.

1. Open <https://pixabay.com/api/docs/>.
2. Press **Sign up** and register (a Google account works).
3. Come back to the same page. In the **Parameters** table, the row **key** now shows your key.
4. Copy it. In Claude Code type `/plugin`, choose Design First, open its options and paste the key
   into **Pixabay API key**.
5. Start a new session.

## Install

From the Claude plugin directory: **Customize → Plugins → Discover → Design First**.

To try a local copy: `claude --plugin-dir <path to this folder>`.

## What it runs, sends and fetches

- **Runs locally:** two Node scripts (`check.mjs`, `photo.mjs`) that start a headless Chrome on your
  machine, and one small local helper (`server/stock-server.mjs`) that talks to the photo stock.
  No packages are installed; there are no dependencies.
- **Sends out:** photo search words to `pixabay.com`, together with your Pixabay key. Nothing else —
  no project files, no page content, no analytics.
- **Fetches:** search results and photos from `pixabay.com` (saved into your project's
  `prototypes/assets/`, with authors recorded in `credits.json`); web fonts from Google Fonts in the
  pages it builds; and, when reading the genre, screenshots of two or three public pages on your topic.
- **Stores:** the key is kept by Claude Code in your system's secure storage. The plugin writes only
  inside your project's `prototypes/` folder.

See [PRIVACY.md](PRIVACY.md).

## Photos and licences

Photos come from Pixabay under the [Pixabay Content License](https://pixabay.com/service/license-summary/).
They are downloaded, never hot-linked, and the built page carries a "Photos: Pixabay" line with the
authors. The plugin does not generate images. It will not pass another city off as yours or a
stranger's face off as a named person — for a portrait, give it your own photo.

## Credits

- `references/feel-polish.md` is distilled from *Details that make interfaces feel better* by Jakub
  Krehel ([jakubkrehel/make-interfaces-feel-better](https://github.com/jakubkrehel/make-interfaces-feel-better), MIT).
- `references/frontend-aesthetics.md` is adapted from Anthropic's frontend aesthetics guidance in the
  Claude Cookbook.

## Support

Questions and bugs: <https://github.com/GuruDevvv/design-first/issues>.

MIT licence.
