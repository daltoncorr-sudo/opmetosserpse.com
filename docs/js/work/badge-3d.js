/* badge-3d.js

   All eight HollyShorts 22 passes, each on its own lanyard, hung in three rows
   (3 / 3 / 2; on a phone two by four), every row from its own rail. The
   badges are big, the straps short, so the artwork carries the section. Every
   one swings on its own strap and rests face-on; drag one to spin it (it
   settles on its front when you let go), tap it to turn it over (it shows
   its back for a moment, then comes round again). Knock one and the badge
   either side of it in its row swings too.

   The card is a slab of rounded plastic with the artwork on its front and,
   on its back, a plain face made from the front: the pass's own colour, a
   centred 22, the festival, the pass and the code. The strap is a flat
   ribbon with a crimp and a split ring. Everything is procedural apart from
   the eight pictures.

   HERE: three.js arrives only when the stage nears the viewport (see
   js/three-common.js). Without WebGL the flat fronts of the passes stay.
   With prefers-reduced-motion it does not swing on its own; it draws when
   you touch it. */
(function () {
'use strict';
var stage = document.querySelector('.badge3d-stage');
if (!stage) return;
var host = stage.querySelector('.badge3d-canvas');
var base = stage.getAttribute('data-base');
var names = stage.getAttribute('data-names').split('|');
var straps = stage.getAttribute('data-straps').split('|');
var code = stage.getAttribute('data-code') || 'HS22';
var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

var RATIO = 825 / 1350;         // the art's width over its height
var W = 1, H = W / RATIO, T = 0.04, R = 0.075;

function roundedRect(THREE, w, h, r) {
  var s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}

/* The art goes to the GPU from a canvas we draw ourselves, never straight
   from an <img>. The page shows the same files as the flat fallback, and
   Safari can hand WebGL its smaller, screen-sized decode of a picture while
   the texture still claims the full 825 x 1350, which shows up as the top-left
   corner of the art blown up across the card. Decoding the file afresh
   (fetch, then createImageBitmap) and drawing all of it into a canvas of a
   fixed power-of-two size makes every front map 1:1 onto its card. */
var TW = 1024, TH = 2048;
function cardCanvas() {
  var c = document.createElement('canvas'); c.width = TW; c.height = TH;
  return c;
}
function decode(src) {
  if (window.fetch && window.createImageBitmap) {
    return fetch(src).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(function (bl) { return createImageBitmap(bl); })
      .catch(function () { return imgLoad(src); });
  }
  return imgLoad(src);
}
function imgLoad(src) {
  return new Promise(function (ok, no) {
    var i = new Image(); i.onload = function () { ok(i); }; i.onerror = no; i.src = src;
  });
}
function frontCanvas(pic) {
  var c = cardCanvas(), g = c.getContext('2d');
  var pw = pic.naturalWidth || pic.width, ph = pic.naturalHeight || pic.height;
  g.drawImage(pic, 0, 0, pw, ph, 0, 0, TW, TH);
  return c;
}

/* the back: the pass's own colour, a centred 22, the festival, the pass and
   the code. Drawn in the art's own 825 x 1350 units, every line fitted to the
   card with even margins so nothing runs off an edge. */
function backCanvas(front, name) {
  var c = cardCanvas(), g = c.getContext('2d');
  var s = document.createElement('canvas'); s.width = s.height = 8;
  var sg = s.getContext('2d'); sg.drawImage(front, 0, 0, TW, TH * 0.12, 0, 0, 8, 8);
  var d = sg.getImageData(0, 0, 8, 8).data, r = 0, gr = 0, b = 0, n = 0;
  for (var i = 0; i < d.length; i += 4) { r += d[i]; gr += d[i + 1]; b += d[i + 2]; n++; }
  r = Math.round(r / n); gr = Math.round(gr / n); b = Math.round(b / n);
  var lum = (0.299 * r + 0.587 * gr + 0.114 * b), ink = lum > 150 ? '#141414' : '#f4f1ea';
  g.scale(TW / 825, TH / 1350);
  g.fillStyle = 'rgb(' + r + ',' + gr + ',' + b + ')'; g.fillRect(0, 0, 825, 1350);
  var sh = g.createLinearGradient(0, 0, 0, 1350);
  sh.addColorStop(0, 'rgba(255,255,255,.08)'); sh.addColorStop(1, 'rgba(0,0,0,.10)');
  g.fillStyle = sh; g.fillRect(0, 0, 825, 1350);
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  var SANS = '-apple-system, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif';
  function line(text, weight, size, maxW, y, track) {
    g.font = weight + ' ' + size + 'px ' + SANS;
    if ('letterSpacing' in g) g.letterSpacing = (track || 0) + 'px';
    var w = g.measureText(text).width;
    if (w > maxW) { size = Math.floor(size * maxW / w); g.font = weight + ' ' + size + 'px ' + SANS; }
    g.fillText(text, 412.5, y);
  }
  line('22', '800', 400, 825 - 2 * 150, 640, -8);
  line('HOLLYSHORTS FILM FESTIVAL', '600', 34, 825 - 2 * 110, 730, 4);
  g.globalAlpha = 0.6; g.fillRect(412.5 - 140, 790, 280, 3); g.globalAlpha = 1;
  line(name.toUpperCase(), '700', 84, 825 - 2 * 110, 930, 6);
  line(code, '500', 30, 825 - 2 * 110, 1240, 6);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  return c;
}

/* where each pass hangs: its row and x. The rows fall one under another, each
   from its own rail; every strap is the same length and every card the same
   size, so the rows read as an even grid. */
var TILT = [0.02, -0.025, 0.015, -0.02, 0.025, -0.015, 0.02, -0.025];   // resting lean, about a degree
var DROP = 0.44, SP = 1.32, GAP = 0.24;
var phone = window.matchMedia('(max-width: 767px)');
function layout(n) {
  var per = phone.matches ? [2, 2, 2, 2] : [3, 3, 2], out = [], rail = 0, i = 0;
  out.rows = [];
  per.forEach(function (cnt, r) {
    for (var c = 0; c < cnt && i < n; c++, i++) out.push({ row: r, x: (c - (cnt - 1) / 2) * SP, rail: rail });
    out.rows.push({ y: rail, half: (cnt - 1) / 2 * SP + W / 2 + 0.15 });
    rail -= DROP + 0.16 + H + 0.04 + GAP;
  });
  out.bottom = rail + GAP - 0.1; out.span = ((phone.matches ? 2 : 3) - 1) * SP + W + 0.16;
  return out;
}

function build(THREE) {
  var renderer = DCThree.renderer(THREE, host);
  var scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromEquirectangular(DCThree.env(THREE)).texture;
  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  var key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(-4, 6, 10); scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  var metal = new THREE.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 1, roughness: 0.25, envMapIntensity: 1.4 });
  var shape = roundedRect(THREE, W, H, R);
  var slabGeo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false });
  /* the faces share the slab's rounded outline; their UVs run 0 to 1 across
     the whole card, so the art lands on it edge to edge */
  var faceGeo = new THREE.ShapeGeometry(shape, 6), uv = faceGeo.attributes.uv, pos = faceGeo.attributes.position;
  for (var u = 0; u < uv.count; u++) uv.setXY(u, pos.getX(u) / W + 0.5, pos.getY(u) / H + 0.5);
  uv.needsUpdate = true;
  var slotGeo = new THREE.PlaneGeometry(0.22, 0.05), slotMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  var RING = 0.1, ringGeo = new THREE.TorusGeometry(RING, 0.017, 12, 40), barGeo = new THREE.BoxGeometry(0.17, 0.07, 0.035);
  var slabMat = new THREE.MeshStandardMaterial({ color: 0xf1eee7, roughness: 0.45, metalness: 0, envMapIntensity: 0.6 });
  var SLOT = H / 2 - 0.09;   // the slot's centre, down from the card's top edge

  var badges = [], hitList = [], rails = [];
  var railGeo = new THREE.BoxGeometry(1, 0.045, 0.06), railMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.6, envMapIntensity: 1 });
  for (var q = 0; q < 4; q++) { var rl = new THREE.Mesh(railGeo, railMat); rl.position.z = -0.05; scene.add(rl); rails.push(rl); }

  function tex(canvas) {
    var t = new THREE.CanvasTexture(canvas);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  names.forEach(function (nm, i) {
    var b = { i: i, name: nm, swing: 0, swingV: 0, yaw: 0, yawV: 0, target: 0, hold: 0, tilt: TILT[i % 8], phase: i * 1.9 + 0.7 };
    b.row = 0;
    /* one rigid chain on one axis (x = 0 in the pivot's frame), top to
       bottom: the strap from the rail, the crimp bar that ends it, the split
       ring through the bar, and the card's slot that the ring's foot passes
       through. The whole chain swings from the rail; the card and its ring
       turn about that same axis, so nothing comes apart at any angle. */
    b.pivot = new THREE.Group(); scene.add(b.pivot);
    b.strapMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.75, metalness: 0 });
    b.strapMat.color.set(straps[i] || '#222').convertSRGBToLinear();
    b.strap = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1, 0.012), b.strapMat); b.pivot.add(b.strap);
    b.hang = new THREE.Group(); b.pivot.add(b.hang);
    var bar = new THREE.Mesh(barGeo, metal); b.hang.add(bar);
    b.spin = new THREE.Group(); b.hang.add(b.spin);
    var ring = new THREE.Mesh(ringGeo, metal); ring.position.y = -RING + 0.02; ring.rotation.y = 1.1; b.spin.add(ring);
    var foot = -2 * RING + 0.02;   // the bottom of the ring
    var card = new THREE.Group(); card.position.y = foot - SLOT; b.spin.add(card);
    var slab = new THREE.Mesh(slabGeo, slabMat); slab.position.z = -T / 2; slab.userData.badge = b; card.add(slab); hitList.push(slab);
    b.front = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ color: 0xf1eee7, roughness: 0.4, metalness: 0, envMapIntensity: 0.7 }));
    b.front.position.z = T / 2 + 0.001; b.front.userData.badge = b; card.add(b.front); hitList.push(b.front);
    b.back = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ color: 0xf1eee7, roughness: 0.5, metalness: 0, envMapIntensity: 0.5 }));
    b.back.rotation.y = Math.PI; b.back.position.z = -T / 2 - 0.001; b.back.userData.badge = b; card.add(b.back); hitList.push(b.back);
    var slot = new THREE.Mesh(slotGeo, slotMat); slot.position.set(0, SLOT, T / 2 + 0.003); card.add(slot);
    var slot2 = slot.clone(); slot2.rotation.y = Math.PI; slot2.position.z = -T / 2 - 0.003; card.add(slot2);
    badges.push(b);
    decode(base + encodeURIComponent(nm) + '.webp').then(function (pic) {
      var fc = frontCanvas(pic);
      if (pic.close) pic.close();
      b.front.material.map = tex(fc); b.front.material.color.set(0xffffff); b.front.material.needsUpdate = true;
      b.back.material.map = tex(backCanvas(fc, nm)); b.back.material.color.set(0xffffff); b.back.material.needsUpdate = true;
      want();
    }).catch(function () {});
  });

  function place() {
    var L = layout(badges.length);
    badges.forEach(function (b, i) {
      var p = L[i];
      b.pivot.position.set(p.x, p.rail, 0);
      b.strap.scale.y = DROP + 0.06; b.strap.position.y = -DROP / 2 + 0.03;
      b.hang.position.y = -DROP;
    });
    rails.forEach(function (rl, r) {
      var row = L.rows[r]; rl.visible = !!row;
      if (row) { rl.scale.x = row.half * 2; rl.position.set(0, row.y + 0.02, -0.05); }
    });
    return L;
  }

  /* motion. Each strap is a spring. Each card rests face-on: a drag spins it
     and on release it settles on the nearest front; a tap turns it over, it
     shows its back for a moment, then carries on round to the front. */
  var TWO = Math.PI * 2, HOLD = 2600, MAXSWING = 0.35;
  var dragging = null, moved = 0, downT = 0, lastX = 0, lastT = 0, visible = true, raf = 0, t0 = performance.now();
  function nearestFront(a) { return Math.round(a / TWO) * TWO; }
  function showsBack(b) { return Math.abs(b.target - nearestFront(b.target)) > 1; }
  function flip(b, now) {
    if (showsBack(b)) { b.target += Math.PI; b.hold = 0; }
    else { b.target = nearestFront(b.yaw) + Math.PI; b.hold = now + HOLD; }
  }
  function nudge(b, v) {
    [-1, 1].forEach(function (d) {
      var n = badges[b.i + d]; if (n && n.row === b.row) n.swingV += -d * v * 0.55;
    });
  }
  function frame(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    var dt = Math.min(40, now - (lastT || now)) / 1000; lastT = now;
    var still = reduce.matches, busy = false;
    badges.forEach(function (b) {
      b.swingV += (-30 * b.swing - 2.0 * b.swingV) * dt; b.swing += b.swingV * dt;
      if (b.swing > MAXSWING) { b.swing = MAXSWING; b.swingV = Math.min(0, b.swingV); }
      if (b.swing < -MAXSWING) { b.swing = -MAXSWING; b.swingV = Math.max(0, b.swingV); }
      var tt = (now - t0) / 2100 + b.phase;
      var idle = still ? 0 : Math.sin(tt) * 0.02, sway = still ? 0 : Math.sin(tt * 0.8 + 1.3) * 0.03;
      if (dragging !== b) {
        if (b.hold && now > b.hold) { b.hold = 0; b.target += Math.PI; }   // back to the front
        b.yawV += ((b.target - b.yaw) * 34 - b.yawV * 9) * dt; b.yaw += b.yawV * dt;
        if (still && Math.abs(b.target - b.yaw) < 0.002) { b.yaw = b.target; b.yawV = 0; }
      }
      b.pivot.rotation.z = b.tilt + b.swing + idle;
      b.spin.rotation.y = b.yaw + sway;
      if (Math.abs(b.swing) > 0.0005 || Math.abs(b.swingV) > 0.002 || dragging === b || b.hold || Math.abs(b.target - b.yaw) > 0.002 || Math.abs(b.yawV) > 0.01) busy = true;
    });
    renderer.render(scene, camera);
    if (!still || busy) raf = requestAnimationFrame(frame);
  }
  function want() { if (!raf && visible) { lastT = 0; raf = requestAnimationFrame(frame); } }

  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) {
    var r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    var hit = ray.intersectObjects(hitList, false)[0];
    return hit ? hit.object.userData.badge : null;
  }
  stage.addEventListener('pointerdown', function (e) {
    var b = pick(e); if (!b) return;
    dragging = b; moved = 0; downT = performance.now(); lastX = e.clientX; b.yawV = 0; b.hold = 0;
    stage.classList.add('is-dragging');
    try { stage.setPointerCapture(e.pointerId); } catch (x) {}
    want();
  });
  stage.addEventListener('pointermove', function (e) {
    if (!dragging) { stage.style.cursor = pick(e) ? 'grab' : ''; return; }
    var dx = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(dx);
    dragging.yaw += dx * 0.012; dragging.yawV = dx * 0.012 * 60; dragging.swingV += dx * 0.015;
    if (Math.abs(dx) > 2) nudge(dragging, dx * 0.012);
    want();
  });
  function up(e) {
    if (!dragging) return;
    var b = dragging, now = performance.now(); dragging = null; stage.classList.remove('is-dragging');
    /* a tap turns it over. A pointercancel is the browser taking the touch
       for a scroll, never a tap. */
    if (e.type === 'pointerup' && moved < 6 && now - downT < 500) { flip(b, now); b.yawV = 0; b.swingV += 0.4; nudge(b, 0.6); }
    else { b.target = nearestFront(b.yaw + b.yawV * 0.2); b.hold = 0; }
    want();
  }
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('keydown', function (e) {
    if (e.key !== ' ' && e.key !== 'Enter' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault(); e.stopPropagation();
    // keyboard: turn them all over, or set them all swinging
    var now = performance.now();
    badges.forEach(function (b, i) {
      if (e.key === ' ' || e.key === 'Enter') flip(b, now);
      b.swingV += (e.key === 'ArrowLeft' ? -0.5 : e.key === 'ArrowRight' ? 0.5 : 0.25) * (i % 2 ? 1 : 0.8);
    });
    want();
  });

  function size() {
    var L = place(), top = 0.25, bottom = L.bottom - 0.1;
    badges.forEach(function (b, i) { b.row = L[i].row; });
    stage.style.aspectRatio = L.span + ' / ' + (top - bottom);   // the stage is exactly as tall as the hang
    var w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h); camera.aspect = w / h;
    var f = Math.tan(camera.fov * Math.PI / 360);
    var d = Math.max((top - bottom) / 2 / f, L.span / 2 / (camera.aspect * f));
    camera.position.set(0, (top + bottom) / 2, d);
    camera.lookAt(0, (top + bottom) / 2, 0);
    camera.updateProjectionMatrix(); want();
  }
  window.addEventListener('resize', size);
  new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) want(); }).observe(stage);
  document.addEventListener('visibilitychange', want);
  if (reduce.addEventListener) reduce.addEventListener('change', want);

  host.appendChild(renderer.domElement);
  size(); place();
  badges.forEach(function (b, i) { b.swingV = 0.15 * (i % 2 ? 1 : -1); });
  stage.classList.add('is-live'); want();
}

DCThree.lazy(stage, function (THREE) {
  if (!THREE) { stage.classList.add('is-flat'); return; }
  build(THREE);
});
})();
