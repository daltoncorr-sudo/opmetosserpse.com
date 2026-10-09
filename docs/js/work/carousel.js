/* Carousel — ported from Bencho's Carousel.tsx (MIT, bencho.dev/licence).

   This site has no React, so this is the same component in plain
   JS: `useSpring` is a small spring object per value, `useState`
   is a variable plus a repaint, and props are the constants below.
   The comments are Bencho's and still say why the numbers are
   what they are; where a number changed for the HollyShorts
   badges, the reason sits beside it under "ON THIS PAGE". Some
   comments name things on Bencho's bench (the wall, the Pro
   sheet, Humidity) — they are kept because the reasoning holds.

   One addition that is not Bencho's: a badge has a back, so a tap
   on the front card flips it, and a tap on any other card turns
   the ring to bring it forward. */
(function () {
  'use strict';

  const host = document.getElementById('badge-carousel');
  if (!host) return;

  /* SHOTS was Bencho's own pictures, which are not licensed
     to travel. Point this at yours.

     ON THIS PAGE: the festival's badges. The HollyShorts 21 set is
     the default; another year's page names its own on the host:
       data-base   the folder the badges are in
       data-shots  their names, "|" between, one file per name
       data-code   the serial's prefix, data-serial its first number
       data-fine   the fine print, "|" between lines
       data-label  what a screen reader calls the ring */
  const conf = host.dataset;
  const IMG_BASE = conf.base || '/dc/images/design/hollyshorts21/badges/';
  const NAMES = conf.shots ? conf.shots.split('|')
    : ['All Access', 'Day Pass', 'Film Summit', 'Filmmaker', 'Press', 'Screenwriter', 'Sponsor', 'Staff'];
  const SHOTS = NAMES.map((name) => ({ name, src: IMG_BASE + encodeURIComponent(name) + '.webp' }));
  const CODE = conf.code || 'HS21';
  const SERIAL = Number(conf.serial || 2025000);
  const FINE = (conf.fine || '21st Annual Oscar®-Qualifying HollyShorts Film Festival|TCL Chinese Theatres, Los Angeles||Property of Alta Global Media. Must be worn|and visible at all times. Non-transferable.').split('|').join('<br>');

  /* ══ Carousel ═════════════════════════════════════════════
     Cards on a turntable that drift at rest, give under the
     pointer, and can be swiped round.

     NOTHING EVER LEAVES THE FRAME, and that is the whole
     arrangement. This was a row twice — cards in a line, with
     the ones at the ends either dissolving into a mask or being
     cut by the edge of a box — and both are answers to the same
     question: what happens to a card when it runs out of block?
     A ring does not ask it. The cards go ROUND: out to one
     side, back and small, round to the other side, forward
     again. The furthest a card ever gets is the radius, which
     is a number this component chose, so there is no edge to
     treat and no box to put it in.

     IT IS THEREFORE ENDLESS. A row has a first card and a last
     one and has to decide what to do at each; a ring has
     neither, so the swipe never runs out and never rubber-bands.
     Swipe once and the front card shrinks and goes to the back
     while the next one comes forward — which is the motion he
     described, and it falls out of the geometry rather than
     being animated on top of it.

     THE ANGLE IS NOT TAKEN MODULO ANYTHING. `turn` counts up
     and down without limit and the angle is `(i - turn) * step`.
     Wrapping it to 0..360 would send a card the long way round
     the moment it crossed the seam, which is the one visible bug
     this arrangement can have — the same note the Pro sheet's
     reel carries, for the same reason.

     THREE MOTIONS, THREE ELEMENTS, ONE TRANSFORM EACH. The slot
     carries where the card is on the ring, the floater carries
     the drift, the card carries the tilt. They are nested rather
     than composed into one string because they are owned by
     three different things — the drag, a CSS animation and a
     pair of springs — and a single element cannot be written by
     three authors without one of them losing.

     ON THIS PAGE there is a fourth: the flip, on its own element
     inside the card, owned by a CSS transition. Same rule. */

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const mod = (a, n) => ((a % n) + n) % n;

  /* the card is the PICTURES' own ratio, near enough — 160x226
     is 0.708 against their 2:3, so `cover` trims about six per
     cent off the height. These are photographs with nothing at
     their top or bottom edge, and the card reading as a card
     rather than as a slat is worth the last few rows.

     ON THIS PAGE the pictures are badges, 825x1350, and a badge
     has type right up to its edges — so the card is their ratio
     EXACTLY and `cover` trims nothing. */
  const CARD_H = 300;
  const CARD_W = Math.round(CARD_H * 825 / 1350);

  /* ── the frame, and it is only a frame ─────────────────────
     No box, no clip, no mask. Nothing here hides its overflow,
     which is what makes the next decision affordable.

     ── SIZED FOR THE DEFAULT, NOT FOR THE EXTREMES ───────────
     This is the decision that matters on the wall. Sized to
     hold Spread 150 with Depth 0 and Float 100 — the widest the
     knobs can make the ring — the frame came to 520x404, and at
     the arrangement it actually SHIPS at that left 40px of air
     either side and 50 top and bottom. Measured. That is dead
     space the wall pays for on every card: a block is fitted to
     its column by its bounding BOX, so air inside the box is
     the block being drawn smaller.

     476x340 is the shipping ring plus about eighteen pixels of
     margin. The card is 37% of the frame where it was 28.6%,
     and the overlay draws it 9% bigger as well, because the fit
     there is LOCK over the larger side.

     What it costs: at the far corners of the knobs the ring
     paints a little outside the frame. Nothing clips, so it
     simply overlaps the padding the wall card keeps around a
     block, and only when Spread, Depth and Float are all at
     once at settings nobody ships. The same trade the Balance
     card makes when it stretches past its own measured box.

     The cards also keep growing faster than the frame, for the
     same reason: 160x226 in 440x340 was 24% of the frame in
     card, 188x266 in 474x384 was 27%, 206x292 in 476x340 is
     37%.

     Fixed at these two numbers, because a frame that grew with
     a knob would rescale the whole block every time one moved —
     which is the thing the ResizeObserver on the wall and the
     overlay would both do.

     ON THIS PAGE: 600x400, the shipping ring of eight taller
     cards plus the same margin. There are no knobs here, but
     there IS a phone, so the whole frame is drawn at `fit` — the
     column's width over 600, never above 1 — and everything
     measured in px is multiplied by it. That is the job the
     wall's ResizeObserver did, done here instead. */
  const STAGE_W = 600;
  const STAGE_H = 400;

  /* ON THIS PAGE: 210 rather than 138. Eight cards want a wider
     ring than five, or the two at 45 degrees sit on the front
     card rather than beside it. */
  const ORBIT = 210;
  /* ── how much smaller the back of the ring is ──────────────
     Read as a percentage of the way to half size: 100 puts the
     card at the back at 0.5, which is where this sits. The knob
     runs to 150 — 0.25 — because the ceiling was the default's
     own value and that is a knob with nothing above it, so
     every setting was a step DOWN from where it shipped.

     `1 - depth / 200` rather than the arithmetic it replaced,
     which said the same thing with a 0.5 buried in it.

     ON THIS PAGE: 90, so the back card is 0.55 — a touch bigger
     than half, for the reason under LEAN. */
  const DEPTH = 90;
  const DEPTH_MAX = 150;
  /* ON THIS PAGE: 12, the radius the printed badges have. */
  const CORNER = 12;
  const FLOAT = 15;
  const SINK = 50;
  const SETTLE = 50;
  const SPIN = 0;

  /* ── how far back the ring leans ───────────────────────────
     A card at the back sits this much higher than one at the
     front. Scale alone says smaller, which the eye can read as
     further away OR as literally smaller; a card that also
     rides UP as it recedes is unmistakably going back, because
     that is what a ring seen from slightly above does. It costs
     one term and it is most of what makes the depth read.

     38 rather than 22 for a second reason: at 22 the card at
     the very back was invisible — 226 tall drawn at 0.75 and
     lifted 22 puts its top edge 6px BELOW the front card's, so
     one of the four was hidden completely at rest. At 38 it
     clears by ten, and seeing something behind is what tells
     you the ring goes round.

     ON THIS PAGE: 84, by the same arithmetic. Eight is an even
     count, so one card sits at exactly 180 degrees — the case
     the note on N warns about — and the only way to show it is
     over the top. 300 tall at 0.55 lifted 84 puts its top edge
     16px above the front card's, which is its lanyard clip and
     the badge's header: enough to say there is one behind. */
  const LEAN = 84;
  /* ON THIS PAGE, not Bencho's: the lean pushes the ring's
     bounding box upward, so the ring is drawn this much below
     the frame's centre to sit in the middle of it. */
  const DROP = 10;

  /* how many px of drag turn the ring one position */
  const PULL = 140;

  /* how far ahead of the release the throw looks, in ms of
     travel. It is what makes a short fast flick move a card:
     without it a swipe is judged on distance alone and a quick
     one that barely moved counts for nothing. */
  const TOSS = 150;
  /* and how many it may skip. A flick can carry two; past that
     the ring blurs and you have lost your place on it. */
  const MOST = 2;

  const BASE = 620;

  /* ── the pictures ARE the count ────────────────────────────
     It was a 3..6 knob while the cards were coloured faces,
     which is a knob you can only have when the cards carry
     nothing: with photographs, one more card than pictures has
     to be one of them a second time, and the same picture twice
     on one ring reads as a bug rather than as a setting. So the
     number of cards is `SHOTS.length` and nothing else.

     Five is also the better ring. With four, one card sits at
     180 degrees, which is directly behind the front one and out
     of sight; at 72-degree steps nothing is ever exactly
     behind anything, so every card is at least partly visible
     at rest and the ring reads as a ring rather than as three
     cards and a rumour.

     ON THIS PAGE: eight, because there are eight badges and
     the rule above says the pictures are the count. The card
     at 180 is handled by LEAN rather than by dropping a badge. */
  const N = SHOTS.length;

  /* ── which one is at the front when it opens ───────────────
     BY NAME, not by index. The order is whatever the list says,
     so an index here would be a number that silently means a
     different picture the day somebody adds a badge — and "the
     card it opens on" is a decision, not an accident of the
     alphabet. Falls back to the middle of the ring if the name
     is not there, which is where it used to open. */
  const FRONT = 'All Access';
  const OPENS_ON = (() => {
    const i = SHOTS.findIndex((s) => s.name === FRONT);
    return i < 0 ? Math.floor((N - 1) / 2) : i;
  })();

  /* ── every card sits at its own angle ──────────────────────
     Numbers that are not a pattern: no two the same, no
     symmetry to spot, and they do not alternate. A ring where
     the angles went -4, +4, -4, +4 is an arrangement somebody
     made; numbers that are merely different are a handful of
     photographs somebody put down.

     There is one per picture. It has to be — `i % ANGLE.length`
     would wrap a sixth card onto the first card's angle, and
     two sharing an angle is the pattern this list exists to
     avoid. ON THIS PAGE that meant three more.

     They can be this generous again now the cards are on a
     ring. On a row an angle cost width — a turned card sweeps
     its corner sideways into its neighbour's air — and the
     spread knob's floor had to pay for it. Cards at different
     depths are allowed to overlap; that is what depth looks
     like. */
  const ANGLE = [-4.2, 2.6, -1.4, 3.8, 1.7, -2.9, -0.8, 3.1];

  /* the drift's periods, deliberately awkward so no two cards
     are ever doing the same thing. See the note in style.css.
     ON THIS PAGE: two more, so eight cards get eight periods. */
  const PERIOD = [4.7, 5.9, 6.7, 5.3, 7.1, 6.1, 4.3, 7.7];

  /* ── where a card sits, given where the ring is ────────────
     ONE function, read by the first paint and by the drag both.
     The drag writes transforms straight to the nodes — a render
     per pointermove and the ring visibly trails the finger — so
     there are two callers, and if they were two pieces of code
     they would drift apart the first time the geometry changed.

     `f` is the whole of it: 1 at the front, 0 at the back, and
     it drives the size, the lean and the paint order together.
     Position from the ANGLE rather than from a table of four
     places is what makes the transitions free — the card
     leaving swings out and back, the card arriving swings in
     and forward, and the one behind crosses without any of them
     knowing about the others. */
  const spotOf = (i, turn, orbit, depth, lean) => {
    const th = (i - turn) * ((Math.PI * 2) / N);
    const f = (Math.cos(th) + 1) / 2;
    return {
      x: Math.sin(th) * orbit,
      y: -(1 - f) * lean,
      s: mix(1 - clamp(depth, 0, DEPTH_MAX) / 200, 1, f),
      /* ── paint order is a z-index, by hand ──────────────
         Everything here is 2D — scale and offset, not
         translateZ — so nothing sorts itself and a card would
         otherwise paint in DOM order and sit over the one in
         front of it. `f` already knows which is nearer. */
      z: Math.round(f * 100)
    };
  };

  const write = (el, sp, angle, drop) => {
    /* NO OPACITY IS WRITTEN HERE. The cards used to fade with
       distance, which meant dragging dimmed and lit every one of
       them — the whole block pulsed on a gesture that should
       only move things round. Size, lean and paint order say
       which is in front; none of them touch the picture. */
    el.style.transform = `translate(-50%, -50%) translate(${sp.x.toFixed(2)}px, ${(sp.y + drop).toFixed(2)}px) rotate(${angle}deg) scale(${sp.s.toFixed(4)})`;
    el.style.zIndex = String(sp.z);
  };

  const out = (t) => 1 - (1 - t) ** 4;

  /* ── one spring, for everything that settles ───────────────
     Frames, not milliseconds. `dt` is expressed in sixtieths of
     a second and the damping is RAISED to it rather than
     multiplied by it, so a dropped frame decays the same amount
     of energy as the two frames it replaced. Multiplying is the
     version that makes a spring behave differently on a busy
     page, which is the hardest kind of bug to see.

     The loop parks itself the moment the value has settled.

     The pair is chosen by DAMPING RATIO and then written back
     as stiffness and decay, because the ratio is the thing a
     person is actually setting and the two numbers on their own
     do not say what they add up to.

       zeta = -ln(d) / (2 * sqrt(k))

       0   → zeta ~0.85, heavy, arrives without a ring
       50  → zeta ~0.41, near where Humidity and Brightness sit
       100 → zeta ~0.20, lively, two visible rebounds

     Both ends shippable, which is the constraint that fixed the
     numbers rather than taste. */
  const springOf = (tune) => ({
    /* stiffness: how hard it is pulled toward the target */
    k: 0.08 + (tune / 100) * 0.16,
    /* decay, per frame: how much of the velocity survives */
    d: 0.62 + (tune / 100) * 0.2
  });

  /* Units matter. The snap threshold is absolute, so a caller
     works in pixels or in 0..100 — a spring driven over 0..1
     would be "settled" before it had visibly moved.

     ON THIS PAGE the tilt's three springs share one frame loop
     per card rather than one each — same maths, one rAF. Two of
     them run over -1..1 and one over 0..1, as Bencho's did; see
     the note above for what that costs at the very end. */
  const makeSpring = (v) => ({ cur: v, vel: 0, target: v });
  const stepSpring = (sp, k, d, dt) => {
    sp.vel += (sp.target - sp.cur) * k * dt;
    sp.vel *= Math.pow(d, dt);
    sp.cur += sp.vel * dt;
    if (Math.abs(sp.target - sp.cur) < 0.02 && Math.abs(sp.vel) < 0.02) {
      sp.cur = sp.target;
      sp.vel = 0;
      return true;
    }
    return false;
  };

  /* Read once, the way the wheel and the pill nav do. A
     preference, not a live input. */
  const still = !!window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* How long it takes, slower to faster, as a multiplier on
     whatever the component's own tuned duration is. 0 is a
     little over half again as slow, 100 is two and a half times
     as fast, 50 is exactly 1. */
  const rate = (speed) => 1.6 - (speed / 100) * 1.2;

  /* ── the badge's back ──────────────────────────────────────
     Carried over from the fan this ring replaced, unchanged:
     the same barcode, the same fine print. */
  function barcode(seed) {
    let s = '', x = 4, r = seed * 137.508;
    for (let i = 0; i < 28; i++) {
      r = (r * 9301 + 49297) % 233280;
      const w = (r % 3) + 1;
      r = (r * 9301 + 49297) % 233280;
      const g = (r % 2) + 1;
      s += '<rect x="' + x + '" y="3" width="' + w + '" height="34" rx="0.5" fill="#222"/>';
      x += w + g;
    }
    return s;
  }

  const backOf = (name, i) =>
    '<div class="badge-back-content">' +
      '<span class="badge-hole badge-hole--back"></span>' +
      '<svg class="badge-back-hs" viewBox="0 0 140 64" xmlns="http://www.w3.org/2000/svg" fill="none">' +
        '<text x="70" y="30" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="16" font-weight="700" letter-spacing="0.3" fill="#111">HollyShorts</text>' +
        '<text x="70" y="48" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="6.5" font-weight="400" letter-spacing="2.5" fill="#999">FILM FESTIVAL</text>' +
      '</svg>' +
      '<span class="badge-back-type">' + name.toUpperCase() + '</span>' +
      '<div class="badge-back-barcode">' +
        '<svg viewBox="0 0 120 40" xmlns="http://www.w3.org/2000/svg">' + barcode(i) + '</svg>' +
        '<span>' + CODE + '-' + String(SERIAL + i * 137) + '</span>' +
      '</div>' +
      '<p class="badge-back-fine">' + FINE + '</p>' +
    '</div>';

  /* ── the frame ─────────────────────────────────────────── */
  const car = document.createElement('div');
  car.className = 'car';
  const track = document.createElement('div');
  track.className = 'car-track';
  track.dataset.held = 'false';
  track.setAttribute('role', 'group');
  track.setAttribute('aria-label', (conf.label || 'HollyShorts 21 badges') + '. Use the arrow keys to turn, Enter to flip');
  track.setAttribute('aria-roledescription', 'carousel');
  track.tabIndex = 0;
  car.appendChild(track);
  host.appendChild(car);

  /* ── where the ring is, and it is NOT state ──────────────
     A continuous position in card-steps: 0 puts the first
     card at the front, 1.5 is halfway between the second and
     third. It changes every frame of a drag, which is exactly
     the value that must not trigger anything but a paint.

     It is NOT clamped and NOT wrapped. See the note at the
     top: this is the number a modulo would ruin. */
  let turn = OPENS_ON;
  let raf = 0;
  let drag = null;
  let held = false;
  let fit = 1;
  let flipped = -1;

  const deep = clamp(SINK, 0, 100) / 100;
  const { k, d } = springOf(50);

  /* ── one card, and the press is its own ───────────────────
     A card per picture, each with its own springs. It costs
     nothing at rest: a spring at its target runs no loop at
     all. */
  const cards = SHOTS.map((shot, i) => {
    const slot = document.createElement('div');
    slot.className = 'car-slot';
    slot.setAttribute('aria-label', shot.name + ' badge');

    /* ── the drift ─────────────────────────────────
       Its own element, so the keyframes own this
       transform outright and neither the ring nor the
       tilt ever writes it. The period is per card and
       the amplitudes are the knob. */
    const float = document.createElement('div');
    float.className = 'car-float';
    /* at Float 0 the keyframes come off rather than
       running at zero amplitude. Identical to look
       at, and one of them holds a compositor layer
       per card for a motion the knob has just
       turned off. */
    if (FLOAT <= 0) float.style.animationName = 'none';
    float.style.animationDuration = PERIOD[i % PERIOD.length] + 's';

    const skin = document.createElement('div');
    skin.className = 'car-card';
    /* ── ONE SHADOW, AND IT DOES NOT MOVE ─────────────
       It tightened as the card sank, which is the honest
       physics, and on four cards it was four shadows
       resizing as the pointer crossed them — the ring
       flickering rather than one card being touched. The
       dent and the rim say the card went back; the shadow
       only has to say it is off the ground. */
    skin.style.boxShadow = '0 12px 28px -10px rgba(var(--shadow-rgb), 0.28)';

    const flip = document.createElement('div');
    flip.className = 'car-flip';
    const front = document.createElement('div');
    front.className = 'car-face car-face--front';
    const img = new Image();
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = shot.src;
    img.alt = shot.name + ' badge';
    img.draggable = false;
    front.appendChild(img);
    front.insertAdjacentHTML('beforeend', '<span class="badge-hole"></span>');
    const back = document.createElement('div');
    back.className = 'car-face car-face--back';
    back.innerHTML = backOf(shot.name, i);
    flip.appendChild(front);
    flip.appendChild(back);

    /* the dent, and the rim opposite it. The shadow pools
       where the surface is deepest, which is under the
       pointer, and the light catches the far edge that has
       risen — so the two are placed at mirrored points and
       neither is centred on anything. This layer is what
       makes the transform read as a press. */
    const sheen = document.createElement('span');
    sheen.className = 'car-sheen';
    sheen.setAttribute('aria-hidden', 'true');

    skin.appendChild(flip);
    skin.appendChild(sheen);
    float.appendChild(skin);
    slot.appendChild(float);
    track.appendChild(slot);

    /* ── the state, and there is only this ───────────────────
       Where the pointer is, as -1..1 on each axis, sprung. The
       spring is on the POSITION rather than on the rotation, so
       the transform and both gradients are three readings of one
       number instead of three things animating toward the same
       place. */
    const c = {
      i, slot, float, skin, flip, sheen,
      pt: { x: 0, y: 0 }, on: false,
      sx: makeSpring(0), sy: makeSpring(0), lit: makeSpring(0),
      loop: 0
    };
    return c;
  });

  function drawCard(c) {
    const sx = c.sx.cur, sy = c.sy.cur, lit = c.lit.cur;
    const max = deep * 13;
    /* IT SINKS, IT DOES NOT LIFT — the tilt card's rule. The
       point you are over goes AWAY and the far side comes up, so
       the card is being touched rather than displayed. */
    const rx = -sy * max;
    const ry = sx * max;

    /* the pointer in the card's own terms, as a PERCENTAGE. The
       wall, the overlay and the Pro sheet all draw this card at
       their own scale, and a gradient placed in pixels would
       land somewhere else in each of them. */
    const px = ((sx + 1) / 2) * 100;
    const py = ((sy + 1) / 2) * 100;
    const dark = deep * 0.5 * lit;
    /* the rim is a hint, not a highlight: at the tilt card's own
       0.34 a white wash slides across the photograph and reads
       as a sheen laid ON the picture rather than as the far edge
       of a dented surface catching light */
    const rim = deep * 0.16 * lit;

    /* translateZ FIRST, so the retreat is measured in the
       room's axes rather than in the card's own — after a
       rotation the card's z points off to one side and
       "back" stops meaning back */
    c.skin.style.transform = `translateZ(${(-10 * deep * lit).toFixed(2)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    c.sheen.style.backgroundImage = `radial-gradient(44% 36% at ${px.toFixed(1)}% ${py.toFixed(1)}%, rgba(9, 14, 28, ${dark.toFixed(3)}) 0%, rgba(9, 14, 28, 0) 100%), radial-gradient(54% 44% at ${(100 - px).toFixed(1)}% ${(100 - py).toFixed(1)}%, rgba(255, 255, 255, ${rim.toFixed(3)}) 0%, rgba(255, 255, 255, 0) 100%)`;
  }

  /* a card under a finger that is turning the ring is not
     being pressed, it is being carried — and two gestures
     fighting for one transform is the one way this can look
     broken */
  function aim(c) {
    const live = c.on && !held && !still;
    c.sx.target = live ? c.pt.x : 0;
    c.sy.target = live ? c.pt.y : 0;
    c.lit.target = live ? 1 : 0;
    if (still) {
      [c.sx, c.sy, c.lit].forEach((s) => { s.cur = s.target; s.vel = 0; });
      drawCard(c);
      return;
    }
    if (c.loop) return;
    let prev = 0;
    const tick = (t) => {
      const dt = prev ? clamp((t - prev) / 16.67, 0, 2.5) : 1;
      prev = t;
      const a = stepSpring(c.sx, k, d, dt);
      const b = stepSpring(c.sy, k, d, dt);
      const l = stepSpring(c.lit, k, d, dt);
      drawCard(c);
      c.loop = a && b && l ? 0 : requestAnimationFrame(tick);
    };
    c.loop = requestAnimationFrame(tick);
  }

  cards.forEach((c) => {
    c.skin.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const b = c.skin.getBoundingClientRect();
      c.pt.x = clamp(((e.clientX - b.left) / b.width) * 2 - 1, -1, 1);
      c.pt.y = clamp(((e.clientY - b.top) / b.height) * 2 - 1, -1, 1);
      c.on = true;
      aim(c);
    });
    /* `out` with a containment test rather than `leave` — the
       rehearsal's scripted pointer walks off carrying
       `relatedTarget: null`, and the card would finish the demo
       still sunk under a cursor that had gone. */
    c.skin.addEventListener('pointerout', (e) => {
      const to = e.relatedTarget;
      if (!to || !c.skin.contains(to)) { c.on = false; aim(c); }
    });
    c.skin.addEventListener('pointercancel', () => { c.on = false; aim(c); });
  });

  /* ── size, from the column ───────────────────────────── */
  function size() {
    fit = Math.min(1, host.clientWidth / STAGE_W) || 1;
    car.style.width = (STAGE_W * fit).toFixed(1) + 'px';
    car.style.height = (STAGE_H * fit).toFixed(1) + 'px';
    const r = clamp(CORNER, 0, 40) * fit;
    cards.forEach((c) => {
      c.slot.style.width = (CARD_W * fit).toFixed(1) + 'px';
      c.slot.style.height = (CARD_H * fit).toFixed(1) + 'px';
      c.skin.style.borderRadius = r.toFixed(1) + 'px';
      c.sheen.style.borderRadius = r.toFixed(1) + 'px';
      c.flip.style.borderRadius = r.toFixed(1) + 'px';
      c.float.style.setProperty('--lift', ((clamp(FLOAT, 0, 100) / 100) * 16 * fit).toFixed(2) + 'px');
      c.float.style.setProperty('--sway', ((clamp(FLOAT, 0, 100) / 100) * 1.4).toFixed(2) + 'deg');
    });
    car.style.setProperty('--car-fit', fit.toFixed(3));
    paint();
  }

  function paint() {
    cards.forEach((c) =>
      write(c.slot, spotOf(c.i, turn, ORBIT * fit, DEPTH, LEAN * fit), ANGLE[c.i % ANGLE.length], DROP * fit));
  }

  /* ── the flip ─────────────────────────────────────────────
     Only the front card turns over, and it turns back the
     moment the ring moves: a card carried round showing its
     back would be a card nobody can read and nobody chose. */
  function setFlip(i) {
    if (flipped === i) return;
    if (flipped !== -1) {
      cards[flipped].slot.classList.remove('is-flipped');
    }
    flipped = i;
    if (i !== -1) cards[i].slot.classList.add('is-flipped');
  }

  const frontIndex = () => mod(Math.round(turn), N);

  /* ── the ring turning itself ─────────────────────────────
     Its own frame loop and its own handle, deliberately not
     `raf` — that one belongs to the settle after a swipe, and
     the two sharing it would mean whichever started last
     cancelled the other.

     It advances `turn` by time rather than stepping between
     whole positions: a ring that clicks from card to card is
     reading as a slideshow.

     Off here, as it is by default: this ring is a thing you
     push. Held pauses it. */
  let spinId = 0;
  function spinning() {
    cancelAnimationFrame(spinId);
    if (!SPIN || still || held) return;
    let prev = 0;
    const step = (t) => {
      /* N cards over `spin` seconds is one whole revolution */
      if (prev) turn += ((t - prev) / 1000) * (N / SPIN);
      prev = t;
      paint();
      spinId = requestAnimationFrame(step);
    };
    spinId = requestAnimationFrame(step);
  }

  /* ── the settle ──────────────────────────────────────────
     Quart-out from wherever the ring currently is to a whole
     position. It reads its start from the live value rather
     than from where the drag began, so a second swipe during
     one turns the ring further instead of snapping it back. */
  function glide(to) {
    cancelAnimationFrame(raf);
    const from = turn;
    if (mod(to, N) !== flipped) setFlip(-1);
    if (still || from === to) {
      turn = to;
      paint();
      return;
    }
    const ms = BASE * rate(clamp(SETTLE, 0, 100));
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      turn = mix(from, to, out(p));
      paint();
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  const go = (dd) => glide(Math.round(turn) + dd);

  /* the shortest way round to card i — the ring has no seam,
     so "left" and "right" are both always available */
  const bring = (i) => {
    let dd = mod(i - Math.round(turn), N);
    if (dd > N / 2) dd -= N;
    go(dd);
  };

  function setHeld(v) {
    held = v;
    track.dataset.held = String(v);
    cards.forEach(aim);
    spinning();
  }

  track.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    cancelAnimationFrame(raf);
    const hit = e.target.closest('.car-slot');
    drag = {
      x0: e.clientX, t0: turn, last: e.clientX,
      t: e.timeStamp, vx: 0, moved: false,
      card: hit ? cards.findIndex((c) => c.slot === hit) : -1
    };
    setHeld(true);
    try { track.setPointerCapture(e.pointerId); } catch (_) { /* not a live pointer */ }
  });

  track.addEventListener('pointermove', (e) => {
    const g = drag;
    if (!g) return;
    const dx = e.clientX - g.x0;
    if (!g.moved && Math.abs(dx) > 3) {
      g.moved = true;
      setFlip(-1);
    }

    /* px per ms, smoothed against the previous reading so one
       jittery frame cannot fake a flick — and measured from
       the LAST position rather than from the grab, because the
       speed at release is the only part of a swipe that says
       how far it meant to go */
    const dt = Math.max(1, e.timeStamp - g.t);
    g.vx = (g.vx + (e.clientX - g.last) / dt) / 2;
    g.last = e.clientX;
    g.t = e.timeStamp;

    /* ── no rubber band, because there is no end ─────────
       A row had to give at its first and last card, or it read
       as broken input. A ring has neither, so the drag is a
       plain one-to-one and keeps going as long as you do.
       ON THIS PAGE PULL is scaled with the frame, so on a phone
       the ring still keeps pace with the finger. */
    turn = g.t0 - dx / (PULL * fit);
    paint();
  });

  const up = () => {
    const g = drag;
    if (!g) return;
    drag = null;
    setHeld(false);
    if (!g.moved) {
      /* a tap, not a swipe: flip the front card, or bring the
         one that was tapped to the front */
      if (g.card === -1) return;
      if (g.card === frontIndex()) setFlip(flipped === g.card ? -1 : g.card);
      else bring(g.card);
      return;
    }
    /* where it would come to rest if it kept going, capped so
       a hard flick cannot spin the ring past where you can
       follow it */
    const carry = clamp((-g.vx * TOSS) / (PULL * fit), -MOST, MOST);
    glide(Math.round(turn + carry));
  };
  track.addEventListener('pointerup', up);
  track.addEventListener('pointercancel', up);

  track.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const f = frontIndex();
      setFlip(flipped === f ? -1 : f);
      return;
    }
    const dd = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dd) return;
    e.preventDefault();
    go(dd);
  });

  /* click outside turns the badge back over */
  document.addEventListener('pointerdown', (e) => {
    if (flipped !== -1 && !car.contains(e.target)) setFlip(-1);
  });

  /* placed on load, and again whenever the column changes width */
  size();
  if ('ResizeObserver' in window) new ResizeObserver(size).observe(host);
  else window.addEventListener('resize', size);
  spinning();
})();
