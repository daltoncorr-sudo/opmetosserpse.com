# Editing the words

Each project is one JSON file in `projects/`. On the page you'll see only `title`, `deck` (the one line under the title), the images in `media` (in order), and `client`, `year`, `role` and `links` at the end.

- **The home list** shows every project page, newest first. `home_order` in `index.json` breaks ties within a year.
- **The lines under the cover** are `home.about` in `site.json`. Keep them few.
- **To drop an image,** delete its entry in `media`. **To move one,** move its entry. `slot` sets its size: `H` and `F` are full width, `W` is wide, `P` images pair up side by side, `S` is narrow.
- **After any edit,** run `python3 build.py --daltoncorr ../_sources/daltoncorr-porfolio` and `python3 check.py`.

Use curly quotes and apostrophes as you like; straight ones are curled at build time.
