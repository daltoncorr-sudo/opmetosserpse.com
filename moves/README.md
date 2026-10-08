# The hand's moves

The hand on the cover of opmetosserpse.com plays one move at a time: the first about 3 seconds after it appears, then one about every 10 seconds, picked at random and never the same twice in a row. It plays only while the cover is on screen and the tab is open. Reduced motion turns it all off.

Every move is one folder here. `build.py` and the workbench pick up whatever is in this folder, so adding, removing or changing a move never touches any other file.

## A move's folder
```
moves/<name>/
  move.json   {"name": "<name>", "label": "Wave", "duration_ms": 2300, "enabled": true, "requires": []}
  move.css    .mark.m-<name>{animation:<name> 2.3s both} plus its @keyframes
  *.svg       optional drawings on the hand's canvas (see below)
```
- `name` matches the folder name. Use lowercase with no spaces.
- `duration_ms` matches the longest animation in `move.css`. The site uses it as a backstop and to set the scrubber's length in the workbench.
- `enabled: false` keeps a move in the folder but out of the site.
- `requires` lists files that must exist in the folder before the move turns on. The thumbs-up move waits for `thumbs-up.svg` this way.
- Every `@keyframes` name starts with the move's name (`watch`, `watch-on`, `watch-min`), so moves never collide.
- The main animation goes on `.mark` itself. Its end is how the site knows the move has finished. Animations on the drawings inside it (`.mark.m-<name> .hand`, `.mark.m-<name> .pose-<stem>`) are fine as well.

## Drawings
Every `.svg` in a move's folder is drawn inside the mark, on top of the hand, as `<svg class="pose pose-<file name>">`. It starts invisible (`opacity: 0`), and the move's CSS decides when it shows.
- **Same canvas as the hand:** `viewBox="0 0 901 1861"`, with the wrist in the same place as in `static/brand/hand.svg`. The build refuses any other canvas.
- **A pose** replaces the hand for part of a move: fade `.hand` out and the pose in over 2 to 4 percent of the move, at its fastest point, so the swap reads as motion. See `thumbs/`.
- **An overlay** is drawn on top of the hand, like the watch: fade it in and out. Parts inside it can have their own animations. See `watch/`.
- Solid ink silhouettes, matching the hand: no outlines, textures or gradients. Colors come from `var(--ink)` and `var(--paper)`.
- File names must be unique across all moves, since they become class names.

## The rig (optional)
`moves/_rig/hand-rig.svg` replaces the plain hand on the cover when it exists. It's the same drawing on the same canvas, cut into parts that pivot at their joints:
- **Groups:** `<g class="part part-palm">` holding `<g class="part part-thumb">`, `part-index`, `part-middle`, `part-ring` and `part-pinky`, each nested so a finger moves with the palm. Fingers may split further at their joints, like `part-index-tip`.
- **Pivots:** set in `moves/_rig/rig.css`, which the build puts first in `moves.css`: `transform-box: view-box; transform-origin: <x>px <y>px` per part, in canvas units. Moves target parts directly, for example `.mark.m-wave .part-index{animation:wave-index ...}`.
- **Joints:** parts overlap at the joints, with a rounded knuckle, so no gap opens when a finger bends.
- **Fallback:** every move must still look right with the plain hand, as it does today, so deleting the rig never breaks the site.

## Motion standard
Each move should read clearly at the hand's real size, 44 to 70 px wide.
- Anticipation before the action, an overshoot, then a settle.
- Squash and stretch on contact and on landing, keeping the volume.
- Ease each segment, never linear, by setting `animation-timing-function` on every keyframe.
- Use the same transform list in every keyframe of a move, so the browser interpolates it cleanly.
- Animate only transform and opacity, for 60 frames per second on a phone.
- Each move ends exactly where it started, so the next one begins clean.
- Most moves run 1.5 to 3 seconds.

## Commands
```bash
python3 moves.py        # list moves: on, off and why, and any problems
python3 moves_lab.py    # write _lab/hand.html, then open it: play, loop, slow down, scrub, zoom, site shuffle
python3 build.py --daltoncorr ../_sources/daltoncorr-porfolio && python3 check.py   # the real site
```
