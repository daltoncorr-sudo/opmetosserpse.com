# opmetosserpse.com

The studio site for Opmet Osserpse. A hand-kept static site: plain HTML, one stylesheet, one small script, no framework, no npm.

## How it works
- `content/site.json`: every word on the home page (the few lines after the cover and the words that link), the foundry holding page, Privacy and 404, plus the footer and clock.
- `content/projects/<slug>.json`: one file per project page. The page shows only `title`, `deck`, the images in `media`, and a few plain lines from `client`, `year`, `role` and `links`. The longer copy (`lede`, `challenge`, `work`, `system`, `deliverables`, `credits`, `press`) stays in the file for search descriptions, press and later use. It isn't shown, by design.
- `content/index.json`: tie-break order for projects from the same year (`home_order`), and the Archive rows that have no page (`rows`).
- `static/`: CSS, JS, the interim fonts (SIL Open Font License, licenses included) and the hand.
- `moves/`: the hand's moves on the cover, one folder each. `moves.py` loads them for the build, and `moves_lab.py` writes a workbench page, `_lab/hand.html`. See `moves/README.md`.
- `build.py`: reads the content, pulls each image from a clone of the daltoncorr.com repo (`daltoncorr-sudo/daltoncorr-porfolio`), resizes it to WebP at 800, 1600 and 2400 px, and writes the finished site to `docs/`.
- `serve.py`: previews `docs/` the way GitHub Pages serves it.
- `check.py`: checks the build for broken links, placeholder text and house-style words.

## Build and preview
```bash
python3 -m pip install Pillow
python3 build.py --daltoncorr ../_sources/daltoncorr-porfolio
python3 check.py
python3 serve.py            # http://127.0.0.1:8080/
```
The first build takes a few minutes, while it encodes about 400 images; later builds reuse them. Add `--zip` to also write a zip of each project's images for press.

## The rules of the look
The standard is a top agency, not a template. Image first. Very few words, only where needed. Extreme restraint, on project pages too.
- **The home page:** the hand and the name, alone in the center of the first screen. Below the scroll: a few short lines about the studio, then a plain list of the 22 projects. Nothing else.
- **No menu bar anywhere.** Inner pages carry only the name, small and centered, which links back to the cover.
- **Dalton Corr's name doesn't appear on the site.** The studio speaks for itself.
- An off-white ground (`--paper: #FBFBF8`), near-black ink, no accent color: the work brings every color.
- Two typefaces (Libre Caslon Text for names, Instrument Sans for the rest), two sizes, one weight. When Opmet Serif ships, put it first in `--serif`.
- Plain lists of names: no years, dividers, numbers or boxes. No section headers.
- A project page is a title, one line, the images, then client, year, role, the next project and "Index."
- One motion value, 0.5 seconds, for fades and page changes. The one exception is the hand on the cover: after it arrives it waves, then plays one move about every 10 seconds, at random and never twice in a row, only while the cover is on screen: wave, spin, shrug, mirror, high five, a watch check, and thumbs up once its drawing exists. Each move has anticipation, overshoot and a settle. Reduced motion turns all of it off.
- **Hand moves:** each move is a folder in `moves/`, with its drawings in the same folder. See `moves/README.md`. The thumbs-up move waits for `moves/thumbs/thumbs-up.svg`.
- Copy: AP style, sentence case, no serial comma, the name as two words (*Opmet Osserpse*), espresso tempo in lowercase, no all caps, never "AI" or "vibes."

## Publishing
GitHub Pages, from the `docs/` folder on `main`. daltoncorr.com stays live as it is: both sites run side by side, with no redirects. `docs/CNAME` already says `opmetosserpse.com`. D publishes; nobody else pushes.
