# Editing the words

Each project is one JSON file in `projects/`. On the page you'll see only `title`, `deck` (the one line under the title), the images in `media` (in order), and `client`, `year`, `role` and `links` at the end.

- **The work list** is `work.json`: every project, newest first, with its tags and whether it's in Selected works. Order within a year is the order shown. Tags come only from the `tags` list at the top of the file.
- **The foundry panel** shows `foundry.lines` from `site.json`. To fill it with real content, put the HTML in `content/foundry.html`; it replaces those lines.
- **The lines under the cover** are `home.about` in `site.json`. Keep them few.
- **To drop an image,** delete its entry in `media`. **To move one,** move its entry. `slot` sets its size: `H` and `F` are full width, `W` is wide, `P` images pair up side by side, `S` is narrow.
- **After any edit,** run `python3 build.py --daltoncorr ../_sources/daltoncorr-porfolio` and `python3 check.py`.

Use curly quotes and apostrophes as you like; straight ones are curled at build time.
