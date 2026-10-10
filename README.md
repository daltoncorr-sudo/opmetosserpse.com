# opmetosserpse.com

The studio site for Opmet Osserpse. A hand-kept static site: plain HTML, one stylesheet, one small script, no framework, no npm.

## How it works
- `content/site.json`: every word on the home page (the few lines after the cover and the words that link), the foundry holding page, Privacy and 404, plus the footer and clock.
- `content/projects/<slug>.json`: one file per project page. The page shows `title`, `lede`, the images of its daltoncorr.com page (`media` gives the alt text and size of the ones that were already here), the facts from `client`, `year`, `role` and `links`, and the end credits from `credits`. `deck` stays in the file for search descriptions; `challenge`, `work`, `system`, `deliverables` and `press` are the source of the notes, for press and later use.
- `content/notes/<slug>.json`: the new words for each project page, for D's approval: its opener, the "Work" fact, chapter labels, notes, photographers, how each film rests and plays, and (Sunny's only) the items it hides. Every word comes from the project's own file. `_review/` lists them all in one page.
- `content/work.json`: the one list of every project (35), with `slug`, `title`, `year`, one or two `tags` from its controlled list, `selected` and `media` (empty for now). It drives Selected works, the Archive on the home page and `/projects/`; the build stops if it drifts from the project pages.
- `content/journal.json` and `content/journal/<slug>.txt`: the Journal (see "The Journal" below).
- `content/index.json`: `project_order`, the one list that sets the order of the projects on home and on `/projects/`. `home_order` is kept for now but unused.
- `static/`: CSS, JS, the interim fonts (SIL Open Font License, licenses included), the two Opmet Serif subsets and the hand. The subsets (`fonts/opmet-serif/`) were cut once from the v48 build in `03_Type/opmet-serif/` with fontTools, outside the build: `opmet-serif-title.woff2` is the italic cut to the name's letters, `opmet-serif-oa.woff2` the upright cut to O and a, both keeping the weight axis.
- `moves/`: the hand's moves on the cover, one folder each. `moves.py` loads them for the build, and `moves_lab.py` writes a workbench page, `_lab/hand.html`. See `moves/README.md`.
- `dc_source.py`: reads each project's page in the daltoncorr.com clone for its images, films and 3D and interactive pieces, in order, and brings those pieces' scripts (three.js r128 from `static/js/vendor/`, never a CDN), styles and files across.
- `build.py`: reads the content, pulls each image from a clone of the daltoncorr.com repo (`daltoncorr-sudo/daltoncorr-porfolio`), resizes it to WebP at 800, 1600 and 2400 px, writes each film as WebM and MP4 with a WebP poster frame (ffmpeg), and writes the finished site to `docs/`.
- `serve.py`: previews `docs/` the way GitHub Pages serves it.
- `check.py`: checks the build for broken links, placeholder text and house-style words, and the project pages for alt text, looping video, long notes, too many chapters, media order, project order and the way each page ends, and that Dalton's name appears only in credits.

## Build and preview
```bash
python3 -m pip install Pillow
brew install ffmpeg        # for video only
python3 build.py --daltoncorr ../_sources/daltoncorr-porfolio
python3 check.py
python3 serve.py            # http://127.0.0.1:8080/
```
The first build takes a few minutes, while it encodes about 400 images; later builds reuse them. Add `--zip` to also write a zip of each project's images for press.

## The rules of the look
The standard is a top agency, not a template. Image first. Very few words, only where needed. Extreme restraint, on project pages too.
- **The home page:** the hand and the name, alone in the center of the first screen. Below the scroll: a few short lines about the studio, then a plain list of the 22 projects. Nothing else.
- **No menu bar anywhere.** Inner pages carry only the hand and the name, small and centered, which link back to the cover. Project pages and the Journal carry the masthead instead (below).
- **Dalton Corr's name doesn't appear on the site,** except in a project's credits, as "Dalton Corr, Opmet Osserpse." The studio speaks for itself.
- An off-white ground (`--paper: #FBFBF8`), near-black ink, no accent color: the work brings every color.
- Two typefaces (Libre Caslon Text for names, Instrument Sans for the rest), two sizes, one weight. When Opmet Serif ships, put it first in `--serif`. Project pages are the exception: see below. The studio's name, Opmet Osserpse, is live text in Opmet Serif's italic (Medium) on the cover and in the inner pages' header (the wordmark's style and weight); in the masthead it is plain bold, like the rest of the masthead. The controls use Source Serif 4 italic, for its weight axis (see "The controls").
- Plain lists of names: no years, dividers, numbers or boxes. No section headers.
- **A project page** sits on a 12-column grid (40 px page margins and 24 px gutters at 1440 px). The title and credits are always at the top; any text that explains goes in the margins.
  - **The opening:** the masthead, the Journal's own component, as the studio's small nameplate: the hand mark to the left of Opmet and Osserpse, the two words left-justified on each other, the pair centered, linking to the cover. Directly under it, All work, which opens the full work list. No Back or Home. A line above the title, set like it, when a project has one ("20th Anniversary", from the notes file's `kicker`). The title, centered, large, in the bold serif: the focus of the page (`--pt`). Under it, across the eight middle columns, the `lede` on the left and one list on the right: the facts (client, year, work, role, link), then the credits, short: our credit under its first role ("Art direction: Dalton Corr, Opmet Osserpse"), partners who fabricated or produced something, and photography (left out until the photographers are known). Nothing else. No rules or lines.
  - **The work,** centered: every image, film, 3D model and interactive piece on the project's daltoncorr.com page, in that page's order (Sunny's Bookshop leaves out eight repeats). Up to four chapters of 2 to 5 words each (only on projects with eight or more items); each label sits in the left margin beside its first block, on one line. Under 1100 px the margin is too narrow, so the labels are left out. Text never shrinks a picture. Portrait pictures fill the eight middle columns; rows and landscape pictures always run across ten; full bleeds run edge to edge; 56 px apart. Under 1100 px (phones too), where the margins are too narrow for text, the notes and chapter labels are left out and pictures widen (rows and landscape pictures to the full width); a film's Play links stay. Pictures from one gallery on daltoncorr.com sit two to a row, at one height, 24 px apart, so a gallery reads as a group; a billboard, a film and a 3D piece each have their own row.
  - **No notes.** The pictures speak for themselves (D, Oct. 9, 2026). The notes files keep the field, empty, in case a note is ever needed; a film's Play links still show.
  - **At the end:** All work again, the same control. Never a next project.
  - The title at 44 px in the bold serif (34 px on phones); the 16 px opening paragraph and 13 px for the rest in Instrument Sans with its italic. Gray text is #6B665E.
  - Films show a poster frame, play once (muted) when on screen, and rest on a chosen frame, with "Play again" in the note. A film with sound plays only when asked. Nothing loops. Pictures never move; the 3D models and interactive pieces move only as they do on daltoncorr.com.
- One motion value, 0.5 seconds, for fades and page changes. The one exception is the hand on the cover: after it arrives it waves, then plays one move about every 10 seconds, at random and never twice in a row, only while the cover is on screen: wave, spin, shrug, mirror, high five, a watch check, and thumbs up once its drawing exists. Each move has anticipation, overshoot and a settle. Reduced motion turns all of it off.
- **Hand moves:** each move is a folder in `moves/`, with its drawings in the same folder. See `moves/README.md`. The thumbs-up move waits for `moves/thumbs/thumbs-up.svg`.
- Copy: AP style, sentence case, no serial comma, the name as two words (*Opmet Osserpse*), espresso tempo in lowercase, no all caps, never "vibes," and never "AI" except inside a Journal article's body. Ordinals (22nd) are superscript everywhere: `build.py` writes them (`typo()`), so the content stays plain text.
- **About:** Home at the top left, the paragraphs in the first eight columns of a 12-column grid, the press from the ninth, set a little lower.

## The Journal
`/journal/` and `/journal/<slug>`: the studio's articles, as their own pages and as a panel above home (the cover menu's Journal, shown even before the first post; /journal/ stays out of the sitemap, and noindex, until a post is published). The masthead is Opmet, Osserpse, Journal in the big type, all plain bold, its lines left-justified on each other and the block centered (on project pages the same component is the small nameplate: the hand mark to the left of Opmet Osserpse, the pair centered), with the writing hand beside the last word (`static/brand/writing-hand.svg`, static: no animation for now; `[data-journal-hand]` and `[data-journal-word]` are kept as hooks, unused), then the line from `site.json`. It is one component with the project pages' masthead (`build.py` `masthead()`). The list is centered like the work list; an article's text column is centered, its note margin to the right.
- **Posts:** `content/journal.json` lists them, newest first by `date` (ISO), with one or two tags from `tags` and `selected`. `"draft": true` keeps a post off the site (no page, no row, not in the sitemap); `python3 build.py --drafts` builds drafts for a local preview (never ship it). Only a draft may be undated or have an empty `.txt`.
- **Text:** `content/journal/<slug>.txt`, one paragraph per block, blocks separated by a blank line. Pictures live in `content/journal/images/<slug>/`. Two kinds of block are pictures, not text:
  - `image: <file> | <alt text> | <size> | <caption>`: size is `column` (the text's width, the default), `pair` (two pair lines in a row sit side by side, at one height) or `wide` (the whole column); the caption is optional. `image: <file> | <alt text>` still works.
  - `note: <file> | <what the note says> | <degrees>`: a handwritten note (a transparent PNG scan) in the margin beside the paragraph it follows, turned by the optional degrees (up to 15 either way). Under 1280 px, where the margin doesn't fit, it drops below its paragraph, a little smaller.
- The last paragraph ends on a tiny hand. "AI" and all caps are allowed only inside the article body.

## The controls
One system (`build.py` `ctl()`, `site.css` `.ctl`, `site.js` `opmetCtl` and `opmetFilters`); every control of a kind looks and behaves the same everywhere.
- **List labels** (Selected work, All work, Selected articles, All articles at the head of a list): `.work-label`, the serif.
- **List toggles and links** (See more, See less, Home, All work, All articles, the cover's options, the Foundry's Home and Back): `.ctl`, Source Serif 4 italic at one size, in ink, no underline. Hover sweeps the word's weight with the cursor, thin at its left edge to black at its right; a hidden copy at the heaviest weight holds the width, so nothing moves. With reduced motion the word simply turns bold. At least 44 px square to touch, without taking more room in its line; the focus ring shows for the keyboard.
- **Filters** (the Journal's topics; the Foundry's All, Digital and Physical, still at `#foundry?digital` and `#foundry?physical`): `.ctl.filter` in a `.filters` row, one script. Tag gray; the chosen one pure black and bold, with `aria-pressed`.
- **Tags:** `.tags`, small sans, tag gray. Not clickable.

## The lightbox
One site component (site.js and site.css). Any `<img>` inside an element marked `data-lightbox` opens full size on the paper; that element's pictures are its group (a Journal article marks its body). A click, Esc or the back button closes it; the arrow keys and a swipe step through the group; focus stays inside and returns to the picture. Fades only, instant with reduced motion. Pictures added later (an article in the panel) work too. `data-lightbox-skip` on an `<img>` leaves it out. No frame, buttons or new color.

## Publishing
GitHub Pages, from the `docs/` folder on `main`. daltoncorr.com stays live as it is: both sites run side by side, with no redirects. `docs/CNAME` already says `opmetosserpse.com`. D publishes; nobody else pushes.
