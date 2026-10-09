(function () {
  'use strict';

  var container = document.getElementById('catalog-3d');
  if (!container) return;

  /* ── CONFIG ── */
  var CATALOG_W = 8.5, CATALOG_H = 8.5, CATALOG_D = 0.4;
  var SCALE = 0.35;
  var AUTO_SPEED = (2 * Math.PI) / 25; // full rotation ~25s
  var SPINE_COLOR = 0xE8923A;
  var EDGE_COLOR = 0xF5F0EB;
  var GROUND_COLOR = 0x1A1A1A;

  var FRONT_IMG = '/dc/images/design/Weissmans/catalog-pages/Screenshot%202026-03-24%20at%202.49.37%20PM.webp';
  var BACK_IMG = '/dc/images/design/Weissmans/catalog-pages/Screenshot%202026-03-24%20at%202.55.43%20PM.webp';

  /* ── RENDERER ── */
  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.opacity = '0';
  renderer.domElement.style.transition = 'opacity 0.8s ease';

  /* ── SCENE ── */
  var scene = new THREE.Scene();

  /* ── CAMERA ── */
  var camera = new THREE.PerspectiveCamera(45, 4 / 3, 0.1, 100);
  camera.position.set(0, 1.4, 6);
  camera.lookAt(0, 0.1, 0);

  /* ── LIGHTS ── */
  var ambient = new THREE.AmbientLight(0x606060, 1);
  scene.add(ambient);

  var dirLight = new THREE.DirectionalLight(0xFFF8F0, 1.0);
  dirLight.position.set(0, 6, 5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 20;
  dirLight.shadow.camera.left = -4;
  dirLight.shadow.camera.right = 4;
  dirLight.shadow.camera.top = 4;
  dirLight.shadow.camera.bottom = -4;
  dirLight.shadow.bias = -0.002;
  scene.add(dirLight);

  var fillLight = new THREE.DirectionalLight(0xE8E8FF, 0.3);
  fillLight.position.set(2, -1, -2);
  scene.add(fillLight);

  /* ── GROUND ── */
  var groundGeo = new THREE.PlaneGeometry(20, 20);
  var groundMat = new THREE.ShadowMaterial({ opacity: 0.15 });
  var ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -(CATALOG_H * SCALE) / 2 - 0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  /* ── TEXTURES & CATALOG ── */
  var loader = new THREE.TextureLoader();
  var loaded = 0;

  function onTextureLoad() {
    loaded++;
    if (loaded >= 2) {
      renderer.domElement.style.opacity = '1';
    }
  }

  var frontTex = loader.load(FRONT_IMG, onTextureLoad);
  var backTex = loader.load(BACK_IMG, onTextureLoad);
  frontTex.encoding = THREE.sRGBEncoding;
  backTex.encoding = THREE.sRGBEncoding;

  // Box faces order: +x (right edge), -x (left/spine), +y (top), -y (bottom), +z (front), -z (back)
  var w = CATALOG_W * SCALE;
  var h = CATALOG_H * SCALE;
  var d = CATALOG_D * SCALE;

  var geometry = new THREE.BoxGeometry(w, h, d);
  var materials = [
    new THREE.MeshStandardMaterial({ color: EDGE_COLOR, roughness: 0.9 }),  // right edge (pages)
    new THREE.MeshStandardMaterial({ color: SPINE_COLOR, roughness: 0.5, metalness: 0.05 }), // left edge (spine)
    new THREE.MeshStandardMaterial({ color: EDGE_COLOR, roughness: 0.9 }),  // top
    new THREE.MeshStandardMaterial({ color: EDGE_COLOR, roughness: 0.9 }),  // bottom
    new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.4, metalness: 0.0 }),  // front (+z)
    new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.4, metalness: 0.0 }),   // back (-z)
  ];

  var catalog = new THREE.Mesh(geometry, materials);
  catalog.castShadow = true;
  catalog.receiveShadow = true;
  catalog.rotation.y = THREE.MathUtils.degToRad(18);
  catalog.rotation.x = THREE.MathUtils.degToRad(-7);
  scene.add(catalog);

  /* ── ORBIT CONTROLS (minimal, no import) ── */
  var isDragging = false;
  var isHovering = false;
  var prevX = 0, prevY = 0;
  var targetRotY = catalog.rotation.y;
  var targetRotX = catalog.rotation.x;
  var autoAngle = catalog.rotation.y;

  var el = renderer.domElement;

  function onPointerDown(e) {
    isDragging = true;
    prevX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    prevY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
    el.style.cursor = 'grabbing';
    e.preventDefault();
  }

  function onPointerMove(e) {
    var cx = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    var cy = e.clientY || (e.touches && e.touches[0].clientY) || 0;
    if (!isDragging) return;
    var dx = cx - prevX;
    var dy = cy - prevY;
    targetRotY += dx * 0.008;
    targetRotX += dy * 0.005;
    targetRotX = Math.max(-0.8, Math.min(0.8, targetRotX));
    prevX = cx;
    prevY = cy;
    e.preventDefault();
  }

  function onPointerUp() {
    isDragging = false;
    el.style.cursor = 'grab';
    autoAngle = targetRotY;
  }

  el.addEventListener('mousedown', onPointerDown);
  el.addEventListener('mousemove', onPointerMove);
  el.addEventListener('mouseup', onPointerUp);
  el.addEventListener('mouseleave', function () {
    isDragging = false;
    isHovering = false;
    el.style.cursor = 'grab';
    autoAngle = targetRotY;
  });
  el.addEventListener('mouseenter', function () { isHovering = true; el.style.cursor = 'grab'; });

  el.addEventListener('touchstart', onPointerDown, { passive: false });
  el.addEventListener('touchmove', onPointerMove, { passive: false });
  el.addEventListener('touchend', onPointerUp);

  /* ── RESIZE ── */
  function resize() {
    var rect = container.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height || w * 0.75;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  /* ── ANIMATE ── */
  var clock = new THREE.Clock();
  // Drawn only while on screen, and let go of entirely once the page it's on
  // is replaced (a project opened in place on the Work page): a phone has room
  // for only a few WebGL contexts, and a forgotten one keeps its GPU busy.
  var seen = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { seen = entries[0].isIntersecting; }).observe(container);
  }

  function animate() {
    if (!container.isConnected) { dispose(); return; }
    requestAnimationFrame(animate);
    var dt = clock.getDelta();
    if (!seen) return;

    if (!isDragging && !isHovering) {
      autoAngle += AUTO_SPEED * dt;
      targetRotY = autoAngle;
      targetRotX += (THREE.MathUtils.degToRad(-7) - targetRotX) * 0.02;
    }

    catalog.rotation.y += (targetRotY - catalog.rotation.y) * 0.08;
    catalog.rotation.x += (targetRotX - catalog.rotation.x) * 0.08;

    renderer.render(scene, camera);
  }
  animate();

  /* ── CLEANUP ── */
  function dispose() {
    window.removeEventListener('resize', resize);
    geometry.dispose();
    materials.forEach(function (m) { m.dispose(); if (m.map) m.map.dispose(); });
    groundGeo.dispose();
    groundMat.dispose();
    renderer.dispose();
    if (renderer.forceContextLoss) renderer.forceContextLoss();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }
  window._catalogViewerDispose = dispose;
})();
