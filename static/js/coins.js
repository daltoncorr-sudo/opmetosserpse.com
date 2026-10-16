// Opmet Osserpse: the stone coins (D, Oct. 15, 2026). On the cover, three carved stone coins drop into a small pile in
// the hand's slot and can be picked up and dragged; at the top of each inner page, one alabaster coin where the hand was.
// three.js 0.169.0 and cannon-es 0.20.0, served from /js/vendor/coins/, imported only when they run. The numbers come
// from the handoff's reference, 04_Site/2026-10-15_stone-coins-handoff_v01/reference/coins-prototype.html.
//   The cover: .cover .mark[data-coins] holds the three models (sandstone, basalt, alabaster) and [data-coins-still]
//     the still for when 3D can't run. One transparent canvas over the whole cover, shadows on a see-through ground.
//   A header: [data-coin] holds the header model. Its still shows at once (site.css); on a fine pointer, without
//     reduced motion, the live coin fades in over it and leans toward the cursor. Touch-only devices keep the still.

const VENDOR = '/js/vendor/coins/';
const R = 1, T = 0.46;  // a coin's radius and thickness, in scene units
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// After the first paint, never before the name: the fonts, then two frames
let painted;
const afterPaint = () => painted ||= (document.fonts ? document.fonts.ready : Promise.resolve())
  .then(() => new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok))));

let lib;
function three() {
  return lib ||= Promise.all([import(VENDOR + 'three.module.min.js'), import(VENDOR + 'GLTFLoader.js'), import(VENDOR + 'RoomEnvironment.js')])
    .then(([THREE, G, E]) => {
      // GLTFLoader reads a model's pictures with fetch() on blob: URLs (Chrome, Firefox, Safari 17 on), which the
      // Content-Security-Policy's connect-src refuses; an <img> reads them instead, as in older Safari (img-src blob:)
      const loader = new G.GLTFLoader().register(parser => {
        parser.textureLoader = new THREE.TextureLoader(parser.options.manager).setCrossOrigin(parser.options.crossOrigin);
        return { name: 'opmet_img_textures' };
      });
      return { THREE, loader, RoomEnvironment: E.RoomEnvironment };
    });
}

// One coin from its model, centered on its own origin. The models are quantized: the mesh's node carries the scale
// and offset that put the coin at the origin, so the mesh keeps them inside a holder, and the holder is what moves.
// Sandstone and basalt keep their own material, matte; alabaster gets a touch of translucency.
const models = {};
function coin(url, alabaster) {
  return models[url] ||= three().then(L => L.loader.loadAsync(url).then(g => {
    let mesh; g.scene.traverse(o => { if (o.isMesh) mesh = o; });
    g.scene.updateMatrixWorld(true); mesh.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
    const holder = new L.THREE.Group(); holder.add(mesh);
    const m = mesh.material, C = L.THREE.Color;
    if (alabaster) mesh.material = new L.THREE.MeshPhysicalMaterial({ map: m.map, normalMap: m.normalMap, roughness: 0.36,
      transmission: 0.12, thickness: 0.8, attenuationColor: new C('#d8a873'), attenuationDistance: 1.2, ior: 1.49,
      sheen: 0.25, sheenRoughness: 0.6, sheenColor: new C('#fff4e2') });
    else { m.roughness = 0.92; m.metalness = 0; }
    return holder;
  }));
}

function renderer(L) {
  const r = new L.THREE.WebGLRenderer({ antialias: true, alpha: true });  // throws without WebGL 2: the still stays
  r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setClearColor(0x000000, 0);
  r.toneMapping = L.THREE.AgXToneMapping; r.toneMappingExposure = 1.05;
  r.shadowMap.enabled = true; r.shadowMap.type = L.THREE.PCFSoftShadowMap;
  r.domElement.setAttribute('aria-hidden', 'true');
  return r;
}
function lights(L, scene, r, map) {
  const pm = new L.THREE.PMREMGenerator(r);
  scene.environment = pm.fromScene(new L.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.6; pm.dispose();
  const key = new L.THREE.DirectionalLight('#fff5e8', 2.1); key.position.set(-4, 8, -3.5);
  key.castShadow = true; key.shadow.mapSize.set(map, map); key.shadow.radius = 6; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  const c = key.shadow.camera; c.left = -9; c.right = 9; c.top = 9; c.bottom = -9; c.near = 0.5; c.far = 30;
  scene.add(key); return key;
}

/* ---------------- the cover: three coins, a physics stage ---------------- */

// The pile: three slots, in coin radii, that overlap by about a tenth of a coin, each a little above its resting
// height, so the coins land one after another, each on the last one's edge. Alabaster always lands last, on top.
const PILE = [{ x: -0.92, z: 0.05, y: 0.12 }, { x: 0.92, z: -0.28, y: 0.62 }, { x: 0.02, z: 1.48, y: 1.05 }];

function still(slot) {  // when 3D can't run: the pile as a picture, in the slot
  const src = slot.getAttribute('data-coins-still');
  if (!src || slot.querySelector('.coins-still')) return;
  const img = new Image(); img.className = 'coins-still'; img.alt = slot.getAttribute('aria-label') || ''; img.src = src;
  slot.appendChild(img);
}

async function cover(slot) {
  const sec = slot.closest('.cover'), home = sec.closest('[data-home]'), inner = sec.querySelector('.cover-inner');
  await afterPaint();
  let L, C, r, meshes;
  try {
    [L, C] = await Promise.all([three(), import(VENDOR + 'cannon-es.js')]);
    r = renderer(L);
    meshes = await Promise.all(slot.getAttribute('data-coins').split(' ').map((u, i) => coin(u, i === 2)));
  } catch (e) { if (r) r.dispose(); still(slot); return; }
  const THREE = L.THREE;
  // The cover's arrive (1.6 s) first; until then the slot is empty, as it was before the hand appeared
  await Promise.all((inner && inner.getAnimations ? inner.getAnimations() : []).map(a => a.finished.catch(() => {})));

  const canvas = r.domElement; canvas.className = 'coins-stage'; sec.insertBefore(canvas, sec.firstChild);
  const scene = new THREE.Scene(), key = lights(L, scene, r, 2048);
  key.position.multiplyScalar(2); key.shadow.camera.far = 60;  // the light's frustum reaches the whole cover
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.14 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const cam = new THREE.PerspectiveCamera(26, 1, 0.5, 400);

  const world = new C.World({ gravity: new C.Vec3(0, -30, 0) });
  world.allowSleep = true; world.broadphase = new C.SAPBroadphase(world); world.solver.iterations = 14;
  const dc = world.defaultContactMaterial;
  dc.friction = 0.42; dc.restitution = 0.08; dc.contactEquationStiffness = 1e8; dc.contactEquationRelaxation = 3;
  const floor = new C.Body({ mass: 0, shape: new C.Plane() }); floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0); world.addBody(floor);
  const walls = [Math.PI / 2, -Math.PI / 2, 0, Math.PI].map(ry => {  // left, right, far, near; placed by frame()
    const w = new C.Body({ mass: 0, shape: new C.Plane() }); w.quaternion.setFromEuler(0, ry, 0); world.addBody(w); return w;
  });
  const coins = meshes.map((m, i) => {
    const mesh = m.clone(); mesh.traverse(o => { o.castShadow = o.receiveShadow = true; }); mesh.userData.i = i; mesh.visible = false; scene.add(mesh);
    const body = new C.Body({ mass: 1.6, linearDamping: 0.06, angularDamping: 0.18, sleepSpeedLimit: 0.05, sleepTimeLimit: 0.4 });
    body.addShape(new C.Cylinder(R * 0.985, R * 0.985, T, 28));
    return { mesh, body };
  });
  const sync = () => coins.forEach(c => { c.mesh.position.copy(c.body.position); c.mesh.quaternion.copy(c.body.quaternion); });
  const draw = () => r.render(scene, cam);
  const awake = () => coins.some(c => c.body.world && c.body.sleepState !== C.Body.SLEEPING);
  // Coins resting on each other's edges can rock a hair forever and never fall asleep: once every coin has been nearly
  // still for a second (or the pile has settled off screen), they all sleep, so the drawing stops
  const calm = () => coins.every(c => c.body.velocity.length() < 0.3 && c.body.angularVelocity.length() < 0.6);
  const rest = () => coins.forEach(c => c.body.sleep());
  const settle = () => { for (let i = 0; i < 900 && awake(); i++) world.step(1 / 120); rest(); };  // off screen

  // Framing: the camera looks almost straight down; a coin's diameter is 0.56 of the slot's height (times
  // --coins-scale), and the pile sits at the slot's center
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), up = new THREE.Vector3(0, 1, 0);
  let at = null, box = null, dropped = false;
  function onGround(x, y, h) {
    ndc.set(x, y); ray.setFromCamera(ndc, cam);
    return ray.ray.intersectPlane(new THREE.Plane(up, -h), new THREE.Vector3());
  }
  function frame() {
    const cr = sec.getBoundingClientRect(), sr = slot.getBoundingClientRect();
    if (!cr.width || !cr.height || !sr.height) return null;
    r.setSize(cr.width, cr.height, false); cam.aspect = cr.width / cr.height;
    const k = 0.28 * sr.height * (parseFloat(getComputedStyle(slot).getPropertyValue('--coins-scale')) || 1);  // pixels per unit
    const dist = cr.height / 2 / k / Math.tan(13 * Math.PI / 180);
    cam.position.set(0, dist * Math.cos(0.10), dist * Math.sin(0.10)); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const was = at;
    at = onGround((sr.left + sr.width / 2 - cr.left) / cr.width * 2 - 1, 1 - (sr.top + sr.height / 2 - cr.top) / cr.height * 2, T / 2);
    // Four walls at 94% of the visible cover, so no coin can leave the screen
    box = { x0: onGround(-0.94, 0, 0).x, x1: onGround(0.94, 0, 0).x, z0: onGround(0, 0.94, 0).z, z1: onGround(0, -0.94, 0).z };
    walls[0].position.set(box.x0, 0, 0); walls[1].position.set(box.x1, 0, 0); walls[2].position.set(0, 0, box.z0); walls[3].position.set(0, 0, box.z1);
    const s = key.shadow.camera, e = Math.hypot(box.x1 - box.x0, box.z1 - box.z0) / 2 + 2;
    s.left = s.bottom = -e; s.right = s.top = e; s.updateProjectionMatrix();
    return was || at;
  }

  // The drop: sandstone and basalt trade the first two slots at random; the pile turns and mirrors at random, each
  // coin's yaw countering the turn so the hands stay roughly upright. Every visit drops a slightly different pile.
  const rnd = Math.random;
  function drop() {
    frame();
    const turn = (rnd() - 0.5) * 1.1, flip = rnd() < 0.5 ? -1 : 1, c = Math.cos(turn), s = Math.sin(turn);
    const lower = rnd() < 0.5 ? [0, 1] : [1, 0], slotOf = [lower[0], lower[1], 2];
    const pts = PILE.map(p => ({ x: p.x * flip + (rnd() - 0.5) * 0.14, z: p.z + (rnd() - 0.5) * 0.14, y: p.y }));
    const rot = pts.map(p => ({ x: p.x * c - p.z * s, z: p.x * s + p.z * c, y: p.y }));
    const xs = rot.map(p => p.x), zs = rot.map(p => p.z);  // center the pile's outline, not its middle coin
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    coins.forEach((coin, i) => {
      const b = coin.body, p = rot[slotOf[i]];
      b.position.set(at.x + p.x - cx, T / 2 + p.y, at.z + p.z - cz);
      b.velocity.set(0, -0.4, 0); b.angularVelocity.set((rnd() - 0.5) * 1.6, (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 1.6);
      b.quaternion.setFromEuler((rnd() - 0.5) * 0.32, -turn + (rnd() - 0.5) * 0.8, (rnd() - 0.5) * 0.32);
      world.addBody(b); b.wakeUp(); coin.mesh.visible = true;
    });
    dropped = true;
    if (reduce) settle();  // reduced motion: the pile already settled
    sync(); draw();
  }
  // A resize or a turn of the phone: frame again and move the pile with its slot, settled, without a new drop
  function reframe() {
    const was = frame(); if (!was || !dropped) return;
    release();
    const dx = at.x - was.x, dz = at.z - was.z; let moved = false;
    coins.forEach(({ body: b }) => {
      const x = clamp(b.position.x + dx, box.x0 + R, box.x1 - R), z = clamp(b.position.z + dz, box.z0 + R, box.z1 - R);
      if (x !== b.position.x + dx || z !== b.position.z + dz) moved = true;
      b.position.set(x, b.position.y, z); b.aabbNeedsUpdate = true;
    });
    if (moved) { coins.forEach(c => c.body.wakeUp()); settle(); }
    sync(); draw();
  }

  // Render only while a coin is awake or held; pause while the cover is out of sight (scrolled away, a panel or a
  // project open over it, the tab hidden)
  let raf = 0, last = 0, seen = true, quiet = 0;
  const visible = () => seen && !(home && home.inert) && !document.hidden;
  function start() { if (!raf && dropped && visible()) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  function tick(t) {
    raf = 0;
    if (!visible()) { release(); return; }
    const dt = clamp((t - last) / 1000, 0, 0.05); last = t;
    if (joint) { const p = grip.position; p.x += (aim.x - p.x) * 0.35; p.y += (aim.y - p.y) * 0.18; p.z += (aim.z - p.z) * 0.35; }
    world.step(1 / 120, dt, 6);
    quiet = !joint && calm() ? quiet + dt : 0;
    if (quiet > 1) { rest(); quiet = 0; }
    sync(); draw();
    if (joint || awake()) raf = requestAnimationFrame(tick);
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(e => { seen = e[e.length - 1].isIntersecting; start(); }).observe(sec);
  if (home) new MutationObserver(start).observe(home, { attributes: true, attributeFilter: ['inert'] });
  document.addEventListener('visibilitychange', start);
  let rs = 0;
  addEventListener('resize', () => { cancelAnimationFrame(rs); rs = requestAnimationFrame(reframe); });

  // Picking up: a point constraint hangs the coin from the grabbed point, so it tilts and swings with its weight.
  // A miss does nothing: the name, the nav and every link work as before.
  const grip = new C.Body({ mass: 0 }); grip.collisionFilterGroup = 0; grip.collisionFilterMask = 0; world.addBody(grip);
  const lift = 1.25, aim = new THREE.Vector3(), plane = new THREE.Plane(up, -lift);
  let joint = null, held = null, over = false, hover = null, until = 0;
  function point(e) {
    const cr = sec.getBoundingClientRect();
    ndc.set((e.clientX - cr.left) / cr.width * 2 - 1, 1 - (e.clientY - cr.top) / cr.height * 2); ray.setFromCamera(ndc, cam);
  }
  function hit(e) {
    if (!dropped || !visible()) return null;
    point(e); return ray.intersectObjects(coins.map(c => c.mesh), true)[0] || null;
  }
  function release() {
    if (!joint) return;
    world.removeConstraint(joint); joint = null;
    held.body.linearDamping = 0.06; held.body.angularDamping = 0.18; held.body.wakeUp(); held = null;
    sec.classList.remove('coin-held'); until = performance.now() + 400; start();
  }
  sec.addEventListener('pointerdown', e => {
    if (joint || e.button !== 0) return;
    const h = hit(e); if (!h) return;
    e.preventDefault();
    try { sec.setPointerCapture(e.pointerId); } catch (_) {}
    held = coins[h.object.parent.userData.i];
    const p = h.point; grip.position.set(p.x, p.y, p.z);
    joint = new C.PointToPointConstraint(held.body, held.body.pointToLocalFrame(new C.Vec3(p.x, p.y, p.z)), grip, new C.Vec3(0, 0, 0), 60);
    world.addConstraint(joint); held.body.wakeUp(); held.body.linearDamping = 0.35; held.body.angularDamping = 0.55;
    aim.set(p.x, lift, p.z); sec.classList.add('coin-held'); start();
  });
  sec.addEventListener('pointermove', e => {
    if (joint) {
      point(e);
      if (ray.ray.intersectPlane(plane, aim)) { aim.x = clamp(aim.x, box.x0 + R, box.x1 - R); aim.z = clamp(aim.z, box.z0 + R, box.z1 - R); }
      return;
    }
    if (e.pointerType !== 'mouse') return;
    if (!hover) requestAnimationFrame(() => {  // the cursor: grab over a coin, the default elsewhere
      const o = !!hit(hover); hover = null;
      if (o !== over) { over = o; sec.classList.toggle('coin-over', o); }
    });
    hover = { clientX: e.clientX, clientY: e.clientY };
  });
  sec.addEventListener('pointerleave', () => { if (over) { over = false; sec.classList.remove('coin-over'); } });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => sec.addEventListener(n, release));
  // On a phone, a touch that starts on a coin drags it; anywhere else it scrolls the page as always
  sec.addEventListener('touchstart', e => { if (joint || (e.touches.length === 1 && hit(e.touches[0]))) e.preventDefault(); }, { passive: false });
  // The click that ends a pick-up never reaches a link under the coin
  addEventListener('click', e => { if (performance.now() < until && sec.contains(e.target)) { e.preventDefault(); e.stopPropagation(); } }, true);

  drop(); start();
}

/* ---------------- the headers: one coin where the hand was ---------------- */

const live = new Set();
let lean = 0, cursor = null;
const io = 'IntersectionObserver' in window && new IntersectionObserver(es => es.forEach(e => {
  const c = e.target.coin; if (c) { c.seen = e.isIntersecting; if (c.seen) paint(c); }
}));

function headers(root) {
  const els = root.matches && root.matches('[data-coin]') ? [root] : root.querySelectorAll('[data-coin]');
  els.forEach(el => { if (el.coin === undefined) { el.coin = null; if (fine && !reduce) liveCoin(el); } });
}

async function liveCoin(el) {
  await afterPaint();
  let L, r, mesh;
  try { L = await three(); r = renderer(L); mesh = (await coin(el.getAttribute('data-coin'), true)).clone(); }
  catch (e) { if (r) r.dispose(); return; }  // the still stays
  if (!el.isConnected) { r.dispose(); return; }
  const THREE = L.THREE, scene = new THREE.Scene(); lights(L, scene, r, 512);
  const cam = new THREE.PerspectiveCamera(22, 1, 0.5, 50); cam.position.set(0, 6.2, 0.6); cam.lookAt(0, 0, 0);
  const g = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.ShadowMaterial({ opacity: 0.10 }));
  g.rotation.x = -Math.PI / 2; g.position.y = -T / 2; g.receiveShadow = true; scene.add(g);
  mesh.traverse(o => { o.castShadow = true; }); mesh.rotation.y = 0.18; scene.add(mesh);  // face up, turned 0.18 rad
  const c = el.coin = { el, r, scene, cam, mesh, rot: { x: 0, y: 0 }, goal: { x: 0, y: 0 }, seen: true };
  el.appendChild(r.domElement); fit(c);
  if (cursor) aimAt(c);
  live.add(c); if (io) io.observe(el);
  requestAnimationFrame(() => el.classList.add('is-live'));  // the live coin fades in over the still (site.css)
}
function fit(c) { const s = c.r.domElement.clientWidth; if (s) { c.r.setSize(s, s, false); paint(c); } }
function paint(c) { c.mesh.rotation.x = c.rot.x; c.mesh.rotation.z = -c.rot.y; c.r.render(c.scene, c.cam); }
function aimAt(c) {  // lean up to about 0.22 rad toward the cursor
  const b = c.r.domElement.getBoundingClientRect();
  c.goal.x = clamp((cursor.y - (b.top + b.height / 2)) / innerHeight, -1, 1) * 0.22;
  c.goal.y = clamp((cursor.x - (b.left + b.width / 2)) / innerWidth, -1, 1) * 0.22;
}
function ease() {  // eased by 0.08 a frame; renders only while it's easing
  lean = 0; let more = false;
  live.forEach(c => {
    const { rot, goal } = c;
    if (Math.abs(goal.x - rot.x) + Math.abs(goal.y - rot.y) < 1e-4) return;
    rot.x += (goal.x - rot.x) * 0.08; rot.y += (goal.y - rot.y) * 0.08; more = true;
    if (c.seen) paint(c);
  });
  if (more) lean = requestAnimationFrame(ease);
}
function prune() {  // a coin taken off the page (a project panel emptied or replaced) gives back its canvas
  live.forEach(c => { if (!c.el.isConnected) { live.delete(c); if (io) io.unobserve(c.el); c.r.dispose(); c.r.forceContextLoss(); } });
}
if (fine && !reduce) {
  addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    cursor = { x: e.clientX, y: e.clientY }; live.forEach(aimAt); if (!lean && live.size) lean = requestAnimationFrame(ease);
  }, { passive: true });
  addEventListener('resize', () => live.forEach(fit));
}

const slot = document.querySelector('.cover .mark[data-coins]');
if (slot) cover(slot);
headers(document);
// Projects open in a panel on home: their nameplates arrive later
new MutationObserver(ms => {
  ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) headers(n); }));
  if (live.size) prune();
}).observe(document.body, { childList: true, subtree: true });
