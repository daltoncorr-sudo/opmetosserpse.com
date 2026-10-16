// Opmet Osserpse: the stone coins (D, Oct. 15, 2026; placement D, Oct. 16). On the cover, five carved stone coins (two hands,
// an eye, a dancer, a leaf) drop around the name and can be picked up and dragged; at the top of each inner page, one coin
// where the hand was; beside the work list's last name, one coin; and on About, two coins at its first screen's foot.
// three.js 0.169.0 and cannon-es 0.20.0, served from /js/vendor/coins/, imported only when they run. The numbers come
// from the handoff's reference, 04_Site/2026-10-15_stone-coins-handoff_v01/reference/coins-prototype.html.
//   The cover: .cover .mark[data-coins] holds the five models, and [data-stills] their stills, which hold the cover until
//     3D runs (and stay if it can't). One transparent canvas over the whole cover, shadows on a see-through ground.
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
// Each model's surface, in one place: alabaster's polished, slightly translucent material for the alabaster hand and the
// quill, and for the cup and the eye, which keep their own color (D, Oct. 16: matte and polished stone mixed on the
// cover); the rest keep their own, matte.
const ALABASTER = /opmet-coin_(alabaster|quill|cup|eye)/;
// A model lightened from its own baked color, so the basalt hand is the cover's only dark coin (D, Oct. 16)
const LIGHTER = { dancer: 2.5 };
function coin(url) {
  const alabaster = ALABASTER.test(url);
  return models[url] ||= three().then(L => L.loader.loadAsync(url).then(g => {
    let mesh; g.scene.traverse(o => { if (o.isMesh) mesh = o; });
    g.scene.updateMatrixWorld(true); mesh.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
    const holder = new L.THREE.Group(); holder.add(mesh);
    const m = mesh.material, C = L.THREE.Color;
    if (alabaster) mesh.material = new L.THREE.MeshPhysicalMaterial({ map: m.map, normalMap: m.normalMap, roughness: 0.36,
      transmission: 0.12, thickness: 0.8, attenuationColor: new C('#d8a873'), attenuationDistance: 1.2, ior: 1.49,
      sheen: 0.25, sheenRoughness: 0.6, sheenColor: new C('#fff4e2') });
    else { m.roughness = 0.92; m.metalness = 0; const k = LIGHTER[(url.match(/opmet-coin_([a-z]+)\./) || [])[1]]; if (k) m.color.setScalar(k); }
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

/* ---------------- the stages: coins you can pick up ---------------- */
// Two kinds of stage, each its own canvas and physics: the cover (three coins dropped into the hand's slot) and the work
// list (one coin beside its last name, on home and on /projects/). A stage's
// coins drop when it first comes into view, and draw only while one is awake or held and the stage is in sight.

// The work list's one coin (D, Oct. 15)
const onePile = rnd => [{ x: 0, z: 0, y: 0.35, yaw: (rnd() - 0.5) * 0.5, tilt: 0.08, spin: 0.15 }];  // nearly flat: it lands, not rolls

// o.host: takes the pointer and holds the cursor; o.area: the canvas covers it; o.slot: where the pile sits, its
// height the coin's size (o.unit: a coin's diameter as a share of it, times --coins-scale when o.scaled: the cover;
// a spot is already the coin's size, site.css --coin-d); o.pile(rnd): where each coin starts;
// o.ready: what the drop waits for once the stage is in view; o.fail: what to show if 3D can't run.
async function stage(o) {
  const { host, area, slot } = o;
  const urls = slot.getAttribute('data-coins').split(' ');
  let L, C, r, meshes;
  try {
    [L, C] = await Promise.all([three(), import(VENDOR + 'cannon-es.js')]);
    r = renderer(L);
    meshes = await Promise.all(urls.map(u => coin(u)));
  } catch (e) { if (r) r.dispose(); if (o.fail) o.fail(); return; }
  const THREE = L.THREE;

  const canvas = r.domElement; canvas.className = 'coins-stage'; area.insertBefore(canvas, area.firstChild);
  const scene = new THREE.Scene(), key = lights(L, scene, r, 2048);
  key.position.multiplyScalar(2); key.shadow.camera.far = 60;  // the light's frustum reaches the whole stage
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.14 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const cam = new THREE.PerspectiveCamera(26, 1, 0.5, 400);
  scene.add(key.target);  // the light follows the stage's ground (frame)
  // o.track: a track stage (the work list's coin). The scene is the whole track, the list's part of the page, with its
  // origin at the track's top center, so the list growing below never moves it; the stage (o.area) is a window onto
  // it that stays pinned to the browser window (sticky, site.css), and the camera pans with the page (view)
  const track = o.track || null;
  let dist = 1, camAt = null, placedW = 0;

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
  const draw = () => { r.render(scene, cam); placeGrips(); };
  // Each coin's grip: an invisible round target riding on the coin (site.css .coin-grip). A touch that starts on a coin
  // is the coin's from the start (touch-action: none), whatever the page was doing (a touch right after Work's smooth
  // scroll can't be taken over by a script), and the cursor reads grab over a coin; a tap still passes through (through)
  const grips = document.createElement('div'); grips.className = 'coin-grips'; area.appendChild(grips);
  coins.forEach(c => { c.grip = document.createElement('span'); c.grip.className = 'coin-grip'; c.grip.hidden = true; grips.appendChild(c.grip); });
  const gp = new THREE.Vector3();
  function placeGrips() {
    const w = canvas.clientWidth, h = canvas.clientHeight, d = 2 * R * kpx;
    coins.forEach(c => {
      if (!c.mesh.visible) return;
      gp.copy(c.mesh.position).project(cam);
      c.grip.hidden = false; c.grip.style.width = c.grip.style.height = d + 'px';
      c.grip.style.transform = 'translate(' + ((gp.x + 1) / 2 * w - d / 2) + 'px,' + ((1 - gp.y) / 2 * h - d / 2) + 'px)';
    });
  }
  const awake = () => coins.some(c => c.body.world && c.body.sleepState !== C.Body.SLEEPING);
  // Coins resting on each other's edges can rock a hair forever and never fall asleep: once every coin has been nearly
  // still for a second (or the pile has settled off screen), they all sleep, so the drawing stops
  const calm = () => coins.every(c => c.body.velocity.length() < 0.3 && c.body.angularVelocity.length() < 0.6);
  const rest = () => coins.forEach(c => c.body.sleep());
  const settle = () => { for (let i = 0; i < 900 && awake(); i++) world.step(1 / 120); rest(); };  // off screen

  // Framing: the camera looks almost straight down at the stage; a coin's diameter is o.unit of the slot's height
  // (times --coins-scale), and the pile's outline sits at the slot's center
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), up = new THREE.Vector3(0, 1, 0);
  let at = null, box = null, dropped = false, kpx = 1;
  function onGround(x, y, h) {
    ndc.set(x, y); ray.setFromCamera(ndc, cam);
    return ray.ray.intersectPlane(new THREE.Plane(up, -h), new THREE.Vector3());
  }
  function frame() {
    if (o.place && placedW !== innerWidth) { o.place(); placedW = innerWidth; }  // placed on load and when the width changes: never as the list opens or closes
    const cr = area.getBoundingClientRect(), b = slot.getBoundingClientRect(), dy = o.shift ? o.shift() : 0;
    const sr = { left: b.left, top: b.top - dy, width: b.width, height: b.height };  // where the slot rests
    if (!cr.width || !cr.height || !sr.height) return null;
    r.setSize(cr.width, cr.height, false); cam.aspect = cr.width / cr.height; cam.updateProjectionMatrix();
    const k = kpx = o.unit / 2 * sr.height * (o.scaled ? parseFloat(getComputedStyle(slot).getPropertyValue('--coins-scale')) || 1 : 1);  // pixels per unit
    dist = cr.height / 2 / k / Math.tan(13 * Math.PI / 180);
    const was = at;
    if (track) {  // walls at the track's edges: the coin can go anywhere in the list's part of the page
      const tr = track.getBoundingClientRect(), f = o.walls || 0.995;
      at = new THREE.Vector3((sr.left + sr.width / 2 - tr.left - tr.width / 2) / k, T / 2, (sr.top + sr.height / 2 - tr.top) / k);
      box = { x0: -tr.width / 2 / k * f, x1: tr.width / 2 / k * f, z0: 0.1, z1: tr.height / k - 0.1 };
      camAt = null; view();
    } else {
      cam.position.set(0, dist * Math.cos(0.10), dist * Math.sin(0.10)); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
      at = onGround((sr.left + sr.width / 2 - cr.left) / cr.width * 2 - 1, 1 - (sr.top + sr.height / 2 - cr.top) / cr.height * 2, T / 2);
      // Four walls at 94% of the visible stage (the cover), so no coin can leave it
      const f = o.walls || 0.94;
      box = { x0: onGround(-f, 0, 0).x, x1: onGround(f, 0, 0).x, z0: onGround(0, f, 0).z, z1: onGround(0, -f, 0).z };
    }
    walls[0].position.set(box.x0, 0, 0); walls[1].position.set(box.x1, 0, 0); walls[2].position.set(0, 0, box.z0); walls[3].position.set(0, 0, box.z1);
    const s = key.shadow.camera, cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2, e = Math.hypot(box.x1 - box.x0, box.z1 - box.z0) / 2 + 2;
    key.target.position.set(cx, 0, cz); key.position.set(cx - 8, 16, cz - 7); key.target.updateMatrixWorld();
    s.left = s.bottom = -e; s.right = s.top = e; s.updateProjectionMatrix();
    feel.n = 0;  // the stage may have moved with it: not the page moving
    return was || at;
  }
  function view() {  // a track stage: the camera over the part of the track the stage now shows; true when it moved
    if (!track) return false;
    const tr = track.getBoundingClientRect(), cr = area.getBoundingClientRect();
    const cx = (cr.left + cr.width / 2 - tr.left - tr.width / 2) / kpx, cz = (cr.top + cr.height / 2 - tr.top) / kpx;
    if (camAt && Math.abs(camAt.x - cx) + Math.abs(camAt.z - cz) < 1e-4) return false;
    camAt = { x: cx, z: cz };
    cam.position.set(cx, dist * Math.cos(0.10), cz + dist * Math.sin(0.10)); cam.lookAt(cx, 0, cz); cam.updateMatrixWorld();
    return true;
  }

  const rnd = Math.random;
  // Where the coins land, in scene units: o.aim (screen px, from the page, with the jitter jit) or o.pile (relative to the
  // stage's middle, the outline centered on it)
  let jit = null;
  function landing() {
    if (o.aim) return o.aim(jit).map(p => { const g = toGround(p.px, p.py); return { ...p, x: clamp(g.x, box.x0 + R, box.x1 - R), z: clamp(g.z, box.z0 + R, box.z1 - R) }; });
    const pts = o.pile(rnd), xs = pts.map(p => p.x), zs = pts.map(p => p.z);  // center the pile's outline, not a coin
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    return pts.map(p => ({ ...p, x: clamp(at.x + p.x - cx, box.x0 + R, box.x1 - R), z: clamp(at.z + p.z - cz, box.z0 + R, box.z1 - R) }));
  }
  const toGround = (px, py) => {  // a page point on the ground: a track stage's scene is the page itself, scaled (as its slot is placed);
    if (track) { const tr = track.getBoundingClientRect(); return { x: (px - tr.left - tr.width / 2) / kpx, z: (py - tr.top) / kpx }; }  // a fixed stage's is seen through the camera
    const cr = area.getBoundingClientRect(); return onGround((px - cr.left) / cr.width * 2 - 1, 1 - (py - cr.top) / cr.height * 2, T / 2);
  };
  // Laying the coins (D, Oct. 16: no drop, no click into place; they are simply there, looking settled, when the page
  // opens): each placed just above its spot, upright, and settled before the next, in order, so a leaning coin comes to
  // rest on its base, all before anything is drawn. A resize lays them again at their new spots.
  function lay(pts) {
    coins.forEach(c => { if (c.body.world) world.removeBody(c.body); });
    coins.forEach((c, i) => {
      const b = c.body, p = pts[i];
      b.position.set(p.x, T / 2 + p.y, p.z); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0); b.quaternion.setFromEuler(0, p.yaw, 0);
      world.addBody(b); b.wakeUp(); c.mesh.visible = true;
      for (let k = 0; k < 600 && awake(); k++) world.step(1 / 120);
    });
    rest();
  }
  function drop() {
    if (!frame()) { waiting = false; return; }  // not laid out yet: the next resize or view lays them
    jit = o.aim ? coins.map(() => ({ dx: 0, dy: 0, yaw: 0 })) : null;  // the composition as designed, the same every visit (its stills match)
    lay(landing());
    dropped = true;
    sync(); draw(); start();
    canvas.classList.add('is-on'); if (o.shown) o.shown();
  }
  // A resize, a turn of the phone or a list opening: frame again and move the pile with its slot, settled
  function reframe() {
    const was = frame(); if (!was || !dropped) return;
    release();
    if (o.aim) { lay(landing()); sync(); draw(); return; }
    const dx = at.x - was.x, dz = at.z - was.z; let moved = false;
    coins.forEach(({ body: b }) => {
      const x = clamp(b.position.x + dx, box.x0 + R, box.x1 - R), z = clamp(b.position.z + dz, box.z0 + R, box.z1 - R);
      if (Math.abs(x - b.position.x - dx) + Math.abs(z - b.position.z - dz) > 1e-6) moved = true;
      b.position.set(x, b.position.y, z); b.aabbNeedsUpdate = true;
    });
    if (moved) { coins.forEach(c => c.body.wakeUp()); settle(); }
    sync(); draw();
  }

  // The page carries the coins (D, Oct. 15): when the page moves under them (a scroll; About, the Journal or a project
  // sliding the cover back into view), they feel it as coins on a moving tray do: they lag as it sets off, slide on as
  // it stops, and settle. The page's acceleration, read from the stage's place on screen each frame, is felt as a pull
  // across the ground on top of gravity (CARRY of it, at most PULL, in scene units). cannon-es grants each contact point
  // its own friction, and a coin lying flat touches the paper at up to 28, so it grips far harder than its 0.42 says
  // and would never slide, then fly once tipped. While the page moves, friction is reckoned from a gravity of SLIP
  // instead (world.frictionGravity), which lets a flat coin slide about as freely as friction 0.25 would; the full grip
  // comes back once the page is still. Not with reduced motion.
  const CARRY = 0.35, PULL = 30, SLIP = new C.Vec3(0, 0.06, 0);  // measured: a flat coin then slides like friction 0.25
  const feel = { n: 0, x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, until: 0, boot: 0 };
  function carry(t, s) {
    if (reduce || !s) return false;
    const r = (track || area).getBoundingClientRect();  // the page itself: a track stage's window stays put
    if (feel.n === 0) { feel.x = r.left; feel.y = r.top; feel.n = 1; feel.ax = feel.ay = 0; return false; }
    const vx = (r.left - feel.x) / s, vy = (r.top - feel.y) / s; feel.x = r.left; feel.y = r.top;
    const moving = Math.abs(vx) + Math.abs(vy) > 20;
    if (moving) feel.until = t + 250;
    if (feel.n === 1) { feel.vx = vx; feel.vy = vy; feel.n = 2; return moving; }
    feel.ax += ((vx - feel.vx) / s - feel.ax) * 0.5; feel.ay += ((vy - feel.vy) / s - feel.ay) * 0.5; feel.vx = vx; feel.vy = vy;
    const gx = clamp(-feel.ax / kpx * CARRY, -PULL, PULL), gz = clamp(-feel.ay / kpx * CARRY, -PULL, PULL);
    world.gravity.set(gx, -30, gz);  // screen right is the scene's +x, screen down its +z
    const pulled = Math.hypot(gx, gz) > 2;
    if (pulled) coins.forEach(c => c.body.wakeUp());
    world.frictionGravity = pulled || moving ? SLIP : undefined;
    return moving;
  }
  const stir = () => { if (dropped && (!reduce || track)) { feel.until = Math.max(feel.until, performance.now() + 250); start(); } };  // a track stage pans on every scroll
  addEventListener('scroll', stir, { passive: true, capture: true });
  document.addEventListener('transitionstart', e => { if (e.target.contains && e.target.contains(area)) stir(); }, true);  // a panel sliding

  // Render only while a coin is awake or held, or the page is carrying them; pause while the stage is out of sight
  // (scrolled away, a panel or a project open over it, the tab hidden)
  let raf = 0, last = 0, seen = false, quiet = 0, waiting = false, spotSeen = !o.dropWhen;
  const visible = () => seen && !area.closest('[inert]') && !document.hidden;
  function start() {  // the drop waits for its spot to be on screen (o.dropWhen), however the visitor gets there
    if (!dropped) { if (!waiting) { waiting = true; drop(); } return; }  // laid at once, seen or not: it's there when it comes into view
    if (!raf && visible()) { last = performance.now(); feel.n = 0; feel.boot = 4; raf = requestAnimationFrame(tick); }  // a few frames to tell whether the page is moving
  }
  function tick(t) {
    raf = 0;
    if (!visible()) { release(); world.gravity.set(0, -30, 0); world.frictionGravity = undefined; return; }
    const raw = (t - last) / 1000, dt = clamp(raw, 0, 0.05); last = t;
    const carried = carry(t, raw) || t < feel.until || feel.boot-- > 0, was = joint || awake();
    if (joint) { const p = grip.position; p.x += (aim.x - p.x) * 0.35; p.y += (aim.y - p.y) * 0.18; p.z += (aim.z - p.z) * 0.35; }
    world.step(1 / 120, dt, 6);
    quiet = !joint && !carried && calm() ? quiet + dt : 0;
    if (quiet > 1) { rest(); quiet = 0; }
    const live = joint || awake(), panned = view();
    if (was || live || panned) { sync(); draw(); }  // and the frame the coins fall asleep, and a track stage's pan
    if (live || carried) raf = requestAnimationFrame(tick);
    else { world.gravity.set(0, -30, 0); world.frictionGravity = undefined; }
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(e => { seen = e[e.length - 1].isIntersecting; start(); }, { threshold: o.threshold || 0 }).observe(track || area);
    if (o.dropWhen) new IntersectionObserver(e => { spotSeen = e[e.length - 1].isIntersecting; start(); }, { threshold: 0.6 }).observe(o.dropWhen);
  } else seen = spotSeen = true;
  inertWatch.push(start);
  document.addEventListener('visibilitychange', start);
  let rs = 0;
  const later = () => { cancelAnimationFrame(rs); rs = requestAnimationFrame(reframe); };
  addEventListener('resize', later);
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(later); ro.observe(area); if (track) ro.observe(track); }  // the track grows and shrinks with the list: its walls follow

  // Picking up: a point constraint hangs the coin from the grabbed point, so it tilts and swings with its weight.
  // A miss does nothing: the words and every link under the stage work as before.
  const grip = new C.Body({ mass: 0 }); grip.collisionFilterGroup = 0; grip.collisionFilterMask = 0; world.addBody(grip);
  const lift = 1.25, aim = new THREE.Vector3(), plane = new THREE.Plane(up, -lift);
  let joint = null, held = null, until = 0, press = null, passing = false;
  function point(e) {
    const cr = area.getBoundingClientRect();
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
    host.classList.remove('coin-held'); until = performance.now() + 400; start();
  }
  // A press on a coin picks it up once the pointer moves (or after a short hold); a quick tap that doesn't move passes
  // through to whatever is under the coin, so a coin lying on See more, a name or a link never blocks it (D, Oct. 15)
  host.addEventListener('pointerdown', e => {
    if (joint || press || e.button !== 0) return;
    let h = hit(e);
    if (!h && e.target.classList && e.target.classList.contains('coin-grip') && dropped && visible()) {  // the grip's edge, past the coin's own: its middle
      const c = coins.find(c => c.grip === e.target); if (c) h = { object: { parent: c.mesh }, point: c.mesh.position.clone() };  // another stage's grip (one stage's host can hold another's) isn't ours
    }
    if (!h) return;
    e.preventDefault();
    try { host.setPointerCapture(e.pointerId); } catch (_) {}
    press = { x: e.clientX, y: e.clientY, h, hold: setTimeout(() => grab(), 200) };
  });
  function grab() {
    if (!press || joint) return;
    const h = press.h; clearTimeout(press.hold); press = null;
    held = coins[h.object.parent.userData.i];
    const p = h.point; grip.position.set(p.x, p.y, p.z);
    joint = new C.PointToPointConstraint(held.body, held.body.pointToLocalFrame(new C.Vec3(p.x, p.y, p.z)), grip, new C.Vec3(0, 0, 0), 60);
    world.addConstraint(joint); held.body.wakeUp(); held.body.linearDamping = 0.35; held.body.angularDamping = 0.55;
    aim.set(p.x, lift, p.z); host.classList.add('coin-held'); start();
  }
  function through(x, y) {  // a tap: the click goes to the link or button under the coin
    grips.style.display = 'none'; const t = document.elementFromPoint(x, y); grips.style.display = '';
    const c = t && t.closest('a, button, summary, label, [role="button"]');
    until = performance.now() + 400;  // the browser's own click from this tap never lands twice
    if (c) { passing = true; c.click(); passing = false; }
  }
  host.addEventListener('pointerup', e => {
    if (press) { clearTimeout(press.hold); press = null; through(e.clientX, e.clientY); } else release();
  });
  host.addEventListener('pointermove', e => {
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 4) grab();
    if (joint) {
      point(e);
      if (ray.ray.intersectPlane(plane, aim)) { aim.x = clamp(aim.x, box.x0 + R, box.x1 - R); aim.z = clamp(aim.z, box.z0 + R, box.z1 - R); }
      return;
    }
  });
  ['pointercancel', 'lostpointercapture'].forEach(n => host.addEventListener(n, () => { if (press) { clearTimeout(press.hold); press = null; } release(); }));
  // On a phone, a touch that starts on a coin drags it (its grip takes no scroll); anywhere else it scrolls as always
  // The click that ends a pick-up never reaches a link under the coin (a tap's own, passed through, does)
  addEventListener('click', e => { if (!passing && performance.now() < until && host.contains(e.target)) { e.preventDefault(); e.stopPropagation(); } }, true);

  start();
}
// About and the project panel open over home by marking what they cover inert: a stage under one pauses
const inertWatch = [];
new MutationObserver(() => inertWatch.forEach(f => f())).observe(document.documentElement, { attributes: true, attributeFilter: ['inert'], subtree: true });

// The cover: loads after the first paint and drops as soon as it can, while the name arrives (D, Oct. 15: an empty slot
// looked odd). Until then the pile's still holds the slot (build.py); it fades out as the coins fade in, and stays if
// 3D can't run. shift: the arrive's lift, so the pile lands where the slot rests.
function cover(slot) {
  const sec = slot.closest('.cover'), inner = sec.querySelector('.cover-inner'), name = sec.querySelector('.name'), nav = sec.querySelector('.cover-nav');
  const shift = () => inner ? new DOMMatrixReadOnly(getComputedStyle(inner).transform).m42 : 0;
  // The five coins' geometry, in screen px: the name's box, its word Opmet, the nav, and d, the coin's diameter
  const geom = () => {
    const cr = sec.getBoundingClientRect(), N = name.getBoundingClientRect(), V = nav.getBoundingClientRect(), S = slot.getBoundingClientRect();
    const rg = document.createRange(); rg.setStart(name.firstChild, 0); rg.setEnd(name.firstChild, 5);
    const k = parseFloat(getComputedStyle(slot).getPropertyValue('--coins-scale')) || 1, dy = shift();
    const rest = r => ({ left: r.left, right: r.right, width: r.width, height: r.height, top: r.top - dy, bottom: r.bottom - dy });  // where the name rests, not where its arrival has it now
    return { cr, N: rest(N), O: rest(rg.getBoundingClientRect()), V: rest(V), d: S.height * 0.56 * k };
  };
  const aim = j => coverSpots(j, geom());
  // The stills hold the cover until each coin lands (and stay if 3D can't run): five pictures at the same spots, each
  // disc as wide as the coin (a still's disc is 0.71 of its frame)
  const flat = slot.getAttribute('data-coins').split(' ').map(() => ({ dx: 0, dy: 0, yaw: 0 }));
  // The stills wait unseen: the coins appear once, settled, in 3D (D, Oct. 16: seamless, no jump from picture to model). They
  // show only if 3D can't run, or hasn't arrived after 2.5 s (a slow connection), and then give way to it.
  const stills = slot.getAttribute('data-stills').split(' ').map(src => { const img = new Image(); img.className = 'coins-still is-waiting'; img.alt = ''; img.src = src; sec.appendChild(img); return img; });
  const showStills = () => stills.forEach(img => img.classList.remove('is-waiting')), slow = setTimeout(showStills, 2500);
  function placeStills() {
    const g = geom(), pts = coverSpots(flat, g), W = g.d / 0.71;
    stills.forEach((img, i) => { if (img.isConnected) Object.assign(img.style, { width: W + 'px', height: W + 'px', left: (pts[i].px - W / 2 - g.cr.left) + 'px', top: (pts[i].py - W / 2 - g.cr.top) + 'px' }); });
  }
  placeStills();
  addEventListener('resize', placeStills);
  afterPaint().then(() => { placeStills(); stage({ host: sec, area: sec, slot, unit: 0.56, scaled: true, aim, shift,
    fail: () => { clearTimeout(slow); showStills(); },
    shown: () => { clearTimeout(slow); slot.classList.add('is-live'); const seen = stills.some(img => !img.classList.contains('is-waiting')); setTimeout(() => stills.forEach(img => img.remove()), seen ? 600 : 0); } }); });  // shown stills give way under the fading-in coins
}

// The cover (D, Oct. 16): five coins around the name, placed from the name's box (N), its word Opmet (O), the nav (V) and
// the cover coin's diameter d, in screen px. The dark basalt hand stands alone, centered above Opmet. The others lean in
// two pairs on a diagonal around the name: the leaf leaning on the eye's left edge, above Osserpse (dropped 0.6 d from the
// eye's center, it rests on its edge); below the nav at the left, the dancer and the cup, close but not touching.
// j: each coin's jitter (up to 0.03 d, 0.25 rad), fixed for the visit. Then each coin must clear the name and the nav by
// 0.12 d, pushed straight out from the name when it doesn't (a pair moves together), and each group stays 16 px inside
// the cover.
function coverSpots(j, g) {
  const { N, O, V, d, cr } = g, gap = 0.12 * d, r = d / 2, foot = Math.max(N.bottom, V.bottom);
  const sp = [
    { px: O.left + O.width / 2, py: N.top - 0.9 * d, y: 0.3 },     // the basalt hand, alone
    { px: N.right - 0.05 * d, py: N.top - 1.2 * d, y: 0.3 },       // eye
    { px: 0, py: 0, y: T + 0.3 },                                  // leaf, on the eye's left edge
    { px: N.left + 0.35 * d, py: foot + 1.0 * d, y: 0.3 },         // dancer
    { px: 0, py: 0, y: 0.3 },                                      // cup, beside the dancer
  ];
  sp[2].px = sp[1].px - 0.6 * d; sp[2].py = sp[1].py;
  sp[4].px = sp[3].px + 1.1 * d; sp[4].py = sp[3].py + 0.22 * d;  // close, not touching (a tenth of a coin), a little lower (D, Oct. 16)
  if (sp[4].py + 0.5 * d + 16 > Math.min(cr.bottom, innerHeight)) {  // a short screen (a phone turned): beside the nav's left end instead
    sp[4].px = V.left - 0.3 * d - 0.5 * d; sp[4].py = (V.top + V.bottom) / 2 + 0.11 * d;
    sp[3].px = sp[4].px - 1.1 * d; sp[3].py = sp[4].py - 0.22 * d;
  }
  sp.forEach((p, i) => { p.px += j[i].dx * d; p.py += j[i].dy * d; p.yaw = j[i].yaw; p.tilt = 0.04; p.spin = 0.4; });
  const hit = (x, y) => [N, V].some(q => Math.hypot(Math.max(q.left - x, 0, x - q.right), Math.max(q.top - y, 0, y - q.bottom)) < r + gap);
  const cx = N.left + N.width / 2, cy = N.top + N.height / 2;
  [[0], [1, 2], [3, 4]].forEach(c => {
    const bx = c.map(i => sp[i].px), by = c.map(i => sp[i].py);
    const ux = bx[0] - cx, uy = by[0] - cy, len = Math.hypot(ux, uy) || 1, nx = ux / len, ny = uy / len;
    let t = 0;
    const blocked = () => c.some((_, k) => hit(bx[k] + nx * t, by[k] + ny * t));
    while (t < 4 * d && blocked()) t += 0.5;
    // the group stays 16 px inside the cover, moved as one so a pair keeps its lean
    const xs = c.map((_, k) => bx[k] + nx * t), ys = c.map((_, k) => by[k] + ny * t);
    const sx = Math.max(0, cr.left + 16 + r - Math.min(...xs)) - Math.max(0, Math.max(...xs) - (cr.right - 16 - r));
    const sy = Math.max(0, cr.top + 16 + r - Math.min(...ys)) - Math.max(0, Math.max(...ys) - (cr.bottom - 16 - r));
    c.forEach((i, k) => { sp[i].px = xs[k] + sx; sp[i].py = ys[k] + sy; });
  });
  return sp;
}

// About (D, Oct. 16): three coins on one stage over the whole page, sharing its physics, so each can be carried anywhere
// on About and they meet: the wave and the alabaster hand in the upper right, above the press, where the rings were (in one
// column, in the room at the top the rings took, at the right), and the cup beside "espresso tempo", all at the cover
// coin's size. The stage is a track over the panel's whole text with a window onto it pinned to the panel (which scrolls
// in itself), as the work list's is. It loads once home has loaded, so the coins are there when About opens.
function about(el) {
  const panel = el.closest('.about-panel'), cupEl = panel.querySelector('.coins-cup');
  const track = document.createElement('div'), area = document.createElement('div');
  track.className = 'coins-track coins-about-track'; track.setAttribute('aria-hidden', 'true'); area.className = 'coins-area';
  track.appendChild(area); el.parentNode.insertBefore(track, el);  // positioned from the panel
  const place = () => {
    pairPlace(el, panel); if (cupEl) cupPlace(cupEl, panel);
    const g = el.parentNode, low = cupEl ? cupEl.offsetTop + cupEl.offsetHeight : 0;
    track.style.height = Math.max(panel.clientHeight, g.offsetTop + g.offsetHeight, low + 24) + 'px';
  };
  place();
  const aim = j => {
    const a = el.getBoundingClientRect(), d = a.width, cx = a.left + d / 2, cy = a.top + d / 2;
    const c = (cupEl || el).getBoundingClientRect();
    return [{ px: cx - 0.55 * d, py: cy - 0.1 * d }, { px: cx + 0.55 * d, py: cy + 0.1 * d }, { px: c.left + c.width / 2, py: c.top + c.height / 2 }]
      .map((p, i) => ({ ...p, px: p.px + j[i].dx * d, py: p.py + j[i].dy * d, yaw: j[i].yaw, y: 0.3, tilt: 0, spin: 0 }));
  };
  const go = () => stage({ host: panel, area, track, slot: el, unit: 1, aim, walls: 0.995, place });
  const idle = window.requestIdleCallback || (f => setTimeout(f, 200));
  if (document.readyState === 'complete') afterPaint().then(() => idle(go)); else addEventListener('load', () => afterPaint().then(() => idle(go)), { once: true });
}
// The panel's text, in its own coordinates (it scrolls in itself): one box per line of the paragraphs, and the press's rows
function aboutText(panel) {
  const pr = panel.getBoundingClientRect(), y0 = pr.top - panel.scrollTop;
  const rel = r => ({ l: r.left - pr.left, t: r.top - y0, r: r.right - pr.left, b: r.bottom - y0 });
  const lines = e => {  // each line's own box: a glyph box runs past its line (ascenders, descenders), so it is trimmed to the line height
    const rg = document.createRange(); rg.selectNodeContents(e); const em = parseFloat(getComputedStyle(e).fontSize) || 0;  // to the type's own size, where its ink is
    return [...rg.getClientRects()].map(r => { const cut = em && r.height > em ? (r.height - em) / 2 : 0; return { left: r.left, right: r.right, top: r.top + cut, bottom: r.bottom - cut }; });
  };
  const body = [...panel.querySelectorAll('.about-body p, .title-row')].flatMap(lines).map(rel).filter(b => b.r > b.l && b.b > b.t);
  const press = [...panel.querySelectorAll('.about-press li, .about-press p')].map(e => rel(e.getBoundingClientRect())).filter(b => b.r > b.l && b.b > b.t);
  return { pr, rel, body, press, all: body.concat(press) };
}
const clears = (all, x, y, rad, gap) => all.every(b => Math.hypot(Math.max(b.l - x, 0, x - b.r), Math.max(b.t - y, 0, y - b.b)) >= rad + gap);
function pairPlace(el, panel) {
  el.style.width = el.style.height = ''; const d = el.offsetWidth, gap = 0.12 * d;
  const { body, press } = aboutText(panel); if (!body.length) return;
  const bodyR = Math.max(...body.map(b => b.r)), top = Math.min(...body.map(b => b.t));
  let cx, cy;
  if (press.length && Math.min(...press.map(b => b.l)) > bodyR) {  // two columns: over the press, its bottom coin 0.12 d above it
    const pl = Math.min(...press.map(b => b.l)), pr = Math.max(...press.map(b => b.r)), pt = Math.min(...press.map(b => b.t));
    cx = (pl + pr) / 2; cy = pt - gap - 0.62 * d;
  } else {  // one column: in the room above Home, at the right of the text
    cx = bodyR - 1.05 * d; cy = Math.max(top / 2, 0.75 * d);
  }
  el.style.left = (cx - d / 2) + 'px'; el.style.top = (cy - d / 2) + 'px';
}
function cupPlace(el, panel) {  // the nearest place beside the line "espresso tempo." ends, where a whole coin clears the text
  el.style.width = el.style.height = ''; const d = el.offsetWidth, gap = 0.08 * d;
  const link = [...panel.querySelectorAll('.about-body a')].find(a => /espresso tempo/i.test(a.textContent)); if (!link) return;
  const T2 = aboutText(panel), p = link.closest('p');
  const lr = T2.rel([...link.getClientRects()].pop());
  const own = (() => { const rg = document.createRange(); rg.selectNodeContents(p); return [...rg.getClientRects()].map(T2.rel); })();
  const right = Math.max(...own.filter(b => (b.t + b.b) / 2 > lr.t && (b.t + b.b) / 2 < lr.b).map(b => b.r));  // glyph boxes overlap the lines around: by their middles
  const x0 = right + 0.3 * d + d / 2, y0 = (lr.t + lr.b) / 2, xMax = T2.pr.width - 16 - d / 2, step = d / 12;
  let best = null;
  for (let dy = 0; dy <= 0.6 * d && !best; dy += 1) for (const y of [y0 + dy, y0 - dy]) {  // right after the words, level with them (within 0.6 d), finely
    if (!best && x0 <= xMax && clears(T2.all, x0, y, d / 2, gap)) best = { x: x0, y, cost: 0 };
  }
  if (!best) for (let y = y0 - d; y <= y0 + 12 * d; y += step) for (let x = Math.min(x0, xMax); x <= xMax; x += step) {
    const cost = Math.hypot(x - x0, (y - y0) * 1.6); if (best && cost >= best.cost) continue;  // beside the line first: up or down costs more than along
    if (clears(T2.all, x, y, d / 2, gap)) best = { x, y, cost };
  }
  if (!best) { const low = Math.max(...T2.all.map(b => b.b)); best = { x: Math.max(d / 2 + 16, Math.min(x0, xMax)), y: low + gap + d / 2 }; }  // below everything
  el.style.left = (best.x - d / 2) + 'px'; el.style.top = (best.y - d / 2) + 'px';
}

// The work list's coin (D, Oct. 15): a spot (build.py coins_spot) marks where and how big, right next to the list's last
// name; the stage is a track over the list's part of the page with a window onto it pinned to the browser window, so the
// coin can be seen, picked up and thrown wherever it is on screen, and dragged anywhere in that part of the page. It
// loads as the list nears the screen and drops once its spot is on screen, however the visitor gets there (Work, a
// scroll, a link to /#work).
function spot(el) {
  const host = el.parentElement, track = document.createElement('div'), area = document.createElement('div');
  track.className = 'coins-track'; track.setAttribute('aria-hidden', 'true'); area.className = 'coins-area';
  track.appendChild(area); host.insertBefore(track, el);
  const list = document.querySelector(el.getAttribute('data-beside')), place = list ? () => beside(el, host, list, track) : null;
  if (place) place();
  const img = el.querySelector('.coins-still'), slow = img && setTimeout(() => { img.hidden = false; }, 2500);  // its still only if 3D is slow or can't run
  const go = () => stage({ host, area, track, slot: el, unit: 1, pile: onePile, walls: 0.995, place, dropWhen: el, ready: () => atRest(track),
    shown: () => { clearTimeout(slow); if (img) img.remove(); }, fail: () => { clearTimeout(slow); if (img) img.hidden = false; } });
  if (!('IntersectionObserver' in window)) return afterPaint().then(go);
  const io = new IntersectionObserver(e => { if (e.some(x => x.isIntersecting)) { io.disconnect(); afterPaint().then(go); } }, { rootMargin: '50% 0px' });
  io.observe(track);
}

// The page at rest: the coin drops once the scroll that brought its spot into view (Work glides there) has stopped,
// so the page's motion doesn't push it off its spot as it lands
function atRest(el) {
  return new Promise(ok => { let y = null, calm = 0; (function f() { const t = el.getBoundingClientRect().top; calm = t === y ? calm + 1 : 0; y = t; if (calm >= 8) ok(); else requestAnimationFrame(f); })(); });
}

// Right next to the list's last name, at its left, the coin's bottom on the name's (D, Oct. 15); on a phone, with no
// margin, just under it. Placed on load and when the width changes, never as the list opens or closes: the coin stays
// where it is (D), and rows that come under it stay clickable through it (a tap passes through). The track runs from
// the top of the list's section to the bottom of the page.
function beside(el, host, list, track) {
  const rows = [...list.children].filter(r => r.getClientRects().length), last = rows[rows.length - 1]; if (!last) return;
  const name = last.querySelector(':scope > a, :scope > .plain') || last, col = list.closest('section') || list;
  const at = n => { let x = 0, y = 0; for (let e = n; e && e !== host; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; if (!host.contains(e.offsetParent)) break; } return [x, y]; };
  const [nx, ny] = at(name), left = nx + (parseFloat(list.style.translate) || 0), bottom = ny + name.offsetHeight;
  const d = el.offsetWidth, gap = 24, x = left - gap - d, room = x + host.getBoundingClientRect().left >= 16;
  el.style.left = (room ? x : left) + 'px'; el.style.top = (room ? bottom - d : bottom + gap) + 'px'; el.style.bottom = 'auto';
  track.style.top = at(col)[1] + 'px';
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
  try { L = await three(); r = renderer(L); mesh = (await coin(el.getAttribute('data-coin'))).clone(); }
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
document.querySelectorAll('.coins-spot[data-coins]:not(.coins-about)').forEach(spot);
document.querySelectorAll('.coins-about[data-coins]').forEach(about);  // one stage for About's three coins
headers(document);
// Projects open in a panel on home: their nameplates arrive later
new MutationObserver(ms => {
  ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) headers(n); }));
  if (live.size) prune();
}).observe(document.body, { childList: true, subtree: true });
