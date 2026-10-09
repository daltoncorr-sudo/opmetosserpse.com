# Editing the words

Each project is one JSON file in `projects/`. On the page you'll see `title`, `lede` (the opening paragraph), every image, film and 3D piece of the project's page on daltoncorr.com (in its order), the facts from `client`, `year`, `role` and `links`, and the credits. The notes beside the images, the chapter labels and the "Work" fact are in `notes/<slug>.json`.

- **To reorder the projects,** edit `project_order` in `index.json`: the slugs, in the order the site should show them. Then build, and home and `/projects/` follow it.
- **The work list** is `work.json`: every project, newest first, with its tags and whether it's in Selected works. Order within a year is the order shown. Tags come only from the `tags` list at the top of the file.
- **The foundry panel** shows `foundry.lines` from `site.json`. To fill it with real content, put the HTML in `content/foundry.html`; it replaces those lines.
- **The lines under the cover** are `home.about` in `site.json`. Keep them few.
- **The images and their order** come from the project's page on daltoncorr.com: change them there, then build. An entry in `media` gives a picture its alt text and its size here: `H` and `F` are full width, `W` is wide, `P` images pair up side by side, `S` is narrow.
- **After any edit,** run `python3 build.py --daltoncorr ../_sources/daltoncorr-porfolio` and `python3 check.py`.

Use curly quotes and apostrophes as you like; straight ones are curled at build time.
