/* phones-3d.js

   The HollyShorts 22 Instagram profile on one phone. The feed scrolls slowly
   on the screen: the profile, the grid, then single posts, and round again.
   Drag to rotate the phone.

   The feed is one tall canvas drawn from the site's own post images
   (images/design/hollyshorts-22/social/), used as a texture that slides up
   behind a fixed status bar, title bar and tab bar. No follower counts, no
   likes, no captions: only the posts.

   HERE: three.js arrives only when the stage nears the viewport (see
   js/three-common.js). Without WebGL the flat picture in the markup stays.
   With prefers-reduced-motion the feed does not scroll and the phone does not
   sway. Arrow keys are stopped here so they turn the phone, not the page's
   project slides. */
(function () {
'use strict';
var stage = document.querySelector('.phones-stage');
if (!stage) return;
var host = stage.querySelector('.phones-canvas');
var base = stage.getAttribute('data-base');
var grid = stage.getAttribute('data-grid').split('|');
var posts = stage.getAttribute('data-posts').split('|');
var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

var PW = 1, PH = 2.06, PD = 0.09, PR = 0.16, BEZ = 0.03;
var SW = 600, TOP = 170, BAR = 104;   // screen width in canvas px, the fixed bars at top and bottom
var FONT = '-apple-system, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
var SPEED = 42;   // feed px per second

function imgLoad(src) {
  return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src; });
}
function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function cover(g, img, x, y, w, h) {
  if (!img) { g.fillStyle = '#ddd'; g.fillRect(x, y, w, h); return; }
  var s = Math.max(w / img.width, h / img.height), iw = w / s, ih = h / s;
  g.drawImage(img, (img.width - iw) / 2, (img.height - ih) / 2, iw, ih, x, y, w, h);
}
function avatar(g, img, cx, cy, r) {
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.clip();
  g.fillStyle = '#e5372f'; g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  if (img) { var s = r * 2 * 1.02; g.globalCompositeOperation = 'screen'; g.drawImage(img, cx - s / 2, cy - s / 2, s, s); }
  g.restore();
  g.strokeStyle = '#dbdbdb'; g.lineWidth = 2.5; g.beginPath(); g.arc(cx, cy, r + 3, 0, 7); g.stroke();
}
function icons(g, y) {   // heart, comment, share, bookmark: outlines only
  g.strokeStyle = '#111'; g.lineWidth = 3.6; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(44, y + 14); g.bezierCurveTo(10, y - 14, 32, y - 30, 44, y - 15); g.bezierCurveTo(56, y - 30, 78, y - 14, 44, y + 14); g.stroke();
  g.beginPath(); g.arc(118, y - 2, 16, 0, 7); g.stroke();
  g.beginPath(); g.moveTo(168, y + 12); g.lineTo(206, y - 2); g.lineTo(168, y - 16); g.lineTo(172, y - 2); g.closePath(); g.stroke();
  g.beginPath(); g.moveTo(SW - 58, y - 16); g.lineTo(SW - 32, y - 16); g.lineTo(SW - 32, y + 16); g.lineTo(SW - 45, y + 6); g.lineTo(SW - 58, y + 16); g.closePath(); g.stroke();
}

/* the feed, top to bottom: profile, grid, posts */
function feed(gridImgs, postImgs, av) {
  var tw = (SW - 4) / 3, th = tw * 1.25, rows = Math.ceil(gridImgs.length / 3);
  var head = 470, gridH = rows * (th + 2), postH = 84 + SW * 1.25 + 92;
  var H = TOP + head + gridH + 40 + postImgs.length * postH + BAR;
  var c = document.createElement('canvas'); c.width = SW; c.height = Math.round(H);
  var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, SW, H);
  var y = TOP + 16;
  avatar(g, av, 96, y + 70, 64);
  g.fillStyle = '#111'; g.textAlign = 'left'; g.font = '700 30px ' + FONT; g.fillText('HollyShorts Film Festival', 190, y + 62);
  g.font = '400 23px ' + FONT; g.fillStyle = '#737373'; g.fillText('Film festival', 190, y + 96);
  g.fillStyle = '#111'; g.font = '400 24px ' + FONT;
  ['22nd Annual Oscar®-Qualifying', 'TCL Chinese Theatres, Hollywood', 'August 13 to 23, 2026'].forEach(function (t, i) { g.fillText(t, 36, y + 196 + i * 33); });
  rr(g, 36, y + 312, 258, 54, 12); g.fillStyle = '#0095f6'; g.fill();
  rr(g, 306, y + 312, 258, 54, 12); g.fillStyle = '#efefef'; g.fill();
  g.font = '600 23px ' + FONT; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('Follow', 165, y + 347); g.fillStyle = '#111'; g.fillText('Message', 435, y + 347);
  y = TOP + head - 60;
  g.fillStyle = '#111'; g.fillRect(0, y + 56, SW / 2, 2.5); g.fillStyle = '#dbdbdb'; g.fillRect(SW / 2, y + 57, SW / 2, 1);
  for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++) g.fillRect(SW / 4 - 17 + a * 12, y + 14 + b * 12, 10, 10);
  y = TOP + head;
  gridImgs.forEach(function (im, i) { cover(g, im, (i % 3) * (tw + 2), y + ((i / 3) | 0) * (th + 2), tw, th); });
  y += gridH + 40;
  postImgs.forEach(function (im) {
    avatar(g, av, 50, y + 40, 24);
    g.fillStyle = '#111'; g.textAlign = 'left'; g.font = '600 23px ' + FONT; g.fillText('hollyshorts', 90, y + 48);
    g.textAlign = 'right'; g.font = '700 28px ' + FONT; g.fillText('···', SW - 30, y + 46);
    y += 84; cover(g, im, 0, y, SW, SW * 1.25); y += SW * 1.25;
    icons(g, y + 44); y += 92;
  });
  return c;
}

/* what stays put: the status bar, the handle, the tab bar */
function bars(SH, av) {
  var c = document.createElement('canvas'); c.width = SW; c.height = SH;
  var g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, SW, TOP);
  g.fillStyle = '#111'; g.font = '600 24px ' + FONT; g.textAlign = 'left'; g.fillText('9:41', 58, 58);
  g.fillStyle = '#000'; rr(g, SW / 2 - 78, 26, 156, 46, 23); g.fill();
  g.fillStyle = '#111'; g.fillRect(SW - 152, 46, 6, 11); g.fillRect(SW - 141, 41, 6, 16); g.fillRect(SW - 130, 36, 6, 21);
  rr(g, SW - 104, 38, 46, 20, 6); g.fill();
  g.font = '700 30px ' + FONT; g.fillText('hollyshorts', 30, 136);
  g.fillStyle = '#dbdbdb'; g.fillRect(0, TOP - 1, SW, 1);
  var y = SH - BAR;
  g.fillStyle = '#fff'; g.fillRect(0, y, SW, BAR); g.fillStyle = '#dbdbdb'; g.fillRect(0, y, SW, 1);
  g.strokeStyle = '#111'; g.lineWidth = 3.6; g.lineJoin = 'round';
  var xs = [80, 190, 300, 410, 520], cy = y + 42;
  g.beginPath(); g.moveTo(xs[0] - 16, cy + 2); g.lineTo(xs[0], cy - 15); g.lineTo(xs[0] + 16, cy + 2); g.lineTo(xs[0] + 16, cy + 17); g.lineTo(xs[0] - 16, cy + 17); g.closePath(); g.stroke();
  g.beginPath(); g.arc(xs[1] - 2, cy - 2, 12, 0, 7); g.moveTo(xs[1] + 7, cy + 7); g.lineTo(xs[1] + 17, cy + 17); g.stroke();
  rr(g, xs[2] - 16, cy - 16, 32, 32, 8); g.stroke(); g.beginPath(); g.moveTo(xs[2] - 7, cy); g.lineTo(xs[2] + 7, cy); g.moveTo(xs[2], cy - 7); g.lineTo(xs[2], cy + 7); g.stroke();
  rr(g, xs[3] - 16, cy - 16, 32, 32, 8); g.stroke(); g.beginPath(); g.moveTo(xs[3] - 4, cy - 7); g.lineTo(xs[3] + 7, cy); g.lineTo(xs[3] - 4, cy + 7); g.closePath(); g.stroke();
  avatar(g, av, xs[4], cy, 15);
  g.fillStyle = '#111'; rr(g, SW / 2 - 70, SH - 20, 140, 6, 3); g.fill();
  return c;
}

function shape(THREE, w, h, r, inset) {
  var s = new THREE.Shape(), x = -w / 2 + inset, y = -h / 2 + inset; w -= 2 * inset; h -= 2 * inset; r = Math.max(0.01, r - inset);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}
function flatUV(THREE, geo) {
  geo.computeBoundingBox();
  var b = geo.boundingBox, p = geo.attributes.position, uv = [];
  for (var i = 0; i < p.count; i++) uv.push((p.getX(i) - b.min.x) / (b.max.x - b.min.x), (p.getY(i) - b.min.y) / (b.max.y - b.min.y));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}

function build(THREE) {
  var renderer = DCThree.renderer(THREE, host);
  var scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromEquirectangular(DCThree.env(THREE)).texture;
  var camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
  var key = new THREE.DirectionalLight(0xffffff, 0.8); key.position.set(-3, 5, 8); scene.add(key);
  var aniso = renderer.capabilities.getMaxAnisotropy();

  return Promise.all(grid.concat(posts).map(function (n) { return imgLoad(base + n + '.webp'); }).concat([imgLoad(base + '../logo-22-white-1200.webp')])).then(function (all) {
    var gi = all.slice(0, grid.length), pi = all.slice(grid.length, grid.length + posts.length), av = all[all.length - 1];
    var bodyMat = new THREE.MeshStandardMaterial({ color: 0x8b8a85, metalness: 1, roughness: 0.32, envMapIntensity: 1.2 });
    var lensMat = new THREE.MeshStandardMaterial({ color: 0x08090c, metalness: 0.4, roughness: 0.1, envMapIntensity: 1.6 });
    var phone = new THREE.Group(), pivot = new THREE.Group(); pivot.add(phone); scene.add(pivot);

    var body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape(THREE, PW, PH, PR, 0.02), { depth: PD, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 4, curveSegments: 24 }), bodyMat);
    body.position.z = -PD / 2; phone.add(body);
    // black glass, then the screen inside its bezel
    var glassGeo = new THREE.ShapeGeometry(shape(THREE, PW, PH, PR, 0.028), 24);
    var front = new THREE.Mesh(glassGeo, new THREE.MeshBasicMaterial({ color: 0x000000 }));
    front.position.z = PD / 2 + 0.0402; phone.add(front);
    var scrGeo = flatUV(THREE, new THREE.ShapeGeometry(shape(THREE, PW, PH, PR, 0.028 + BEZ), 24));
    var sw = PW - 2 * (0.028 + BEZ), sh = PH - 2 * (0.028 + BEZ), SH = Math.round(SW * sh / sw);

    var fc = feed(gi, pi, av), ft = new THREE.CanvasTexture(fc);
    ft.encoding = THREE.sRGBEncoding; ft.anisotropy = aniso; ft.wrapT = THREE.RepeatWrapping;
    ft.repeat.set(1, SH / fc.height);
    var feedMesh = new THREE.Mesh(scrGeo, new THREE.MeshBasicMaterial({ map: ft, toneMapped: false }));
    feedMesh.position.z = PD / 2 + 0.0405; phone.add(feedMesh);
    var bt = new THREE.CanvasTexture(bars(SH, av)); bt.encoding = THREE.sRGBEncoding; bt.anisotropy = aniso;
    var barMesh = new THREE.Mesh(scrGeo, new THREE.MeshBasicMaterial({ map: bt, transparent: true, toneMapped: false }));
    barMesh.position.z = PD / 2 + 0.0408; phone.add(barMesh);
    var glass = new THREE.Mesh(glassGeo, new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, roughness: 0.02, clearcoat: 1, envMapIntensity: 1.4 }));
    glass.position.z = PD / 2 + 0.042; phone.add(glass);
    // the camera plateau on the back
    var bump = new THREE.Mesh(new THREE.ExtrudeGeometry(shape(THREE, 0.44, 0.44, 0.1, 0), { depth: 0.02, bevelEnabled: false, curveSegments: 12 }), bodyMat);
    bump.rotation.y = Math.PI; bump.position.set(-0.2, PH / 2 - 0.3, -PD / 2 - 0.02); phone.add(bump);
    [[-0.1, 0.09], [0.1, 0.09], [0, -0.1]].forEach(function (p) {
      var ring = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 32), bodyMat);
      ring.rotation.x = Math.PI / 2; ring.position.set(-0.2 - p[0], PH / 2 - 0.3 + p[1], -PD / 2 - 0.045); phone.add(ring);
      var lens = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.034, 32), lensMat);
      lens.rotation.x = Math.PI / 2; lens.position.copy(ring.position); lens.position.z -= 0.004; phone.add(lens);
    });

    var scroll = 0, yaw = 0, yawV = 0, tilt = 0, dragging = false, lastX = 0, lastY = 0, visible = true, raf = 0, lastT = 0, t0 = performance.now();
    function place() {   // texture v runs bottom to top: show the band starting at `scroll` px from the top
      ft.offset.y = 1 - (scroll + SH) / fc.height;
    }
    place();
    function frame(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      var dt = Math.min(40, now - (lastT || now)) / 1000; lastT = now;
      var still = reduce.matches;
      if (!still) { scroll = (scroll + SPEED * dt) % fc.height; place(); }
      if (!dragging) {
        if (Math.abs(yawV) > 0.05 && !still) { yaw += yawV * dt; yawV *= Math.exp(-dt * 2.4); }
        else { yawV = 0; var n = Math.round(yaw / (2 * Math.PI)) * 2 * Math.PI; yaw += (n - yaw) * (1 - Math.exp(-dt * (still ? 60 : 3))); }
        tilt += (0 - tilt) * (1 - Math.exp(-dt * 5));
      }
      pivot.rotation.y = yaw + (still ? 0 : Math.sin((now - t0) / 3200) * 0.22);
      pivot.rotation.x = tilt + (still ? 0 : Math.cos((now - t0) / 2600) * 0.03);
      pivot.position.y = still ? 0 : Math.sin((now - t0) / 2000) * 0.02;
      renderer.render(scene, camera);
      var moving = dragging || yawV || Math.abs(tilt) > 0.002 || Math.abs(yaw - Math.round(yaw / (2 * Math.PI)) * 2 * Math.PI) > 0.002;
      if (!still || moving) raf = requestAnimationFrame(frame);
    }
    function want() { if (!raf && visible) { lastT = 0; raf = requestAnimationFrame(frame); } }

    stage.addEventListener('pointerdown', function (e) { dragging = true; lastX = e.clientX; lastY = e.clientY; yawV = 0; stage.classList.add('is-dragging'); try { stage.setPointerCapture(e.pointerId); } catch (x) {} want(); });
    stage.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
      yaw += dx * 0.011; yawV = dx * 0.011 * 60;
      tilt = Math.max(-0.35, Math.min(0.35, tilt + dy * 0.004)); want();
    });
    function up() { if (!dragging) return; dragging = false; stage.classList.remove('is-dragging'); want(); }
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('keydown', function (e) {
      var k = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0; if (!k) return;
      e.preventDefault(); e.stopPropagation(); yawV = k * 6; want();
    });

    function size() {
      var w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h); camera.aspect = w / h;
      var f = Math.tan(camera.fov * Math.PI / 360);
      var d = Math.max((PH + 0.35) / 2 / f, (PW + 1.1) / 2 / (camera.aspect * f));
      camera.position.set(0, 0, d); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); want();
    }
    window.addEventListener('resize', size);
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) want(); }).observe(stage);
    document.addEventListener('visibilitychange', want);
    if (reduce.addEventListener) reduce.addEventListener('change', want);
    host.appendChild(renderer.domElement);
    size(); stage.classList.add('is-live'); want();
  });
}

DCThree.lazy(stage, function (THREE) {
  if (!THREE) { stage.classList.add('is-flat'); return; }
  build(THREE).catch(function () { stage.classList.add('is-flat'); });
});
})();
