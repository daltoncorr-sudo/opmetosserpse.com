# Working on opmetosserpse.com

Read `README.md` first. D (Dalton Corr) is the creative director and makes every taste, money, legal and irreversible call.

## Hard rules
- **Never push, publish, deploy, buy, sign or send anything.** Commit locally only. Hand D the exact command or click instead.
- **Never change the words** in `content/` except to fix a typo, and say which. D approved them.
- **Keep the restraint, to a top-agency standard:** no menu bar; the cover is only the hand and the name; image first; very few words; plain lists of names; no section headers; off-white ground; two faces, Opmet Serif and Instrument Sans; text at one weight, titles in Opmet Serif Black (D, Oct. 13, 2026); only buttons are italic (D, Oct. 13); one 0.5-second motion value (the hand on the cover is the one exception: a small set of moves, one about every 10 seconds). No new UI elements, cards, icons, badges or color.
- **Project pages follow their own template** (see "A project page" in `README.md`): at the top, the studio's small nameplate (the hand mark beside Opmet Osserpse on one line, linking to the cover; D, Oct. 13) with All work and Home under it (Home, D, Oct. 9); the title large in the bold serif, the focus of the page; the facts and credits right under it; then the images, films and 3D pieces of the project's daltoncorr.com page, in its order (pages D changed on purpose list their media in their notes file instead: HDtracks, Sunny's Bookshop, HollyShorts Comedy 10 and Don't Let Them Out; check.py holds every page to `_review/2026-10-14_media-order-record_v04.json`), large and close together; Instrument Sans with its italic for the rest, in two sizes; up to four short chapter labels, in the left margin from 1100 px only (Sunny's Bookshop, built after its Brand Bible: one per section, up to ten); no notes (Sunny's Bookshop alone has small labels under its marks, after its Brand Bible, with numerals in its Gilt, #CBA65E: D's one color exception; Red Mask has each poster's year and period research under it, D, Oct. 14); All work again at the end, with Home and Back to top beside it (D, Oct. 9). Never Back or a next project. Sunny's type specimens and stationery are images made once from the package's fonts and the Bible's page source; the fonts themselves never ship. Films play once and rest, muted, even those with sound (D, Oct. 10); a film with sound has Play with sound right under it, which becomes Mute. None loops, except two D chose: Sunny's Bookshop's signature film (sb-signature-script), which opens its page, and HollyShorts Comedy 10's animated poster (hollyshorts-comedy-10-poster-popcorn); check.py allows only those two.
- **Opmet Serif is a finished page** (`content/pages/`, D, Oct. 14): D's own design, with its own styles, motion and interactive pieces, inside the project frame every page has: the nameplate with All work and Home, and at the end All work, Home and Back to top, in the controls' italic; it slides down from home like the rest (D, Oct. 14). Its content is D's file, brought in by `python3 pages.py opmet-serif <D's page>`; change it only that way, with D's next version. It is third in Selected work. Its "In use" caption names Season One, the hidden Foundry's book (D, Oct. 14).
- Dalton Corr's name doesn't appear on the site, except in a project's credits, as "Dalton Corr, Opmet Osserpse" (Sunny's Bookshop: "Creative direction: Dalton Corr" alone, and no photography credit; D, Oct. 13). Opmet Serif's page is the one other place: its quote is credited "Dalton, Opmet Osserpse founder" (D, Oct. 14); the handwriting under it reads "opmet osserpse", in D's hand (D, Oct. 15).
- No analytics, cookies, trackers or third-party embeds. The privacy page promises none.
- No frameworks, bundlers or npm. Python 3 and Pillow only, plus ffmpeg for video and three.js (r128, served from the site) for the 3D pieces.
- "AI" never appears on the site except inside Journal article bodies, where the studio may write about it. `check.py` skips only `.article-body` for that word (and for all caps); anywhere else it fails.
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
