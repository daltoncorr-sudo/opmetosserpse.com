/* wine-bottle.js

   A bottle of the HollyShorts 22 wine you can turn in your hands. Drag (or
   touch, or use the arrow keys) to rotate; it turns slowly on its own until
   you take hold of it.

   The bottle is procedural: one LatheGeometry profile (punt, body, shoulder,
   neck, lip), dark glass with a clearcoat and a soft-box environment so it
   has something to reflect, a foil cap, and the label as a curved slice of a
   cylinder just proud of the glass, the true label artwork from the winery's
   proof on the front, its back label on the far side. The bottle floats, tilted,
   above a soft shadow that stays on the floor.

   HERE: nothing loads until the stage nears the viewport (js/three-common.js
   adds a pinned cdnjs three.js at that moment, so pages without a bottle never
   pay for it). If WebGL or the script fails, or the label picture will not
   load, the flat picture already in the markup simply stays. With
   prefers-reduced-motion there is no idle spin and no inertia: it draws only
   when you move it. */
(function () {
'use strict';

var stage = document.querySelector('.wine-stage');
if (!stage) return;
var canvasHost = stage.querySelector('.wine-canvas');
var frontSrc = stage.getAttribute('data-front');
var backSrc = stage.getAttribute('data-back');
var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

function build(THREE) {
  var w = canvasHost.clientWidth || 400, h = canvasHost.clientHeight || 500;
  var renderer = DCThree.renderer(THREE, canvasHost);
  var scene = new THREE.Scene();
  var pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromEquirectangular(DCThree.env(THREE)).texture;

  var camera = new THREE.PerspectiveCamera(28, w / h, 0.1, 100);
  var key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-6, 10, 12);
  scene.add(key);
  var rim = new THREE.DirectionalLight(0xbfd8ff, 0.9);
  rim.position.set(7, 3, -8);
  scene.add(rim);

  /* what floats: the bottle, tilted, on a group that bobs and drifts */
  var floater = new THREE.Group();
  scene.add(floater);
  var bottle = new THREE.Group();
  floater.add(bottle);

  /* profile: [radius, height], punt first. Straight body to 5.2, a smooth
     shoulder to the neck, then the lip. */
  var pts = [];
  var P = function (x, y) { pts.push(new THREE.Vector2(x, y)); };
  P(0, 0.42); P(0.35, 0.4); P(0.62, 0.3); P(0.78, 0.12); P(0.9, 0.02); P(0.98, 0.0);
  P(1.0, 0.12); P(1.0, 5.1);
  var sh = new THREE.CubicBezierCurve(new THREE.Vector2(1.0, 5.1), new THREE.Vector2(1.0, 6.3), new THREE.Vector2(0.4, 6.1), new THREE.Vector2(0.36, 7.4)).getPoints(22);
  sh.shift(); sh.forEach(function (p) { pts.push(p); });
  P(0.35, 8.6); P(0.4, 8.7); P(0.43, 8.85); P(0.43, 9.05); P(0.36, 9.1);
  var glass = new THREE.Mesh(
    new THREE.LatheGeometry(pts, 96),
    new THREE.MeshPhysicalMaterial({ color: 0x0c1410, metalness: 0.15, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.5 })
  );
  bottle.add(glass);

  /* foil: a shade wider than the lip, ending in a slightly flared rim */
  var foilPts = [[0, 9.34], [0.44, 9.34], [0.47, 9.28], [0.47, 8.0], [0.5, 7.86], [0.44, 7.8]].map(function (a) { return new THREE.Vector2(a[0], a[1]); });
  bottle.add(new THREE.Mesh(
    new THREE.LatheGeometry(foilPts, 48),
    new THREE.MeshStandardMaterial({ color: 0x1f6f86, metalness: 0.9, roughness: 0.28, envMapIntensity: 1.3 })
  ));

  /* the labels are the real ones (the winery's proof): the poster on the
     front, the text label on the back, each a slice of cylinder just off the
     glass, cut to the artwork's own proportions */
  var R = 1.008;
  function labelMesh(src, height, aspect, centre, y, cb) {
    var arc = height * aspect / R;
    var geo = new THREE.CylinderGeometry(R, R, height, 64, 1, true, centre - arc / 2, arc);
    var tex = new THREE.TextureLoader().load(src, function () { want(); }, undefined, function () { stage.classList.add('is-flat'); });
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    var m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0, envMapIntensity: 0.35 }));
    m.position.y = y;
    bottle.add(m);
  }
  labelMesh(frontSrc, 3.5, 1000 / 1468, 0, 2.7);
  labelMesh(backSrc, 2.8, 900 / 1353, Math.PI, 2.55);

  /* centre the bottle on its own middle so it tilts about that */
  bottle.position.y = -4.6;
  floater.rotation.z = -0.36;      // leaning, not standing
  floater.rotation.x = 0.12;

  /* the shadow: a soft blob on an invisible floor, which stays put while the
     bottle bobs above it, so it swells and pales as the bottle comes down and
     goes. Long and thin, since the bottle lies at an angle. */
  var sc = document.createElement('canvas'); sc.width = sc.height = 128;
  var sg = sc.getContext('2d');
  var gr = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(.5, 'rgba(0,0,0,.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  sg.fillStyle = gr; sg.fillRect(0, 0, 128, 128);
  var shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -4.75;
  scene.add(shadow);

  var rotY = -0.5, vel = 0, dragging = false, lastX = 0, lastT = 0, visible = true, raf = 0, idleAt = 0, t0 = performance.now();

  function draw(now) {
    var bob = reduce.matches ? 0 : Math.sin((now - t0) / 1700);
    floater.position.y = bob * 0.22;
    floater.position.x = reduce.matches ? 0 : Math.sin((now - t0) / 2900) * 0.12;
    floater.rotation.z = -0.36 + (reduce.matches ? 0 : Math.sin((now - t0) / 2300) * 0.03);
    bottle.rotation.y = rotY;
    var lift = (bob + 1) / 2;                       // 0 low, 1 high
    shadow.scale.set(6.4 - lift * 0.9, 2.6 - lift * 0.4, 1);
    shadow.material.opacity = 0.85 - lift * 0.3;
    shadow.position.x = -0.5 + floater.position.x * 0.4;
    renderer.render(scene, camera);
  }
  function loop(t) {
    raf = 0;
    if (!visible || document.hidden) return;
    var dt = Math.min(50, t - (lastT || t)); lastT = t;
    if (!dragging) {
      if (!reduce.matches) {
        rotY += vel * dt * 0.06;
        vel *= Math.pow(0.94, dt / 16);
        if (Math.abs(vel) < 0.002) vel = 0;
        if (t > idleAt) rotY += dt * 0.00045;
      }
    }
    draw(t);
    if (!reduce.matches || dragging || vel) raf = requestAnimationFrame(loop);
  }
  function want() { if (!raf && visible) { lastT = 0; raf = requestAnimationFrame(loop); } }

  function down(e) {
    dragging = true; lastX = e.clientX; vel = 0;
    stage.classList.add('is-dragging');
    try { stage.setPointerCapture(e.pointerId); } catch (x) {}
    want();
  }
  function move(e) {
    if (!dragging) return;
    var dx = e.clientX - lastX; lastX = e.clientX;
    var d = dx * 0.012;
    rotY += d; vel = d * 0.9 + vel * 0.1;
    want();
  }
  function up() {
    if (!dragging) return;
    dragging = false; stage.classList.remove('is-dragging');
    idleAt = performance.now() + 2500;
    want();
  }
  stage.addEventListener('pointerdown', down);
  stage.addEventListener('pointermove', move);
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('keydown', function (e) {
    var k = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (!k) return;
    e.preventDefault(); e.stopPropagation(); rotY += k * 0.25; idleAt = performance.now() + 2500; want();
  });

  function size() {
    var W = canvasHost.clientWidth, H = canvasHost.clientHeight;
    if (!W || !H) return;
    renderer.setSize(W, H); camera.aspect = W / H;
    // the tilted bottle, about 10.5 tall by 6 across with its lean, fills the stage
    var f = Math.tan(camera.fov * Math.PI / 360);
    var d = Math.max(9.7 / 2 / f, 6.0 / 2 / (camera.aspect * f));
    camera.position.set(0, 0, d); camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix(); want();
  }
  new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) want(); }).observe(stage);
  document.addEventListener('visibilitychange', want);
  reduce.addEventListener && reduce.addEventListener('change', want);
  window.addEventListener('resize', size);

  canvasHost.appendChild(renderer.domElement);
  size();
  stage.classList.add('is-live');
  draw(performance.now()); want();
}

DCThree.lazy(stage, function (THREE) {
  if (!THREE) { stage.classList.add('is-flat'); return; }
  build(THREE);
});
})();
