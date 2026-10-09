# Working on opmetosserpse.com

Read `README.md` first. D (Dalton Corr) is the creative director and makes every taste, money, legal and irreversible call.

## Hard rules
- **Never push, publish, deploy, buy, sign or send anything.** Commit locally only. Hand D the exact command or click instead.
- **Never change the words** in `content/` except to fix a typo, and say which. D approved them.
- **Keep the restraint, to a top-agency standard:** no menu bar; the cover is only the hand and the name; image first; very few words; plain lists of names; no section headers; off-white ground; two faces; one weight; one 0.5-second motion value (the hand on the cover is the one exception: a small set of moves, one about every 10 seconds). No new UI elements, cards, icons, badges or color.
- **Project pages follow their own template** (see "A project page" in `README.md`): the images, films and 3D pieces of the project's daltoncorr.com page, in its order; a serif title; Instrument Sans with its italic for the rest, in two sizes; up to four short chapter labels; margin notes of 25 words or fewer; end credits; and the next project. Films play once and rest, and never loop.
- Dalton Corr's name doesn't appear on the site.
- No analytics, cookies, trackers or third-party embeds. The privacy page promises none.
- No frameworks, bundlers or npm. Python 3 and Pillow only, plus ffmpeg for video and three.js (r128, served from the site) for the 3D pieces.
- Never mention AI anywhere on the site.
- daltoncorr.com stays live as it is. Never change, redirect or push anything in the daltoncorr repo; the clone in `_sources/` is read-only, for images.
- Be light on usage: no exploratory browsing; check pages with the local server and `check.py`.

## Commands
```bash
python3 build.py --daltoncorr ../_sources/daltoncorr-porfolio   # build into docs/
python3 check.py                                                # must print "All clear"
python3 serve.py                                                # preview on :8080
python3 moves.py                                                # the hand's moves: on, off, problems
python3 moves_lab.py                                            # workbench for the moves: _lab/hand.html
```

The hand's moves on the cover live in `moves/`, one folder each. Read `moves/README.md` before touching them.
