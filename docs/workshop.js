// The hero: a wide pixel-art workshop you can play with. A robot builds skill
// cartridges, shelves them, tidies whatever gets knocked about, and reacts to
// being picked up, thrown, and dropped on things.
// Rendering: three.js, orthographic, drawn small and scaled up with hard pixels.
// Physics: cannon-es. The robot's behaviour is the Brain near the bottom.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import * as CANNON from "cannon-es";

const INK = 0x120c22, NAVY = 0x1b1740, PLUM = 0x6b4bd6, LILAC = 0xc389fd, WHITE = 0xeef0ff, HOT = 0xff5fa2,
  BLUE = 0x3d5bff, SKY = 0x7d95ff, YELLOW = 0xe4f222, MINT = 0x95e199, TEAL = 0x35d6c0, STEEL = 0x8f97c9, BRICK = 0x2a2f6e;
const ROOM = { x0: -24.3, x1: 24.3, z0: -5.8, z1: 5.6, top: 11 };
const PAD = { x: -20, z: 0.6, r: 2.3 }, BASKET = { x: -15.4, z: -4.2 }, CRATE = { x: -10.4, z: -4.2 },
  BENCH = { x: -2, z: -4.3 }, STACK = { x: 4.7, z: -4.5 }, SHELF = { x: 10.5, xs: [8.1, 9.7, 11.3, 12.9], ys: [3.35, 5.85], z: -5.05 },
  DANCE = { x: 19, z: 0.6, r: 2.6 }, MUG = [1.7, 2.62, -4.1], TRAY = [0.2, 2.62, -4.7];
const STAND = { crate: [CRATE.x, -1.6], bench: [-1, -1.6], shelf: [SHELF.x, -1.6], basket: [BASKET.x, -1.6], stack: [STACK.x, -1.5], mug: [1.7, -1.6], tray: [0.2, -1.6] };
const LANE = 1.0, REST_Y = 2.1, VIEW_H = 38, PITCH = 0.2, SPAN = 48;

// 5 x 7 lettering for the signs
const FONT = { A: "01110100011000111111100011000110001", G: "01111100001000010111100011000101111", E: "11111100001000011110100001000011111", N: "10001110011010110101100111000110001", T: "11111001000010000100001000010000100", S: "01111100001000001110000010000111110", K: "10001100101010011000101001001010001", I: "11111001000010000100001000010011111", L: "10000100001000010000100001000011111", D: "11110100011000110001100011000111110", R: "11110100011000111110101001001010001", H: "10001100011000111111100011000110001", B: "11110100011000111110100011000111110", O: "01110100011000110001100011000101110", P: "11110100011000111110100001000010000", U: "10001100011000110001100011000101110", M: "10001110111010110101100011000110001", " ": "00000000000000000000000000000000000" };

export function mount(canvas, ui) {
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false }); } catch (e) { return false; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x62afea);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 200);
  const camAt = new THREE.Vector3(0, 16.2, 0);
  let halfW = 25;

  const hemi = new THREE.HemisphereLight(0xcfeaff, 0x7a8a66, 1.25); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1d6, 2.5); key.position.set(-20, 36, 28); key.castShadow = true;   // the sun
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.06;
  Object.assign(key.shadow.camera, { left: -56, right: 56, top: 44, bottom: -26, near: 1, far: 140 });
  scene.add(key);
  const lampLights = [-14, -2, 10, 19].map((x) => { const l = new THREE.PointLight(0xffe2b0, 70, 19, 1.7); l.position.set(x, 8.2, 0); scene.add(l); return l; });

  /* ---------- building blocks ---------- */
  const steps = new THREE.DataTexture(new Uint8Array([70, 140, 205, 255]), 4, 1, THREE.RedFormat);
  steps.minFilter = steps.magFilter = THREE.NearestFilter; steps.needsUpdate = true;
  const toon = (color, map) => new THREE.MeshToonMaterial({ color, gradientMap: steps, map: map || null });
  const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  function part(geo, color, parent, x, y, z, o) {
    o = o || {};
    const m = new THREE.Mesh(geo, o.glow ? new THREE.MeshBasicMaterial({ color, map: o.map || null }) : toon(color, o.map));
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = !o.glow && !o.flat; m.receiveShadow = !o.glow;
    if (o.line) { const hull = new THREE.Mesh(geo, inkMat); hull.scale.setScalar(1 + o.line); m.add(hull); }
    parent.add(m);
    return m;
  }
  const box = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 3, r == null ? Math.min(w, h, d) * 0.14 : r);
  const cyl = (r, h, seg, r2) => new THREE.CylinderGeometry(r2 == null ? r : r2, r, h, seg || 20);
  const ball = (r) => new THREE.SphereGeometry(r, 20, 14);
  const V = (x, y, z) => new CANNON.Vec3(x, y, z);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = (a) => a[(rnd() * a.length) | 0];
  function paint(w, h, draw) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); draw(g, w, h);
    const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    t.userData = { c, g }; return t;
  }
  const hex = (n) => "#" + n.toString(16).padStart(6, "0");
  function letters(g, text, x0, y0, cell, dot, color) {
    g.fillStyle = color;
    for (let i = 0; i < text.length; i++) { const f = FONT[text[i]] || FONT[" "]; for (let k = 0; k < 35; k++) if (f[k] === "1") g.fillRect(x0 + (i * 6 + k % 5) * cell, y0 + ((k / 5) | 0) * cell, dot, dot); }
  }

  /* ---------- physics world ---------- */
  const world = new CANNON.World({ gravity: V(0, -34, 0) });
  world.allowSleep = true;
  world.defaultContactMaterial.friction = 0.45; world.defaultContactMaterial.restitution = 0.18;
  const bouncy = new CANNON.Material("bouncy"), slick = new CANNON.Material("slick");
  world.addContactMaterial(new CANNON.ContactMaterial(bouncy, world.defaultMaterial, { friction: 0.3, restitution: 0.78 }));
  world.addContactMaterial(new CANNON.ContactMaterial(slick, world.defaultMaterial, { friction: 0.0, restitution: 0.05 }));
  function solid(hx, hy, hz, x, y, z) {
    const b = new CANNON.Body({ mass: 0, shape: new CANNON.Box(V(hx, hy, hz)), position: V(x, y, z), material: world.defaultMaterial });
    world.addBody(b); return b;
  }
  solid(60, 1, 40, 0, -1, 0); solid(60, 1, 40, 0, ROOM.top + 1, 0);
  solid(1, 20, 40, ROOM.x0 - 1, 10, 0); solid(1, 20, 40, ROOM.x1 + 1, 10, 0);
  solid(60, 20, 1, 0, 10, ROOM.z0 - 1); solid(60, 20, 1, 0, 10, ROOM.z1 + 1);

  /* ---------- the street, the buildings, the sky ---------- */
  const room = new THREE.Group(); scene.add(room);
  const css = (n) => "#" + n.toString(16).padStart(6, "0");
  const shade = (n, k) => { const c = new THREE.Color(n).multiplyScalar(k); return "#" + c.getHexString(); };
  // small tiling surface textures: every flat gets grain, seams and wear
  function surface(base, kind) {
    return paint(32, 32, (g) => {
      g.fillStyle = css(base); g.fillRect(0, 0, 32, 32);
      const lo = shade(base, 0.82), hi = shade(base, 1.14), deep = shade(base, 0.66);
      if (kind === "brick") { for (let y = 0; y < 32; y += 4) for (let x = (y / 4) % 2 ? -4 : 0; x < 32; x += 8) { g.fillStyle = pick([css(base), lo, hi, css(base)]); g.fillRect(x, y, 7, 3); } g.fillStyle = deep; for (let y = 3; y < 32; y += 4) g.fillRect(0, y, 32, 1); }
      else if (kind === "planks") { for (let x = 0; x < 32; x += 8) { g.fillStyle = pick([lo, css(base), hi]); g.fillRect(x, 0, 7, 32); g.fillStyle = deep; g.fillRect(x + 7, 0, 1, 32); g.fillRect(x + 2, (rnd() * 30) | 0, 3, 1); } }
      else if (kind === "ribbed") { for (let x = 0; x < 32; x += 4) { g.fillStyle = hi; g.fillRect(x, 0, 1, 32); g.fillStyle = lo; g.fillRect(x + 2, 0, 2, 32); } }
      else if (kind === "tiles") { for (let y = 0; y < 32; y += 8) for (let x = 0; x < 32; x += 8) { g.fillStyle = pick([css(base), lo, hi]); g.fillRect(x, y, 7, 7); g.fillStyle = deep; g.fillRect(x + 7, y, 1, 8); g.fillRect(x, y + 7, 8, 1); } }
      for (let i = 0; i < 46; i++) { g.fillStyle = pick([lo, hi, deep]); g.fillRect((rnd() * 32) | 0, (rnd() * 32) | 0, 1, 1); }
      if (kind === "plaster" || kind === "concrete") for (let i = 0; i < 3; i++) { g.fillStyle = lo; const x = (rnd() * 30) | 0; g.fillRect(x, 0, 2, 8 + ((rnd() * 20) | 0)); }
    });
  }
  function tiled(tex, ru, rv) { const t = tex.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(ru, rv); t.needsUpdate = true; return t; }
  const TEX = { concrete: surface(0x9aa3c4, "concrete"), paving: surface(0xb9c2dd, "tiles"), asphalt: surface(0x4a5278, "concrete"), wood: surface(0x8a5a6a, "planks"), metal: surface(0x8f97c9, "ribbed"), roofing: surface(0x5a6494, "tiles"), brickRose: surface(0xb5566b, "brick"), shopFloor: surface(0x3a4196, "tiles") };
  // a block: a textured box whose faces repeat by real size, so texel density stays even
  function block(w, h, d, tex, tint, x, y, z, o) {
    const m = part(new THREE.BoxGeometry(w, h, d), tint == null ? 0xffffff : tint, room, x, y, z, Object.assign({ map: tiled(tex, Math.max(1, Math.round(Math.max(w, d) / 5)), Math.max(1, Math.round(h / 5))) }, o || {}));
    return m;
  }

  // sky: banded daylight, a hazy far city, drifting clouds, birds
  const skyTex = paint(160, 120, (g, w, h) => {
    const bands = ["#3f8fdc", "#4f9fe4", "#62afea", "#78bff0", "#90cdf4", "#a9dbf7", "#c2e7fa", "#d9f1fc"];
    bands.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * 13, w, 14); if (i) for (let x = 0; x < w; x++) for (let y = 0; y < 3; y++) if ((x + y) % 2 === 0 && rnd() < 0.8 - y * 0.25) { g.fillStyle = bands[i - 1]; g.fillRect(x, i * 13 + y, 1, 1); } });
    for (let layer = 0; layer < 2; layer++) for (let x = 0; x < w;) { const bw = 5 + ((rnd() * 12) | 0), bh = 10 + ((rnd() * (layer ? 22 : 34)) | 0); g.fillStyle = layer ? "#9fc4e6" : "#b4d5f0"; g.fillRect(x, 104 - bh, bw, bh + 16); if (rnd() < 0.4) g.fillRect(x + 1, 100 - bh, 2, 4); g.fillStyle = layer ? "#8ab4dc" : "#a4c8ea"; for (let yy = 106 - bh; yy < 104; yy += 4) for (let xx = x + 1; xx < x + bw - 1; xx += 3) if (rnd() < 0.5) g.fillRect(xx, yy, 1, 2); x += bw + 1; }
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(150, 70), new THREE.MeshBasicMaterial({ map: skyTex })); sky.position.set(0, 26, -45); room.add(sky);
  const cloudTex = paint(64, 24, (g) => { const puff = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }; [[14, 15, 7], [24, 11, 9], [36, 12, 8], [46, 15, 6], [30, 17, 8]].forEach(([x, y, r]) => puff(x, y + 2, r, "#b9d8f2")); [[14, 14, 7], [24, 10, 9], [36, 11, 8], [46, 14, 6], [30, 15, 8]].forEach(([x, y, r]) => puff(x, y, r, "#ffffff")); g.clearRect(0, 20, 64, 4); });
  const clouds = [[-30, 33, 22], [6, 37, 30], [34, 31, 18], [-58, 38, 26]].map(([x, y, w]) => { const c = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.375), new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, alphaTest: 0.5 })); c.position.set(x, y, -40 + w * 0.1); room.add(c); return c; });
  const birds = [0, 1, 2].map((i) => { const b = new THREE.Group(); b.position.set(-20 + i * 3, 34 + i * 0.8, -12); room.add(b); const l = part(box(0.7, 0.08, 0.2, 0.02), 0x2a3156, b, -0.3, 0, 0, { glow: true }), r = part(box(0.7, 0.08, 0.2, 0.02), 0x2a3156, b, 0.3, 0, 0, { glow: true }); b.userData.w = [l, r]; return b; });

  // street: paving, kerb, road
  const paving = new THREE.Mesh(new THREE.PlaneGeometry(90, 6.4), toon(0xffffff, tiled(TEX.paving, 30, 2))); paving.rotation.x = -Math.PI / 2; paving.position.set(0, 0, 9.2); paving.receiveShadow = true; room.add(paving);
  block(90, 0.5, 0.5, TEX.concrete, 0xdfe4f5, 0, -0.2, 12.5, { flat: true });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(90, 14), toon(0xffffff, tiled(TEX.asphalt, 22, 4))); road.rotation.x = -Math.PI / 2; road.position.set(0, -0.45, 19.5); road.receiveShadow = true; room.add(road);
  for (let x = -40; x <= 40; x += 8) part(box(3.6, 0.06, 0.4, 0.02), WHITE, room, x, -0.4, 16.5, { flat: true });
  part(cyl(0.9, 0.06, 12), 0x3a4166, room, 12, -0.42, 14.5, { flat: true });

  // the workshop interior: painted back wall, tiled floor
  const wallTex = paint(384, 88, (g, w, h) => {
    g.fillStyle = "#4a56b8"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) for (let x = (y / 4) % 2 ? -4 : 0; x < w; x += 8) { g.fillStyle = pick(["#4450ae", "#4f5cc2", "#3f4aa4", "#5664cc"]); g.fillRect(x, y, 7, 3); }
    for (let i = 0; i < 14; i++) { g.fillStyle = "rgba(20,24,80,.25)"; g.fillRect((rnd() * w) | 0, 0, 2 + ((rnd() * 3) | 0), 10 + ((rnd() * 40) | 0)); }
    g.fillStyle = "#2c3586"; g.fillRect(0, 62, w, 26); g.fillStyle = "#6f7de0"; g.fillRect(0, 61, w, 1);
    const windowAt = (x, y, ww, hh) => { g.fillStyle = "#8fd0f6"; g.fillRect(x, y, ww, hh); g.fillStyle = "#c9ecfc"; for (let i = 0; i < hh; i++) g.fillRect(x + ((i * 0.7) | 0), y + hh - 1 - i, 5, 1); g.fillStyle = "#6bb85e"; g.fillRect(x, y + hh - 6, ww, 6); g.fillStyle = "#8fd67a"; for (let i = 0; i < ww; i += 3) g.fillRect(x + i, y + hh - 7 - (i % 2), 2, 2); g.strokeStyle = "#eef0ff"; g.lineWidth = 2; g.strokeRect(x, y, ww, hh); g.fillStyle = "#eef0ff"; g.fillRect(x + (ww >> 1), y, 1, hh); g.fillRect(x, y + (hh >> 1), ww, 1); g.fillStyle = "#2c3586"; g.fillRect(x - 1, y + hh + 1, ww + 2, 2); };
    windowAt(196, 10, 34, 30); windowAt(322, 12, 30, 26);
    const stock = (x, y, ww, rows) => { for (let r = 0; r < rows; r++) { const yy = y + r * 11; g.fillStyle = "#232a78"; g.fillRect(x, yy, ww, 10); for (let xx = x + 1; xx < x + ww - 2;) { const bw = 2 + ((rnd() * 4) | 0), bh = 4 + ((rnd() * 5) | 0), c = pick(["#ff5fa2", "#e4f222", "#95e199", "#c389fd", "#7d95ff", "#eef0ff", "#35d6c0"]); g.fillStyle = c; g.fillRect(xx, yy + 9 - bh, bw, bh); g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(xx + bw - 1, yy + 9 - bh, 1, bh); xx += bw + 1; } g.fillStyle = "#c9cdea"; g.fillRect(x - 1, yy + 9, ww + 2, 1); g.fillStyle = "#8f97c9"; g.fillRect(x - 1, yy + 10, ww + 2, 1); } };
    stock(8, 6, 44, 3); stock(60, 14, 30, 2); stock(246, 8, 40, 3); stock(292, 44, 24, 1); stock(356, 8, 24, 4);
    g.fillStyle = "#6b4bd6"; g.fillRect(104, 8, 46, 28); g.fillStyle = "#5a3cc0"; g.fillRect(104, 34, 46, 2);
    for (let y = 10; y < 36; y += 4) for (let x = 106; x < 150; x += 4) { g.fillStyle = "#4a2fa8"; g.fillRect(x, y, 1, 1); }
    [[110, "#eef0ff", 14], [116, "#ff5fa2", 10], [122, "#e4f222", 16], [129, "#eef0ff", 8], [135, "#95e199", 13], [142, "#7d95ff", 11]].forEach(([x, c, len]) => { g.fillStyle = c; g.fillRect(x, 12, 2, len); g.fillRect(x - 1, 12, 4, 3); g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(x + 2, 13, 1, len); });
    [[160, 10, "#ff5fa2"], [176, 22, "#e4f222"], [236, 44, "#35d6c0"], [300, 10, "#c389fd"]].forEach(([x, y, c]) => { g.fillStyle = "#eef0ff"; g.fillRect(x - 1, y - 1, 14, 18); g.fillStyle = c; g.fillRect(x, y, 12, 16); g.fillStyle = "#120c22"; g.fillRect(x + 2, y + 3, 8, 2); g.fillRect(x + 2, y + 7, 6, 1); g.fillRect(x + 2, y + 10, 7, 1); });
    g.fillStyle = "#c9cdea"; g.fillRect(0, 2, w, 2); g.fillRect(94, 2, 2, 60); g.fillRect(240, 2, 2, 40); g.fillStyle = "#8f97c9"; g.fillRect(0, 4, w, 1); g.fillStyle = "#ff5fa2"; for (let x = 20; x < w; x += 46) g.fillRect(x, 1, 3, 4);
    g.fillStyle = "#eef0ff"; g.beginPath(); g.arc(168, 46, 6, 0, 7); g.fill(); g.fillStyle = "#120c22"; g.fillRect(168, 42, 1, 5); g.fillRect(168, 46, 4, 1);
  });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(50, 11.4), toon(0xffffff, wallTex)); wall.position.set(0, 5.5, ROOM.z0 - 0.2); wall.receiveShadow = true; room.add(wall);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 12), toon(0xffffff, tiled(TEX.shopFloor, 16, 4))); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; room.add(floor);
  block(54, 1.2, 12.6, TEX.concrete, 0x8a92b8, 0, -0.62, 0, { flat: true });
  for (let i = 0; i < 12; i++) part(box(1.9, 0.05, 0.3, 0.01), i % 2 ? YELLOW : INK, room, -22.8 + i * 4.15, 0.03, 5.7, { flat: true });   // hazard strip at the threshold

  // the workshop building: brick piers, slab, an upper storey with the sign, a roof garden
  for (const s of [-1, 1]) { block(1.9, 12.9, 12.6, TEX.brickRose, null, s * 25.7, 6.45, 0); block(2.2, 0.6, 12.9, TEX.concrete, 0xdfe4f5, s * 25.7, 11.2, 0); }
  block(53.3, 1.4, 12.6, TEX.concrete, 0xc5cbe6, 0, 12.2, 0);
  for (let x = -24; x <= 24; x += 6) part(box(0.5, 0.7, 12, 0.05), 0x3a4196, room, x, 11.2, 0, { flat: true });
  // striped valance over the opening
  const awnTex = paint(32, 8, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#2ec4a9" : "#eef6f2"; g.fillRect(i * 4, 0, 4, 8); } g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(0, 6, 32, 2); });
  const valance = part(new THREE.BoxGeometry(53.3, 1.5, 1.6), 0xffffff, room, 0, 12.3, 7.0, { map: tiled(awnTex, 13, 1) }); valance.rotation.x = 0.5;
  part(box(53.6, 0.3, 0.3, 0.05), STEEL, room, 0, 12.95, 6.5);
  // upper storey: painted facade plus real ledges, balconies and units for the sun to catch
  function facade(w, h, base, o) {
    const W = Math.round(w * 6), H = Math.round(h * 6);
    return paint(W, H, (g) => {
      g.fillStyle = css(base); g.fillRect(0, 0, W, H);
      for (let i = 0; i < W * H / 26; i++) { g.fillStyle = pick([shade(base, 0.9), shade(base, 1.08), shade(base, 0.96)]); g.fillRect((rnd() * W) | 0, (rnd() * H) | 0, 1 + ((rnd() * 2) | 0), 1); }
      for (let i = 0; i < W / 9; i++) { g.fillStyle = "rgba(40,50,90,.16)"; g.fillRect((rnd() * W) | 0, 0, 1 + ((rnd() * 2) | 0), 6 + ((rnd() * H * 0.5) | 0)); }
      g.fillStyle = shade(base, 0.78); for (let r = 1; r < o.rows; r++) g.fillRect(0, Math.round(r * H / o.rows) - 1, W, 2); g.fillRect(0, H - 4, W, 4);
      const ww = o.ww || 12, wh = o.wh || 16, gapX = W / o.cols, gapY = H / o.rows;
      for (let r = 0; r < o.rows; r++) for (let c = 0; c < o.cols; c++) {
        if (o.skip && o.skip(r, c)) continue;
        const x = Math.round(gapX * (c + 0.5) - ww / 2), y = Math.round(gapY * r + (gapY - wh) / 2 - 1);
        g.fillStyle = shade(base, 0.7); g.fillRect(x - 2, y - 2, ww + 4, wh + 4);
        g.fillStyle = "#eef0ff"; g.fillRect(x - 1, y - 1, ww + 2, wh + 2);
        const open = rnd() < 0.25; g.fillStyle = open ? "#27305e" : "#4f86c6"; g.fillRect(x, y, ww, wh);
        if (!open) { g.fillStyle = "#9ed0f2"; for (let i = 0; i < wh; i++) g.fillRect(x + Math.max(0, ww - 4 - ((i * 0.6) | 0)), y + i, 3, 1); }
        if (rnd() < 0.6) { g.fillStyle = pick(["#ff9fc6", "#fff3a0", "#b9f0c0", "#eef0ff"]); g.fillRect(x, y, (ww / 2.5) | 0, wh - 2); }
        g.fillStyle = "#eef0ff"; g.fillRect(x + (ww >> 1), y, 1, wh); g.fillRect(x, y + (wh >> 1), ww, 1);
        g.fillStyle = css(o.shutter || 0x35d6c0); g.fillRect(x - 5, y - 1, 3, wh + 2); g.fillRect(x + ww + 2, y - 1, 3, wh + 2); g.fillStyle = "rgba(0,0,0,.2)"; for (let i = 1; i < wh; i += 2) { g.fillRect(x - 5, y + i, 3, 1); g.fillRect(x + ww + 2, y + i, 3, 1); }
        g.fillStyle = "#dfe4f5"; g.fillRect(x - 3, y + wh + 1, ww + 6, 2);
        if (rnd() < 0.55) { g.fillStyle = "#7a4d5c"; g.fillRect(x - 2, y + wh - 1, ww + 4, 3); for (let i = -2; i < ww + 2; i += 2) { g.fillStyle = pick(["#4fc27a", "#6bd88a", "#3da566"]); g.fillRect(x + i, y + wh - 3 - ((rnd() * 3) | 0), 2, 3); if (rnd() < 0.4) { g.fillStyle = pick(["#ff5fa2", "#e4f222", "#eef0ff"]); g.fillRect(x + i, y + wh - 4, 1, 1); } } }
      }
      if (o.door != null) { const x = Math.round(o.door * 6), dh = 26; g.fillStyle = shade(base, 0.65); g.fillRect(x - 2, H - dh - 2, 18, dh + 2); g.fillStyle = css(o.shutter || 0x35d6c0); g.fillRect(x, H - dh, 14, dh); g.fillStyle = "rgba(0,0,0,.22)"; g.fillRect(x + 2, H - dh + 3, 10, 8); g.fillRect(x + 2, H - dh + 14, 10, 9); g.fillStyle = "#e4f222"; g.fillRect(x + 11, H - 13, 1, 2); }
      const ivy = (x0, y0, ww2, hh2) => { for (let i = 0; i < ww2 * hh2 * 0.7; i++) { const x = x0 + ((rnd() * ww2) | 0), y = y0 + ((rnd() * rnd() * hh2) | 0); g.fillStyle = pick(["#3da566", "#4fc27a", "#2f8a54", "#6bd88a"]); g.fillRect(x, y, 2, 2); } };
      (o.ivy || []).forEach((v) => ivy(v[0] * 6, v[1] * 6, v[2] * 6, v[3] * 6));
      g.fillStyle = "#8f97c9"; g.fillRect(W - 5, 0, 2, H); g.fillStyle = "#6b74a8"; for (let y = 8; y < H; y += 18) g.fillRect(W - 6, y, 4, 2);
    });
  }
  function building(x0, x1, h, base, o) {
    const w = x1 - x0, cx = (x0 + x1) / 2, depth = o.depth || 12.6, z = o.z == null ? 0 : o.z, y0 = o.y0 || 0;
    part(new THREE.BoxGeometry(w, h, depth), base, room, cx, y0 + h / 2, z, { map: tiled(surface(base, "plaster"), Math.round(w / 6), Math.round(h / 6)) });
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, h), toon(0xffffff, facade(w, h, base, o))); f.position.set(cx, y0 + h / 2, z + depth / 2 + 0.02); f.receiveShadow = true; room.add(f);
    const roofY = y0 + h; block(w + 0.6, 0.5, depth + 0.6, TEX.concrete, 0xdfe4f5, cx, roofY + 0.05, z);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(w, depth), toon(0xffffff, tiled(TEX.roofing, Math.round(w / 4), 3))); top.rotation.x = -Math.PI / 2; top.position.set(cx, roofY + 0.32, z); top.receiveShadow = true; room.add(top);
    return { cx, roofY, front: z + depth / 2 };
  }
  const acs = [];
  function ac(x, y, z) { part(box(2.2, 1.3, 1.2, 0.08), 0xeef0ff, room, x, y, z, { line: 0.03 }); part(cyl(0.48, 0.1, 12), INK, room, x - 0.35, y, z + 0.62).rotation.x = Math.PI / 2; acs.push(part(box(0.8, 0.1, 0.05, 0.01), STEEL, room, x - 0.35, y, z + 0.7, { flat: true })); part(box(0.5, 0.08, 0.05, 0.01), 0x8f97c9, room, x + 0.6, y + 0.3, z + 0.62, { flat: true }); }
  function balcony(x, y, z, w) { part(box(w, 0.25, 1.5, 0.04), 0xdfe4f5, room, x, y, z + 0.75); for (let i = 0; i <= w; i += 0.5) part(box(0.08, 1.0, 0.08, 0.01), INK, room, x - w / 2 + i, y + 0.6, z + 1.45, { flat: true }); part(box(w, 0.1, 0.1, 0.02), INK, room, x, y + 1.1, z + 1.45, { flat: true }); bush(x - w / 2 + 0.6, y + 0.3, z + 1.0, 0.55); bush(x + w / 2 - 0.7, y + 0.3, z + 1.0, 0.5, true); }
  function bush(x, y, z, r, bloom) { for (let i = 0; i < 4; i++) part(ball(r * (0.8 + rnd() * 0.5)), pick([0x4fc27a, 0x3da566, 0x6bd88a]), room, x + (rnd() - 0.5) * r * 1.6, y + r * 0.6 + rnd() * r, z + (rnd() - 0.5) * r, { flat: true }); if (bloom) for (let i = 0; i < 4; i++) part(ball(r * 0.22), pick([HOT, YELLOW, WHITE]), room, x + (rnd() - 0.5) * r * 2, y + r * 1.2 + rnd() * r * 0.6, z + r * 0.8, { glow: true }); }
  function planter(x, z, w, bloom) { block(w, 0.9, 1.1, TEX.wood, null, x, 0.45, z, { line: 0.02 }); for (let i = 0.5; i < w; i += 0.9) bush(x - w / 2 + i, 0.8, z, 0.5, bloom && i % 1.8 < 0.9); }
  function vines(x0, x1, y, z, drop) { for (let x = x0; x < x1; x += 0.45) { const len = drop * (0.3 + rnd() * rnd()); for (let k = 0; k < len; k += 0.4) part(box(0.42, 0.42, 0.25, 0.08), pick([0x3da566, 0x4fc27a, 0x2f8a54, 0x6bd88a]), room, x + (rnd() - 0.5) * 0.3, y - k, z + rnd() * 0.15, { flat: true }); } }

  // above the shop
  const upper = building(-26.6, 26.6, 9.4, 0xd9e3f7, { y0: 12.9, rows: 2, cols: 11, shutter: 0x35d6c0, skip: (r, c) => c >= 3 && c <= 7, ivy: [[0, 0, 7, 3], [44, 0, 9, 4], [20, 0, 4, 1.5]] });
  balcony(-19.3, 17.4, upper.front, 4.4); balcony(19.4, 17.4, upper.front, 4.4);
  ac(-23.6, 14.3, upper.front + 0.7); ac(14.4, 14.4, upper.front + 0.7); ac(24.3, 19.9, upper.front + 0.7);
  // the sign
  const board = paint(300, 44, () => {}); let boardText = "AGENT SKILLS";
  function drawBoard(sweep) {
    const g = board.userData.g, x0 = Math.round((300 - boardText.length * 24 + 4) / 2); g.fillStyle = "#1f9e8e"; g.fillRect(0, 0, 300, 44);
    g.fillStyle = "#27b3a0"; for (let y = 2; y < 44; y += 4) g.fillRect(0, y, 300, 1);
    letters(g, boardText, x0 + 1, 9, 4, 4, "#12695f"); letters(g, boardText, x0, 8, 4, 4, "#eafff6");
    if (sweep >= 0) { g.globalAlpha = 0.4; g.fillStyle = "#ffffff"; g.fillRect(sweep * 4, 0, 10, 44); g.globalAlpha = 1; }
    board.needsUpdate = true;
  }
  drawBoard(-1);
  part(box(27.4, 5.0, 0.7, 0.08), 0x24404a, room, 0, 17.6, upper.front + 0.5, { line: 0.02 });
  part(box(27.9, 0.4, 1.2, 0.05), STEEL, room, 0, 20.2, upper.front + 0.6); part(box(27.9, 0.4, 1.0, 0.05), STEEL, room, 0, 15.0, upper.front + 0.6);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(26.4, 3.87), new THREE.MeshBasicMaterial({ map: board })); sign.position.set(0, 17.6, upper.front + 0.87); room.add(sign);
  const bulbs = []; for (let x = -13; x <= 13; x += 2) bulbs.push(part(ball(0.2), x % 4 ? HOT : YELLOW, room, x, 20.55, upper.front + 1.0, { glow: true }));
  vines(-26.4, -14.2, 22.2, upper.front + 0.25, 4.5); vines(14.5, 26.4, 22.2, upper.front + 0.25, 3.6); vines(-3, 4, 22.2, upper.front + 0.25, 1.2);
  // roof garden
  const RY = upper.roofY + 0.35;
  const tankMesh = part(cyl(2.0, 3.2, 16), 0x7d95ff, room, -20, RY + 2.6, -1, { line: 0.02, map: tiled(TEX.metal, 6, 1) }); part(new THREE.ConeGeometry(2.2, 1.0, 16), 0x4a53b8, room, -20, RY + 4.7, -1); for (const dx of [-1.2, 1.2]) part(box(0.2, 1.2, 0.2, 0.03), STEEL, room, -20 + dx, RY + 0.6, 0);
  block(5, 2.4, 4, TEX.brickRose, null, 9, RY + 1.2, -2); block(5.6, 0.4, 4.6, TEX.concrete, 0xdfe4f5, 9, RY + 2.5, -2); part(box(1.2, 1.8, 0.1, 0.02), TEAL, room, 8, RY + 0.9, 0.03, { flat: true });
  part(cyl(0.6, 3.2, 10), 0x4a53b8, room, 14.6, RY + 1.6, -4.9, { line: 0.03 }); part(cyl(0.8, 0.3, 10), STEEL, room, 14.6, RY + 3.2, -4.9);
  [[-12, 2, 3.2], [-7, 3.4, 2.4], [1, 2.6, 3.6], [19, 3, 4]].forEach(([x, z, w]) => { block(w, 0.8, 1.3, TEX.wood, null, x, RY + 0.4, z, { line: 0.02 }); for (let i = 0.5; i < w; i += 0.8) bush(x - w / 2 + i, RY + 0.7, z, 0.55, i % 1.6 < 0.8); });
  const dish = part(new THREE.SphereGeometry(1.2, 12, 6, 0, 6.3, 0, 1.1), WHITE, room, 23, RY + 1.8, -2, { line: 0.04 }); dish.rotation.set(-2.2, 0.6, 0); part(cyl(0.08, 1.6, 5), STEEL, room, 23, RY + 0.8, -2);
  part(cyl(0.06, 5.5, 5), STEEL, room, -25, RY + 2.75, -3); part(box(1.8, 0.08, 0.08, 0.02), STEEL, room, -25, RY + 4.4, -3); part(box(1.2, 0.08, 0.08, 0.02), STEEL, room, -25, RY + 5.0, -3);
  // washing line
  const washing = []; part(cyl(0.05, 2.4, 5), STEEL, room, -2.5, RY + 1.2, 1.5); part(cyl(0.05, 2.4, 5), STEEL, room, 5.5, RY + 1.2, 1.5); part(box(8, 0.04, 0.04, 0.01), INK, room, 1.5, RY + 2.3, 1.5, { flat: true });
  [HOT, WHITE, YELLOW, TEAL, LILAC, WHITE].forEach((c, i) => { const g = new THREE.Group(); g.position.set(-1.6 + i * 1.25, RY + 2.3, 1.5); room.add(g); part(box(0.9, i % 2 ? 1.3 : 0.9, 0.06, 0.02), c, g, 0, i % 2 ? -0.65 : -0.45, 0, { flat: true }); washing.push(g); });

  // neighbours
  const left = building(-39.5, -27.5, 25, 0x9fc3ee, { rows: 5, cols: 3, shutter: 0xeef0ff, door: 5, ivy: [[0, 0, 12, 3], [8, 12, 4, 6]], skip: (r, c) => r === 4 && c === 1 });
  balcony(-33.5, 12.6, left.front, 4.6); balcony(-33.5, 18.8, left.front, 4.6); ac(-37.2, 9.2, left.front + 0.7); ac(-29.6, 21.8, left.front + 0.7);
  const cafeAwn = part(new THREE.BoxGeometry(6.4, 0.2, 2.6), 0xffffff, room, -33.5, 5.9, left.front + 1.2, { map: tiled(awnTex, 2, 1) }); cafeAwn.rotation.x = 0.35;
  vines(-39.4, -31, left.roofY, left.front + 0.2, 5);
  const right = building(27.5, 39.5, 18.5, 0xf2a9c8, { rows: 3, cols: 3, shutter: 0x6b4bd6, door: 1.2, ivy: [[6, 0, 6, 2.5]], skip: (r, c) => r === 2 && c > 0 });
  balcony(33.5, 12.5, right.front, 5); ac(30.2, 8.4, right.front + 0.7);
  part(cyl(1.5, 2.4, 14), 0x35d6c0, room, 31.5, right.roofY + 1.9, -1, { line: 0.02, map: tiled(TEX.metal, 5, 1) }); part(new THREE.ConeGeometry(1.7, 0.8, 14), 0x1f9e8e, room, 31.5, right.roofY + 3.5, -1);
  bush(36.5, right.roofY + 0.3, 3, 1.0, true); bush(34.8, right.roofY + 0.3, 3.6, 0.7);
  // the stall next door: striped canopy, crates of fruit
  const stallAwn = part(new THREE.BoxGeometry(8.4, 0.2, 3.4), 0xffffff, room, 34.2, 5.6, right.front + 1.6, { map: tiled(paint(32, 8, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#3d5bff" : "#eef0ff"; g.fillRect(i * 4, 0, 4, 8); } }), 3, 1) }); stallAwn.rotation.x = 0.4;
  for (const dx of [-3.9, 3.9]) part(cyl(0.08, 5.2, 5), STEEL, room, 34.2 + dx, 2.6, right.front + 3.1);
  for (let i = 0; i < 4; i++) { const x = 31.2 + i * 2, c = [HOT, YELLOW, 0x6bd88a, LILAC][i]; block(1.7, 1.0, 1.3, TEX.wood, null, x, 0.5 + (i % 2) * 0.5, right.front + 1.6, { line: 0.02 }); for (let k = 0; k < 7; k++) part(ball(0.26), c, room, x - 0.6 + (k % 4) * 0.4, 1.15 + (i % 2) * 0.5 + ((k / 4) | 0) * 0.2, right.front + 1.3 + ((k / 4) | 0) * 0.5, { flat: true }); }

  // street furniture and greenery
  planter(-29.5, 7.6, 3.4, true); planter(28.6, 9.6, 2.6, true);
  part(cyl(0.16, 9, 8), 0x3a4166, room, -27.3, 4.5, 10.6); part(box(2.2, 0.16, 0.16, 0.04), 0x3a4166, room, -26.3, 8.9, 10.6); part(box(1.0, 0.3, 0.5, 0.08), 0xfff2b0, room, -25.4, 8.7, 10.6, { glow: true });
  part(cyl(0.34, 1.0, 10), HOT, room, 24.4, 0.5, 10.4, { line: 0.05 }); part(ball(0.34), HOT, room, 24.4, 1.0, 10.4); part(cyl(0.14, 0.9, 6), HOT, room, 24.4, 0.6, 10.4).rotation.z = Math.PI / 2;
  part(box(3.2, 0.2, 0.9, 0.05), 0x8a5a6a, room, -34.5, 1.0, 8.6, { line: 0.03 }); part(box(3.2, 0.9, 0.16, 0.05), 0x8a5a6a, room, -34.5, 1.6, 8.2); for (const dx of [-1.3, 1.3]) part(box(0.16, 1.0, 0.8, 0.03), INK, room, -34.5 + dx, 0.5, 8.6);
  const bike = new THREE.Group(); bike.position.set(-30.6, 0, 10.2); room.add(bike); for (const dx of [-0.9, 0.9]) part(new THREE.TorusGeometry(0.7, 0.09, 6, 14), INK, bike, dx, 0.75, 0); part(box(1.8, 0.1, 0.1, 0.03), TEAL, bike, 0, 1.15, 0).rotation.z = 0.2; part(box(0.1, 0.9, 0.1, 0.03), TEAL, bike, -0.35, 1.25, 0); part(box(0.5, 0.12, 0.2, 0.04), INK, bike, -0.35, 1.72, 0); part(box(0.1, 1.0, 0.1, 0.03), TEAL, bike, 0.8, 1.2, 0).rotation.z = -0.3; part(box(0.7, 0.08, 0.08, 0.02), INK, bike, 0.98, 1.72, 0);
  part(cyl(0.55, 1.5, 10), 0x4a53b8, room, 26.4, 0.75, 8.4, { line: 0.03, map: tiled(TEX.metal, 3, 1) }); part(cyl(0.6, 0.14, 10), INK, room, 26.4, 1.5, 8.4);
  block(1.3, 1.3, 1.3, TEX.wood, null, -24.6, 0.65, 8.2, { line: 0.02 }); block(1.1, 1.1, 1.1, TEX.wood, 0xdcc0d0, -24.3, 1.85, 8.3, { line: 0.02 });
  part(new THREE.ConeGeometry(0.42, 1.1, 10), HOT, room, 21.5, 0.55, 8.2, { line: 0.05 }); part(box(1.0, 0.1, 1.0, 0.02), HOT, room, 21.5, 0.05, 8.2); part(cyl(0.36, 0.2, 10), WHITE, room, 21.5, 0.6, 8.2, { flat: true });
  function tree(x, z, h, r) { part(cyl(0.5, h, 8, 0.32), 0x6a4a5e, room, x, h / 2, z, { map: tiled(TEX.wood, 1, 3) }); [[0, 0, 1], [-0.9, -0.5, 0.75], [0.9, -0.4, 0.8], [0.2, 0.8, 0.7], [-0.5, 0.5, 0.6], [0.7, 0.5, 0.55], [0, -0.9, 0.7]].forEach(([dx, dy, k], i) => part(new THREE.IcosahedronGeometry(r * k, 1), [0x3da566, 0x4fc27a, 0x2f8a54][i % 3], room, x + dx * r, h + dy * r + r * 0.5, z + (i % 2) * 0.6, { flat: i > 2 })); for (let i = 0; i < 10; i++) part(ball(r * 0.14), 0x8fe89f, room, x + (rnd() - 0.5) * r * 2.2, h + r * 0.6 + (rnd() - 0.3) * r * 1.4, z + r * 0.9, { glow: true }); }
  tree(-41.5, 9, 9, 4.4); tree(22.5, 10.2, 5.2, 2.4);
  const palm = new THREE.Group(); palm.position.set(40.5, 0, 9.5); room.add(palm);
  for (let i = 0; i < 8; i++) part(cyl(0.38 - i * 0.02, 1.6, 8), i % 2 ? 0x7a566a : 0x6a4a5e, palm, Math.sin(i * 0.22) * 1.2, 0.8 + i * 1.5, 0);
  const fronds = []; for (let i = 0; i < 9; i++) { const f = new THREE.Group(); f.position.set(1.15, 12.6, 0); f.rotation.set(0, i * 0.7, 0); palm.add(f); const leaf = part(box(4.6, 0.14, 1.0, 0.06), i % 2 ? 0x3da566 : 0x4fc27a, f, 2.2, 0, 0, { flat: true }); leaf.rotation.z = -0.35; fronds.push(f); }
  // wires strung across the street
  const wire = (pts, c) => part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]))), 24, 0.07, 5), c, room, 0, 0, 0, { flat: true });
  wire([[-27.5, 21, 6.6], [-14, 19.2, 7.6], [0, 20.8, 7.4], [14, 19.4, 7.6], [27.5, 17.6, 6.6]], INK); wire([[-27.5, 24, 6.6], [0, 22.8, 6.8], [27.5, 18.2, 6.6]], INK);
  // the city behind: stacked blocks, tanks and green roofs
  [[-64, -50, 15, 0xc9bea0], [-49, -39, 21, 0x9fb8a8], [-37, -27, 13, 0xd6c9a6], [-25, -14, 22, 0x8fb0c4], [-12, 1, 19, 0xcdbf9c], [4, 15, 23, 0xa9c0a0], [17, 27, 14, 0xd9ccaa], [30, 41, 21, 0x9db4cc], [43, 56, 12, 0xc4b896], [57, 68, 19, 0x9fb8a8]].forEach(([x0, x1, h, c], i) => {
    const b = building(x0, x1, h, c, { z: -24 - (i % 2) * 5, depth: 8, rows: Math.round(h / 6), cols: Math.max(2, Math.round((x1 - x0) / 4.4)), shutter: [0x3b6e8a, 0x2f8a54, 0x7a566a][i % 3], ivy: [[0, 0, x1 - x0, 2 + (i % 3) * 2], [rnd() * 5, 6, 3, 8]] });
    if (i % 2 === 0) { part(cyl(1.5, 2.6, 12), i % 4 ? 0x7d95ff : 0x9aa3c4, room, b.cx - 2, b.roofY + 2.2, -24, { map: tiled(TEX.metal, 5, 1) }); part(new THREE.ConeGeometry(1.7, 0.9, 12), 0x5a6494, room, b.cx - 2, b.roofY + 3.9, -24); for (const dx of [-1, 1]) part(box(0.16, 1.0, 0.16, 0.02), STEEL, room, b.cx - 2 + dx, b.roofY + 0.5, -23); }
    else { block(3.4, 1.8, 3, TEX.brickRose, 0xd8c8d0, b.cx + 1.5, b.roofY + 1.1, -24); ac(b.cx - 2.2, b.roofY + 0.9, -22.5); }
    bush(b.cx + 3, b.roofY + 0.3, b.front - 1, 1.2, i % 3 === 0); bush(b.cx - 3.6, b.roofY + 0.3, b.front - 1.2, 0.9);
    vines(x0 + 0.5, x1 - 0.5, b.roofY + 0.2, b.front + 0.2, 3 + (i % 3) * 2);
  });
  // dark plant and ducting at the edges, cables sagging across the bottom
  const SLATE = 0x26343c, SLATE2 = 0x34464f;
  for (const s of [-1, 1]) {
    block(5, 9, 5, TEX.metal, SLATE, s * 44, 4.5, 15, { line: 0.01 }); block(4, 6, 4, TEX.concrete, SLATE2, s * 46.5, 12, 15.5); block(3.4, 4.4, 3.4, TEX.metal, SLATE, s * 44.5, 17.2, 15.5);
    part(cyl(0.7, 22, 8), SLATE2, room, s * 41.2, 11, 16.5, { map: tiled(TEX.metal, 1, 6) }); part(cyl(0.4, 16, 8), SLATE, room, s * 42.6, 9, 18);
    for (let i = 0; i < 4; i++) part(cyl(0.85, 0.5, 8), SLATE, room, s * 41.2, 3 + i * 5.2, 16.5);
    part(cyl(1.0, 0.24, 12), SLATE2, room, s * 44, 6.4, 17.56).rotation.x = Math.PI / 2; acs.push(part(box(1.6, 0.16, 0.06, 0.01), 0x4a5e68, room, s * 44, 6.4, 17.7, { flat: true }));
    vines(s > 0 ? 41.6 : -46.4, s > 0 ? 46.4 : -41.6, 9.2, 17.6, 4);
  }
  [[-42, -24, 2.4, 17], [-30, -8, 1.6, 18], [-12, 10, 2.0, 17.4], [6, 26, 1.4, 18.2], [22, 42, 2.6, 17]].forEach(([a, b, sag, z], i) => wire([[a, 1.6 + (i % 2), z], [(a + b) / 2, -sag, z + 0.4], [b, 1.2 + ((i + 1) % 2), z]], i % 2 ? SLATE : SLATE2));
  const fans = acs;

  /* ---------- stations ---------- */
  // charging bay
  part(cyl(PAD.r, 0.16, 28), TEAL, room, PAD.x, 0.08, PAD.z, { line: 0.02 });
  const padRing = part(new THREE.TorusGeometry(PAD.r * 0.62, 0.13, 8, 28), WHITE, room, PAD.x, 0.22, PAD.z, { glow: true }); padRing.rotation.x = Math.PI / 2;
  part(box(2.6, 6.4, 1.6), 0x2b3bbf, room, -21.8, 3.2, -4.6, { line: 0.02 }); solid(1.3, 3.2, 0.8, -21.8, 3.2, -4.6);
  const cells = [0, 1, 2, 3].map((i) => part(box(1.7, 0.9, 0.2, 0.05), MINT, room, -21.8, 1.4 + i * 1.25, -3.75, { glow: true }));
  part(new THREE.TorusGeometry(1.3, 0.1, 6, 16, Math.PI), INK, room, -20.6, 0.4, -2.6).rotation.y = 0.6;
  // arcade cabinet
  const arcadeMesh = part(box(2.2, 5.2, 1.8), HOT, room, -18.2, 2.6, -4.6, { line: 0.02 }); solid(1.1, 2.6, 0.9, -18.2, 2.6, -4.6);
  const arcadeTex = paint(16, 12, () => {}); part(box(1.7, 1.3, 0.1, 0.02), 0xffffff, room, -18.2, 3.7, -3.66, { glow: true, map: arcadeTex });
  part(box(1.9, 0.5, 0.7, 0.05), NAVY, room, -18.2, 2.5, -3.5); part(ball(0.16), YELLOW, room, -18.6, 2.9, -3.3, { glow: true }); part(ball(0.13), TEAL, room, -17.8, 2.86, -3.3, { glow: true });
  // basket
  for (const [dx, dz, w, d] of [[0, 0.95, 2.2, 0.2], [0, -0.95, 2.2, 0.2], [1, 0, 0.2, 2.0], [-1, 0, 0.2, 2.0]]) { part(box(w, 1.3, d, 0.05), MINT, room, BASKET.x + dx, 0.65, BASKET.z + dz, { line: 0.03 }); solid(w / 2, 0.65, d / 2, BASKET.x + dx, 0.65, BASKET.z + dz); }
  // parts crate with a delivery chute
  for (const [dx, dz, w, d] of [[0, 1.45, 3.3, 0.25], [0, -1.45, 3.3, 0.25], [1.52, 0, 0.25, 2.9], [-1.52, 0, 0.25, 2.9]]) { part(box(w, 1.9, d, 0.06), YELLOW, room, CRATE.x + dx, 0.95, CRATE.z + dz, { line: 0.02 }); solid(w / 2, 0.95, d / 2, CRATE.x + dx, 0.95, CRATE.z + dz); }
  solid(1.4, 0.15, 1.4, CRATE.x, 0.15, CRATE.z);
  part(box(1.5, 0.5, 0.06, 0.02), INK, room, CRATE.x, 1.2, CRATE.z + 1.6, { flat: true });
  part(cyl(0.9, 3.4, 12), STEEL, room, CRATE.x, 8.6, CRATE.z, { line: 0.03 }); part(cyl(1.15, 0.4, 12), 0x4a53b8, room, CRATE.x, 6.9, CRATE.z);
  const chuteLamp = part(ball(0.22), HOT, room, CRATE.x + 1.1, 7.4, CRATE.z + 0.6, { glow: true });
  // workbench, assembler, monitors, vice, lamp
  part(box(9.2, 1.9, 2.5), PLUM, room, BENCH.x, 1.0, BENCH.z, { line: 0.015 }); part(box(9.8, 0.4, 2.9, 0.1), WHITE, room, BENCH.x, 2.1, BENCH.z, { line: 0.015 });
  solid(4.9, 1.15, 1.45, BENCH.x, 1.15, BENCH.z);
  for (let i = 0; i < 4; i++) { part(box(1.9, 0.6, 0.1, 0.04), LILAC, room, BENCH.x - 3.3 + i * 2.2, 1.3, BENCH.z + 1.27, { flat: true }); part(box(0.5, 0.12, 0.14, 0.03), INK, room, BENCH.x - 3.3 + i * 2.2, 1.3, BENCH.z + 1.34, { flat: true }); }
  const machine = new THREE.Group(); machine.position.set(-5.0, 2.3, BENCH.z - 0.3); room.add(machine);
  part(box(2.7, 0.5, 2.0), BLUE, machine, 0, 0.25, 0, { line: 0.03 });
  part(box(0.4, 2.8, 0.5), BLUE, machine, -1.05, 1.6, -0.6); part(box(0.4, 2.8, 0.5), BLUE, machine, 1.05, 1.6, -0.6);
  part(box(2.9, 0.6, 1.0), 0x2a3fd1, machine, 0, 3.1, -0.5, { line: 0.03 });
  const press = part(box(1.3, 0.7, 1.1), YELLOW, machine, 0, 2.2, 0.1, { line: 0.04 }); part(cyl(0.16, 1.3, 8), WHITE, press, 0, 0.9, 0);
  const beacon = part(ball(0.28), HOT, machine, 1.05, 3.7, -0.5, { glow: true });
  solid(1.35, 0.25, 1.0, -5.0, 2.55, BENCH.z - 0.3);
  const codeTex = paint(24, 16, () => {});
  [[-1.6, 0.2], [0.2, -0.25]].forEach(([x, ry], i) => { const m = new THREE.Group(); m.position.set(BENCH.x + x + 0.2, 2.3, BENCH.z - 0.75); m.rotation.y = ry; room.add(m); part(box(1.7, 1.3, 0.25, 0.05), NAVY, m, 0, 1.0, 0, { line: 0.03 }); part(box(1.45, 1.05, 0.05, 0.01), 0xffffff, m, 0, 1.0, 0.14, { glow: true, map: i ? arcadeTex : codeTex }); part(cyl(0.12, 0.5, 6), STEEL, m, 0, 0.2, 0); });
  part(box(0.9, 0.5, 0.6), STEEL, room, 2.4, 2.55, BENCH.z + 0.6, { line: 0.04 }); part(cyl(0.07, 1.1, 6), INK, room, 2.4, 2.65, BENCH.z + 0.95).rotation.z = Math.PI / 2;
  part(cyl(0.08, 2.2, 6), STEEL, room, 2.6, 3.4, BENCH.z - 1); part(new THREE.ConeGeometry(0.6, 0.5, 12, 1, true), HOT, room, 2.2, 4.4, BENCH.z - 0.8, { line: 0.05 }).rotation.z = -0.5;
  // LED counter over the bench
  const counter = paint(128, 20, () => {});
  let built = 0, shipped = 0, energy = 0.8;
  function drawCounter() { const g = counter.userData.g; g.fillStyle = "#0b0a14"; g.fillRect(0, 0, 128, 20); g.font = "bold 13px monospace"; g.textBaseline = "middle"; g.fillStyle = "#e4f222"; g.fillText("BUILT " + String(built).padStart(3, "0"), 4, 11); g.fillStyle = "#ff5fa2"; g.fillText("SENT " + String(shipped).padStart(3, "0"), 68, 11); counter.needsUpdate = true; }
  drawCounter();
  part(box(8.6, 1.6, 0.3, 0.05), INK, room, BENCH.x + 0.8, 8.9, ROOM.z0 + 0.1); part(box(8.2, 1.28, 0.05, 0.01), 0xffffff, room, BENCH.x + 0.8, 8.9, ROOM.z0 + 0.3, { glow: true, map: counter });
  // shelf, dispatch tube
  for (const y of [2.63, 5.13]) { part(box(6.6, 0.24, 1.4, 0.06), WHITE, room, SHELF.x, y, SHELF.z - 0.05, { line: 0.015 }); solid(3.3, 0.12, 0.7, SHELF.x, y, SHELF.z - 0.05); for (const dx of [-2.9, 2.9]) part(box(0.2, 1.0, 1.0, 0.04), STEEL, room, SHELF.x + dx, y - 0.55, SHELF.z - 0.2, { flat: true }); }
  part(box(6.2, 0.5, 0.2, 0.04), HOT, room, SHELF.x, 7.4, ROOM.z0 + 0.1, { glow: true });
  part(cyl(0.7, 9, 12), 0x4a53b8, room, 14.6, 6.5, -4.9, { line: 0.02 }); part(cyl(0.9, 0.5, 12), STEEL, room, 14.6, 2.3, -4.9); part(cyl(0.9, 0.4, 12), STEEL, room, 14.6, 7.6, -4.9);
  // vending machine, jukebox, dance floor
  const vendTex = paint(20, 44, (g) => { g.fillStyle = "#7df3ff"; g.fillRect(0, 0, 20, 44); for (let r = 0; r < 5; r++) { g.fillStyle = "#1b1740"; g.fillRect(1, 7 + r * 7, 14, 1); for (let c = 0; c < 4; c++) { g.fillStyle = pick(["#ff5fa2", "#e4f222", "#95e199", "#c389fd", "#3d5bff"]); g.fillRect(2 + c * 3.5, 2 + r * 7, 2, 5); } } g.fillStyle = "#1b1740"; g.fillRect(16, 0, 4, 44); g.fillStyle = "#e4f222"; g.fillRect(17, 8, 2, 3); g.fillStyle = "#0b0a14"; g.fillRect(2, 38, 12, 4); });
  const vendMesh = part(box(2.6, 6.2, 1.8), 0xd8324f, room, 16.6, 3.1, -4.6, { line: 0.02 }); solid(1.3, 3.1, 0.9, 16.6, 3.1, -4.6);
  part(box(2.2, 5.4, 0.08, 0.01), 0xffffff, room, 16.6, 3.2, -3.66, { glow: true, map: vendTex });
  const tileTex = paint(32, 32, (g) => { for (let i = 0; i < 16; i++) { g.fillStyle = (i + (i >> 2)) % 2 ? "#ff5fa2" : "#eef0ff"; g.fillRect((i % 4) * 8, (i >> 2) * 8, 8, 8); } });
  const tile = new THREE.Mesh(cyl(DANCE.r, 0.14, 28), toon(0xffffff, tileTex)); tile.position.set(DANCE.x, 0.07, DANCE.z); tile.receiveShadow = true; room.add(tile);
  const juke = new THREE.Group(); juke.position.set(21.2, 0, -4.4); room.add(juke);
  part(box(3.0, 4.6, 1.8, 0.5), TEAL, juke, 0, 2.3, 0, { line: 0.02 }); part(box(2.2, 1.4, 0.1, 0.2), YELLOW, juke, 0, 3.5, 0.92, { glow: true });
  const speakers = [-0.7, 0.7].map((dx) => { const s = part(cyl(0.55, 0.12, 14), INK, juke, dx, 1.5, 0.94); s.rotation.x = Math.PI / 2; return s; });
  solid(1.5, 2.3, 0.9, 21.2, 2.3, -4.4);
  const discoBall = part(new THREE.IcosahedronGeometry(0.7, 1), WHITE, room, DANCE.x, 9.4, DANCE.z, { line: 0.04 }); part(cyl(0.04, 1.4, 4), STEEL, room, DANCE.x, 10.4, DANCE.z);
  // hanging lamps, ceiling fan, barrels, plants, cables, bunting, steam
  const lamps = [-14, -2, 10].map((x) => { const l = new THREE.Group(); l.position.set(x, 11, 1.5); room.add(l); part(cyl(0.04, 2.2, 4), INK, l, 0, -1.1, 0); part(new THREE.ConeGeometry(1.0, 0.8, 12, 1, true), HOT, l, 0, -2.4, 0, { line: 0.05 }); part(ball(0.3), 0xfff2b0, l, 0, -2.7, 0, { glow: true }); return l; });
  const fan = new THREE.Group(); fan.position.set(5, 10.6, 0.5); room.add(fan); part(cyl(0.3, 0.4, 8), STEEL, fan, 0, 0, 0); for (let i = 0; i < 3; i++) { const b = part(box(2.6, 0.06, 0.5, 0.02), WHITE, fan, 0, -0.1, 0, { flat: true }); b.rotation.y = i * 2.094; b.translateX(1.4); }
  [[-23.4, 1.0, -4.9, BLUE], [-23.2, 0.9, -3.2, HOT], [23.6, 1.0, -2.6, YELLOW]].forEach(([x, y, z, c]) => { part(cyl(0.8, 2.0, 12), c, room, x, y, z, { line: 0.03 }); part(cyl(0.83, 0.16, 12), INK, room, x, y + 0.5, z); solid(0.8, 1, 0.8, x, 1, z); });
  [[-7.2, -5.0], [6.6, -5.1], [23.6, -4.9]].forEach(([x, z]) => { part(cyl(0.6, 1.0, 10, 0.75), 0xd8324f, room, x, 0.5, z, { line: 0.04 }); for (let i = 0; i < 5; i++) { const lf = part(ball(0.5), i % 2 ? MINT : 0x4fc27a, room, x + Math.cos(i * 1.3) * 0.5, 1.5 + i * 0.36, z + Math.sin(i * 1.3) * 0.4, { flat: true }); lf.scale.set(0.6, 1.3, 0.6); } });
  const cable = (pts, c) => part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]))), 24, 0.09, 5), c, room, 0, 0, 0, { flat: true });
  cable([[-21, 0.1, -3.6], [-17, 0.1, -2.4], [-12, 0.1, -2.9], [-7, 0.1, -3.1]], HOT); cable([[2.8, 0.1, -3.2], [7, 0.1, -2.7], [13, 0.1, -3.3], [15.5, 0.1, -3.7]], YELLOW);
  cable([[-25, 10.9, 3], [-12, 10.2, 3.4], [0, 10.8, 3], [12, 10.3, 3.4], [25, 10.9, 3]], INK);
  const flags = []; for (let x = -22; x <= 22; x += 2.2) { const f = part(new THREE.ConeGeometry(0.42, 0.9, 3), pick([HOT, YELLOW, TEAL, LILAC, WHITE]), room, x, 10.4 + 0.4 * Math.cos(x * 0.26), 3.3, { flat: true }); f.rotation.x = Math.PI; flags.push(f); }
  const steam = [0, 1, 2].map(() => part(ball(0.3), WHITE, room, 14.6, 11.6, -4.9, { glow: true }));

  /* ---------- things that can be thrown about ---------- */
  const ents = [], pickables = [];
  function ent(kind, mesh, shape, mass, x, y, z, o) {
    o = o || {};
    const body = new CANNON.Body({ mass, shape, position: V(x, y, z), material: o.material || world.defaultMaterial, linearDamping: 0.06, angularDamping: 0.35, allowSleep: true, sleepSpeedLimit: 0.35, sleepTimeLimit: 0.5 });
    if (kind === "part" || kind === "can") body.collisionFilterGroup = 4;      // the robot drives through small bits
    world.addBody(body);
    const e = { kind, mesh, body, held: false, carried: false, rest: 1, skip: 0, slot: o.slot };
    mesh.traverse((m) => { m.userData.ent = e; });
    scene.add(mesh); ents.push(e); pickables.push(mesh);
    return e;
  }
  function removeEnt(e) { if (!e.carried) world.removeBody(e.body); scene.remove(e.mesh); ents.splice(ents.indexOf(e), 1); pickables.splice(pickables.indexOf(e.mesh), 1); }
  const CART_COLORS = [HOT, YELLOW, MINT, LILAC, WHITE, SKY, TEAL];
  function makeCart(slot, x, y, z) {
    const g = new THREE.Group(), c = CART_COLORS[built % CART_COLORS.length];
    part(box(0.84, 1.2, 0.34, 0.07), c, g, 0, 0, 0, { line: 0.07 });
    part(box(0.56, 0.36, 0.05, 0.02), c === HOT || c === LILAC || c === SKY ? WHITE : INK, g, 0, 0.22, 0.18, { flat: true });
    part(box(0.62, 0.12, 0.36, 0.02), INK, g, 0, -0.55, 0, { flat: true });
    return ent("cart", g, new CANNON.Box(V(0.42, 0.6, 0.17)), 0.5, x, y, z, { slot });
  }
  function makePart(x, y, z) {
    const g = new THREE.Group(), k = (Math.random() * 3) | 0, c = [LILAC, MINT, SKY][k]; let shape;
    if (k === 0) { part(box(0.9, 0.9, 0.9, 0.12), c, g, 0, 0, 0, { line: 0.07 }); part(ball(0.16), WHITE, g, 0, 0.45, 0, { flat: true }); shape = new CANNON.Box(V(0.45, 0.45, 0.45)); }
    else if (k === 1) { part(cyl(0.45, 0.9, 12), c, g, 0, 0, 0, { line: 0.07 }); part(cyl(0.47, 0.14, 12), INK, g, 0, 0, 0, { flat: true }); shape = new CANNON.Cylinder(0.45, 0.45, 0.9, 10); }
    else { part(box(1.2, 0.46, 1.2, 0.08), c, g, 0, 0, 0, { line: 0.06 }); part(cyl(0.22, 0.5, 8), INK, g, 0, 0, 0, { flat: true }); shape = new CANNON.Box(V(0.6, 0.23, 0.6)); }
    return ent("part", g, shape, 0.7, x, y, z);
  }
  const slots = SHELF.ys.flatMap((y) => SHELF.xs.map((x) => ({ x, y, z: SHELF.z, cart: null })));
  const skillNames = Object.keys(window.SKILL_FLOWS || { "verify-work": 1 });
  function newCart(x, y, z) { const s = slots.find((q) => !q.cart), c = makeCart(s, x, y, z); if (s) s.cart = c; built++; drawCounter(); return c; }
  for (let i = 0; i < 3; i++) { const s = slots[i]; s.cart = makeCart(s, s.x, s.y, s.z); built++; }
  drawCounter();
  for (let i = 0; i < 3; i++) makePart(CRATE.x - 0.7 + i * 0.7, 0.9 + i * 0.3, CRATE.z + (i - 1) * 0.5);
  makePart(-13, 0.6, 2.2); makePart(6.4, 0.6, 1.6); makePart(15, 0.6, 2.6);
  [[HOT, -6, 3.4], [YELLOW, 12.5, 2.8]].forEach(([c, x, z]) => { const g = new THREE.Group(); part(ball(0.62), c, g, 0, 0, 0, { line: 0.07 }); part(new THREE.TorusGeometry(0.62, 0.07, 6, 16), WHITE, g, 0, 0, 0, { flat: true }); ent("ball", g, new CANNON.Sphere(0.62), 0.5, x, 0.7, z, { material: bouncy }); });
  const mg = new THREE.Group(); part(cyl(0.34, 0.66, 12), WHITE, mg, 0, 0, 0, { line: 0.08 }); part(new THREE.TorusGeometry(0.22, 0.07, 6, 10), WHITE, mg, 0.4, 0, 0, { flat: true }); part(cyl(0.27, 0.05, 10), 0x5a3b2a, mg, 0, 0.32, 0, { flat: true });
  ent("mug", mg, new CANNON.Cylinder(0.34, 0.34, 0.66, 10), 0.4, MUG[0], MUG[1], MUG[2]);
  const wr = new THREE.Group(); part(box(1.5, 0.2, 0.3, 0.05), STEEL, wr, 0, 0, 0, { line: 0.1 }); part(box(0.5, 0.24, 0.6, 0.05), STEEL, wr, 0.7, 0, 0, { line: 0.1 }); part(box(0.6, 0.22, 0.34, 0.05), HOT, wr, -0.5, 0, 0, { flat: true });
  ent("tool", wr, new CANNON.Box(V(0.8, 0.12, 0.3)), 0.6, 9, 0.4, 3.4);
  [0, 1, 2].forEach((i) => { const g = new THREE.Group(); part(box(1.5, 1.5, 1.5, 0.1), [WHITE, LILAC, TEAL][i], g, 0, 0, 0, { line: 0.05 }); part(box(1.54, 0.26, 1.54, 0.02), HOT, g, 0, 0, 0, { flat: true }); ent("box", g, new CANNON.Box(V(0.75, 0.75, 0.75)), 1.4, STACK.x, 0.76 + i * 1.52, STACK.z, { slot: i }); });

  function homeOf(e) {
    if (e.kind === "cart") return e.slot ? [e.slot.x, e.slot.y, e.slot.z] : [SHELF.x, 1, 0];
    if (e.kind === "part") return [CRATE.x + (Math.random() - 0.5), 3.0, CRATE.z + (Math.random() - 0.5) * 0.8];
    if (e.kind === "ball" || e.kind === "can") return [BASKET.x + (Math.random() - 0.5) * 0.6, 1.8, BASKET.z];
    if (e.kind === "mug") return MUG;
    if (e.kind === "tool") return TRAY;
    return [STACK.x, 0.76 + e.slot * 1.52, STACK.z];
  }
  const standFor = (e) => STAND[{ cart: "shelf", part: "crate", ball: "basket", can: "basket", mug: "mug", tool: "tray", box: "stack" }[e.kind]];
  function atHome(e) {
    const p = e.body.position;
    if (e.kind === "cart") return !!e.slot && Math.hypot(p.x - e.slot.x, p.y - e.slot.y, p.z - e.slot.z) < 0.6;
    if (e.kind === "part") return Math.abs(p.x - CRATE.x) < 1.45 && Math.abs(p.z - CRATE.z) < 1.4 && p.y < 3;
    if (e.kind === "ball" || e.kind === "can") return Math.abs(p.x - BASKET.x) < 1 && Math.abs(p.z - BASKET.z) < 1 && p.y < 2.2;
    if (e.kind === "mug" || e.kind === "tool") return p.y > 2.2 && p.y < 3.4 && Math.abs(p.x - BENCH.x) < 4.8 && Math.abs(p.z - BENCH.z) < 1.4;
    return Math.hypot(p.x - STACK.x, p.z - STACK.z) < 0.8 && Math.abs(p.y - (0.76 + e.slot * 1.52)) < 0.5;
  }
  const WORDS = { cart: "cartridge", part: "part", ball: "ball", can: "can", mug: "mug", tool: "wrench", box: "box" },
    WHERE = { cart: "back on the shelf", part: "in the parts crate", ball: "in the basket", can: "in the basket", mug: "on the bench", tool: "on the bench", box: "on the stack" };

  /* ---------- sparks ---------- */
  const SP = 90, spPos = new Float32Array(SP * 3), spVel = new Float32Array(SP * 3), spLife = new Float32Array(SP);
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute("position", new THREE.BufferAttribute(spPos, 3));
  const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ color: YELLOW, size: 3, sizeAttenuation: false })); sparks.frustumCulled = false; scene.add(sparks);
  let spNext = 0;
  function burst(x, y, z, n, power) { for (let i = 0; i < n; i++) { const k = spNext++ % SP; spPos.set([x, y, z], k * 3); spVel.set([(Math.random() - 0.5) * power, Math.random() * power, (Math.random() - 0.5) * power], k * 3); spLife[k] = 0.5 + Math.random() * 0.5; } }

  // water, for the tank and the hydrant
  const WN = 80, wPos = new Float32Array(WN * 3), wVel = new Float32Array(WN * 3), wLife = new Float32Array(WN);
  const wGeo = new THREE.BufferGeometry(); wGeo.setAttribute("position", new THREE.BufferAttribute(wPos, 3));
  const water = new THREE.Points(wGeo, new THREE.PointsMaterial({ color: 0x8fd0f6, size: 3, sizeAttenuation: false })); water.frustumCulled = false; scene.add(water);
  let wNext = 0, leak = null;
  function splash(x, y, z, n, vx) { for (let i = 0; i < n; i++) { const k = wNext++ % WN; wPos.set([x, y, z], k * 3); wVel.set([vx + (Math.random() - 0.5) * 3, 2 + Math.random() * 4, 2 + Math.random() * 2], k * 3); wLife[k] = 1.4; } }
  function makeCan(x, y, z) { const g = new THREE.Group(), c = pick([HOT, TEAL, YELLOW, SKY]); part(cyl(0.28, 0.7, 10), c, g, 0, 0, 0, { line: 0.1 }); part(cyl(0.29, 0.16, 10), WHITE, g, 0, 0.05, 0, { flat: true }); return ent("can", g, new CANNON.Cylinder(0.28, 0.28, 0.7, 8), 0.3, x, y, z); }
  const taps = []; function tappable(mesh, fn, label) { mesh.traverse((m) => { m.userData.tap = fn; }); taps.push(mesh); void label; }

  /* ---------- the robot: a CRT-headed mechanic on treads ---------- */
  const bot = new THREE.Group(); scene.add(bot);
  const wheels = [];
  for (const s of [-1, 1]) {
    part(box(0.72, 0.78, 2.3, 0.3), INK, bot, s * 0.86, 0.39, 0, { line: 0.04 });
    part(box(0.76, 0.2, 1.5, 0.05), STEEL, bot, s * 0.86, 0.39, 0, { flat: true });
    for (const z of [-0.72, 0, 0.72]) { const w = part(cyl(0.27, 0.12, 8), z ? HOT : YELLOW, bot, s * 1.25, 0.39, z); w.rotation.z = Math.PI / 2; wheels.push(w); }
  }
  part(box(1.5, 0.42, 1.8, 0.12), PLUM, bot, 0, 0.82, 0);
  const torso = part(cyl(0.92, 1.25, 14, 0.78), TEAL, bot, 0, 1.6, 0, { line: 0.04 });
  part(cyl(0.94, 0.2, 14), INK, bot, 0, 1.1, 0);
  part(cyl(0.34, 0.1, 12), WHITE, bot, 0, 1.75, 0.82).rotation.x = Math.PI / 2;
  const needle = part(box(0.06, 0.3, 0.04, 0.01), HOT, bot, 0, 1.75, 0.9, { glow: true });
  const leds = [HOT, YELLOW, MINT].map((c, i) => part(ball(0.09), c, bot, -0.3 + i * 0.3, 1.32, 0.88, { glow: true }));
  part(box(1.3, 1.0, 0.6, 0.12), BLUE, bot, 0, 1.7, -0.95, { line: 0.04 });        // toolbox pack
  part(box(0.14, 1.1, 0.14, 0.03), STEEL, bot, -0.35, 2.5, -0.95); part(box(0.4, 0.3, 0.16, 0.04), STEEL, bot, -0.35, 3.0, -0.95);
  const prop = part(box(0.9, 0.06, 0.14, 0.02), YELLOW, bot, 0.35, 2.4, -0.95, { flat: true }); part(cyl(0.05, 0.3, 5), INK, bot, 0.35, 2.25, -0.95);
  const arms = [-1, 1].map((s) => {
    const g = new THREE.Group(); g.position.set(s * 1.06, 2.0, 0); bot.add(g);
    part(ball(0.3), HOT, g, 0, 0, 0, { line: 0.06 });
    part(box(0.28, 0.8, 0.28, 0.08), STEEL, g, 0, -0.5, 0);
    part(ball(0.2), INK, g, 0, -0.95, 0);
    part(box(0.24, 0.6, 0.24, 0.06), WHITE, g, 0, -1.3, 0);
    g.userData.claw = [-1, 1].map((k) => part(box(0.12, 0.46, 0.3, 0.03), YELLOW, g, k * 0.16, -1.82, 0, { line: 0.1 }));
    return g;
  });
  const neck = part(cyl(0.2, 1, 8), STEEL, bot, 0, 2.5, 0); part(cyl(0.3, 0.14, 8), INK, bot, 0, 2.28, 0);
  const head = new THREE.Group(); bot.add(head);
  part(box(2.5, 1.85, 1.5, 0.22), WHITE, head, 0, 0.95, 0.05, { line: 0.035 });
  part(box(1.7, 1.3, 0.8, 0.2), 0xc9cdea, head, 0, 0.95, -0.95);
  part(box(1.84, 1.5, 0.12, 0.1), INK, head, -0.2, 0.95, 0.78);
  part(box(0.36, 1.5, 0.1, 0.04), 0xc9cdea, head, 0.96, 0.95, 0.8, { flat: true });
  part(cyl(0.11, 0.1, 8), HOT, head, 0.96, 1.4, 0.86).rotation.x = Math.PI / 2; part(cyl(0.11, 0.1, 8), YELLOW, head, 0.96, 1.05, 0.86).rotation.x = Math.PI / 2;
  for (let i = 0; i < 3; i++) part(box(0.24, 0.04, 0.04, 0.01), INK, head, 0.96, 0.62 - i * 0.12, 0.86, { flat: true });
  part(box(0.9, 0.16, 0.5, 0.06), TEAL, head, 0, 1.94, 0);
  const ears = [-1, 1].map((s) => { const a = new THREE.Group(); a.position.set(s * 0.18, 2.0, 0); a.rotation.z = -s * 0.5; head.add(a); part(cyl(0.035, 1.3, 4), STEEL, a, 0, 0.65, 0); part(ball(0.13), s > 0 ? HOT : YELLOW, a, 0, 1.32, 0, { glow: true }); return a; });
  const magnet = new THREE.Group(); magnet.position.set(0, 3.5, 0); magnet.rotation.z = Math.PI; magnet.visible = false; head.add(magnet);
  part(new THREE.TorusGeometry(0.75, 0.24, 8, 14, Math.PI), 0xd94b4b, magnet, 0, 0, 0, { line: 0.06 });
  for (const sx of [-0.75, 0.75]) part(box(0.5, 0.34, 0.5, 0.05), WHITE, magnet, sx, -0.16, 0, { line: 0.06 });
  const swarm = [];
  const faceTex = paint(11, 7, (g) => { g.fillStyle = "#06140c"; g.fillRect(0, 0, 11, 7); });
  const faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.26), new THREE.MeshBasicMaterial({ map: faceTex })); faceMesh.position.set(-0.2, 0.95, 0.85); head.add(faceMesh);
  function paintFace(frame) {
    const g = faceTex.userData.g; g.fillStyle = "#0a1f14"; g.fillRect(0, 0, 11, 7); g.fillStyle = "#9dff6e";
    if (frame) for (let r = 0; r < 7; r++) for (let c = 0; c < 11; c++) if (frame[r].charAt(c) === "#") g.fillRect(c, r, 1, 1);
    faceTex.needsUpdate = true;
  }
  const bridge = window.MASCOT_FACE = window.MASCOT_FACE || {};
  bridge.draw = paintFace; paintFace(bridge.frame || null);
  const mood = (name, ms) => { if (bridge.show) bridge.show(name, ms || 0); };
  const calmFace = () => { if (bridge.rest) bridge.rest(); };
  const say = (text) => { if (ui && ui.thought && ui.thought.textContent !== text) ui.thought.textContent = text; };

  const rb = new CANNON.Body({ mass: 9, shape: new CANNON.Box(V(1.1, REST_Y, 0.95)), position: V(-6, REST_Y, LANE), material: slick, fixedRotation: true, linearDamping: 0.02, allowSleep: false, collisionFilterMask: ~4 });
  rb.updateMassProperties(); world.addBody(rb);
  const robot = { kind: "robot", body: rb, mesh: bot, held: false };
  bot.traverse((m) => { m.userData.ent = robot; }); pickables.push(bot);
  let yaw = 0, yawTo = 0, gait = 0, squash = 0, pose = "idle", carrying = null, airborne = false, fallV = 0, shake = 0, neckLen = 0.4, grip = 0;
  const hands = new THREE.Vector3(), tmp = new THREE.Vector3();
  rb.addEventListener("collide", (e) => {
    const hit = Math.abs(e.contact.getImpactVelocityAlongNormal());
    if (e.body.mass > 0 && hit > 9 && !robot.held) brain.interrupt("ow", () => { mood("dizzy", 1100); rb.velocity.y = 9; say("> ow. who threw that?"); });
  });

  /* ---------- the brain ----------
     A plan is a queue of small steps. When the queue is empty the robot looks at
     the room and chooses what matters most: charge, tidy, ship, or build. Anything
     the user does (grab it, grab what it is carrying, hit it) clears the plan. */
  let now = 0;
  const brain = {
    plan: [], step: null, t: 0, idleFor: 0,
    interrupt(why, react) { this.plan = []; this.step = null; pose = "idle"; if (carrying) dropCarried();
      while (swarm.length) { const e = swarm.pop(); putDown(e, [e.mesh.position.x, e.mesh.position.y, e.mesh.position.z]); } if (react) this.plan.push({ wait: 1.1, enter: react }); },
    think() {
      if (energy < 0.12) return this.push(
        { enter: () => { say("> battery low. heading to the charger"); mood("sleep"); } }, { go: [PAD.x, PAD.z], reach: 0.9 },
        { wait: 5, pose: "charge", face: 0, enter: () => say("> charging"), tick: (dt) => { energy = Math.min(1, energy + dt / 4.5); }, exit: () => { calmFace(); mood("happy", 900); } });
      // Too many loose bits to carry one at a time: out comes the magnet. It hoovers
      // them into orbit round its head, drives the lot to the crate and drops them in.
      const spill = ents.filter(isBit).filter((e) => e.rest > 0.4);
      if (spill.length >= 4) return this.push(
        { enter: () => { say("> " + spill.length + " loose bits. getting the magnet out"); mood("bolt"); } },
        { go: [THREE.MathUtils.clamp(rb.position.x, -15, 15), LANE + 0.6], reach: 1.2 },
        { wait: 3.4, pose: "magnet", face: 0, tick: pull, exit: calmFace },
        { go: STAND.crate, reach: 0.9, enter: () => say("> got " + swarm.length + ". back in the box, all of you") },
        { wait: 2.6, pose: "magnet", face: Math.PI, tick: () => unload(false), exit: () => { while (swarm.length) unload(true); mood("check", 1000); say("> floor's clear"); } });
      const mess = ents.filter((e) => !e.carried && !e.held && e.rest > 0.5 && e.skip < now && !atHome(e)).sort((a, b) => dist2(a.body.position) - dist2(b.body.position))[0];
      if (mess) {
        const h = homeOf(mess), st = standFor(mess);
        return this.push(
          { enter: () => { say("> that " + WORDS[mess.kind] + " belongs " + WHERE[mess.kind]); mood("think"); } },
          { go: () => reachPoint(mess), reach: 2.6, watch: mess, giveUp: () => { mess.skip = now + 8; } },
          { wait: 0.35, pose: "bend", exit: () => pickUp(mess) },
          { go: st, reach: 0.7, holding: mess }, { wait: 0.4, pose: "reach", face: Math.PI, holding: mess, exit: () => { putDown(mess, h); calmFace(); mood("happy", 700); } });
      }
      if (slots.every((s) => s.cart && atHome(s.cart))) return this.push(
        { go: STAND.shelf, reach: 0.8, enter: () => say("> shelf is full. sending these out") },
        { wait: 2.0, pose: "cheer", face: Math.PI, enter: () => mood("heart", 1900), tick: () => { const s = slots.find((q) => q.cart); if (s && Math.random() < 0.12) ship(s); }, exit: () => slots.forEach((s) => { if (s.cart) ship(s); }) });
      if (this.idleFor > 0 && Math.random() < 0.16) return this.push({ wait: 1.6, pose: "wave", face: 0, enter: () => { say("> hi. drag me somewhere"); mood("happy", 1500); } });
      const name = skillNames[built % skillNames.length]; let made = null, raw = null;
      return this.push(
        { enter: () => say("> need a part for " + name) }, { go: STAND.crate, reach: 0.7 },
        { wait: 0.45, pose: "bend", face: Math.PI, exit: () => { raw = ents.find((e) => e.kind === "part" && !e.held && atHome(e)) || makePart(CRATE.x, 1.4, CRATE.z); pickUp(raw); } },
        { go: STAND.bench, reach: 0.7, holding: () => raw },
        { wait: 0.3, pose: "reach", face: Math.PI, holding: () => raw, exit: () => { if (carrying === raw) { carrying = null; removeEnt(raw); } } },
        { wait: 2.6, pose: "build", face: Math.PI, enter: () => { say("> building " + name); mood("think"); }, tick: () => { if (Math.random() < 0.5) burst(-5, 3.4, BENCH.z, 2, 7); },
          exit: () => { made = newCart(0, -50, 0); pickUp(made); calmFace(); mood("check", 900); burst(-5, 3.8, BENCH.z, 18, 9); } },
        { go: STAND.shelf, reach: 0.7, holding: () => made, enter: () => say("> " + name + " is ready. shelving it") },
        { wait: 0.4, pose: "reach", face: Math.PI, holding: () => made, exit: () => { if (carrying === made) putDown(made, homeOf(made)); } });
    },
    push() { for (const s of arguments) this.plan.push(s); },
    update(dt) {
      if (robot.held || airborne) return;
      if (!this.step) {
        if (!this.plan.length) { this.think(); this.idleFor += dt; }
        this.step = this.plan.shift(); this.t = 0;
        if (!this.step) return;
        if (this.step.enter) this.step.enter();
        if (this.step.wait == null && !this.step.go) { this.step = null; return; }
      }
      const s = this.step; this.t += dt;
      const need = typeof s.holding === "function" ? s.holding() : s.holding;
      if (need && carrying !== need) { this.interrupt("lost", () => { mood("alert", 900); say("> hey, I was carrying that"); }); return; }
      if (s.watch && (s.watch.held || s.watch.carried || atHome(s.watch))) { this.interrupt(); return; }
      if (s.go) {
        const g = typeof s.go === "function" ? s.go() : s.go; pose = "walk";
        if (steer(g[0], g[1], s.reach || 0.6)) { pose = "idle"; this.step = null; }
        else if (this.t > 9) { if (s.giveUp) s.giveUp(); this.interrupt("stuck", () => { mood("dizzy", 900); say("> can't get there. trying something else"); rb.velocity.y = 12; }); }
      } else {
        pose = s.pose || "idle"; drive(0, 0);
        if (s.face != null) yawTo = s.face;
        if (s.tick) s.tick(dt);
        if (this.t >= s.wait) { if (s.exit) s.exit(); pose = "idle"; this.step = null; }
      }
    }
  };
  const MAX_PARTS = 14, MAX_SMALL = 6, count = (kind) => ents.reduce((n, e) => n + (e.kind === kind ? 1 : 0), 0);
  const isBit = (e) => (e.kind === "part" || e.kind === "can") && !e.carried && !e.held && !atHome(e);
  function pull() {
    for (const e of ents.filter(isBit)) {
      const b = e.body, dx = rb.position.x - b.position.x, dy = rb.position.y + 4.4 - b.position.y, dz = rb.position.z - b.position.z, d = Math.hypot(dx, dy, dz) || 1;
      if (d < 1.6 && swarm.length < 16) { world.removeBody(b); e.carried = true; swarm.push(e); burst(b.position.x, b.position.y, b.position.z, 3, 5); continue; }
      const k = Math.min(20, 5 + d * 1.6) / d; b.wakeUp(); b.velocity.set(dx * k, dy * k + 1.5, dz * k); b.angularVelocity.set(3, 4, 2);
    }
  }
  function unload(all) {                          // (not "release": that is the pointer handler)
    if (!all && Math.random() > 0.13) return;
    const e = swarm.pop(); if (!e) return;
    const full = ents.filter((q) => q.kind === "part" && !q.carried && atHome(q)).length >= 6;
    if (e.kind === "part" && full) { burst(e.mesh.position.x, e.mesh.position.y, e.mesh.position.z, 8, 7); removeEnt(e); }   // the crate is full: recycle the rest
    else putDown(e, homeOf(e));
  }
  function ship(s) { const p = s.cart.body.position; burst(p.x, p.y, p.z, 9, 9); removeEnt(s.cart); s.cart = null; shipped++; drawCounter(); }
  const dist2 = (p) => (p.x - rb.position.x) ** 2 + (p.z - rb.position.z) ** 2;
  const reachPoint = (e) => [THREE.MathUtils.clamp(e.body.position.x, ROOM.x0 + 1.6, ROOM.x1 - 1.6), THREE.MathUtils.clamp(e.body.position.z, -1.6, ROOM.z1 - 1.4)];
  function drive(vx, vz) { rb.velocity.x += (vx - rb.velocity.x) * 0.2; rb.velocity.z += (vz - rb.velocity.z) * 0.2; }
  function steer(x, z, reach) {
    const far = Math.hypot(x - rb.position.x, z - rb.position.z);
    if (far < reach) { drive(0, 0); return true; }
    // Furniture lines the back wall, so sideways trips go out to the lane, along it, then back in.
    if (Math.abs(x - rb.position.x) > 1.3 && far > reach + 1) {
      if (rb.position.z < LANE - 1.2) { x = rb.position.x; z = LANE; }
      else if (z < LANE - 1.2) z = LANE;
    }
    const dx = x - rb.position.x, dz = z - rb.position.z, d = Math.hypot(dx, dz) || 1, speed = Math.min(8.5, 2.5 + d * 2.5);
    drive(dx / d * speed, dz / d * speed); yawTo = Math.atan2(dx, dz);
    return false;
  }
  function pickUp(e) { if (!e || e.held || ents.indexOf(e) < 0) return; if (carrying) dropCarried(); world.removeBody(e.body); e.carried = true; carrying = e; }
  function putDown(e, at) {
    if (carrying === e) carrying = null;
    if (!e.carried) return;
    e.carried = false; e.rest = 0;
    e.body.position.set(at[0], at[1], at[2]); e.body.velocity.setZero(); e.body.angularVelocity.setZero(); e.body.quaternion.set(0, 0, 0, 1);
    world.addBody(e.body); e.body.wakeUp();
  }
  function dropCarried() { const e = carrying; if (e) putDown(e, [hands.x, hands.y, hands.z]); }

  function landed(v) {
    const x = rb.position.x, z = rb.position.z, back = z < 0.4;
    squash = Math.min(1, v / 26); burst(x, 0.3, z, Math.min(14, v | 0), 5);
    brain.plan = []; brain.step = null;
    if (Math.hypot(x - PAD.x, z - PAD.z) < PAD.r + 0.5) brain.push({ wait: 2.6, pose: "charge", face: 0, enter: () => { say("> ooh, the charger. topping up"); mood("bolt"); }, tick: (dt) => { energy = Math.min(1, energy + dt / 2); }, exit: () => { calmFace(); mood("happy", 900); } });
    else if (Math.hypot(x - DANCE.x, z - DANCE.z) < DANCE.r + 0.5) brain.push({ wait: 4.6, pose: "dance", enter: () => { say("> this is my song"); mood("note"); }, exit: calmFace });
    else if (Math.abs(x - CRATE.x) < 2.6 && back) brain.push({ wait: 1.3, pose: "bend", face: Math.PI, enter: () => { say("> rummaging"); mood("wow", 1200); }, exit: () => { for (let i = 0; i < Math.min(3, MAX_PARTS - count("part")); i++) { const p = makePart(CRATE.x, 3, CRATE.z); p.body.velocity.set((Math.random() - 0.3) * 14, 13, 4 + Math.random() * 5); p.body.angularVelocity.set(4, 3, 2); } } });
    else if (Math.abs(x - SHELF.x) < 3.4 && back) brain.push({ wait: 1.5, pose: "cheer", face: Math.PI, enter: () => { say("> " + slots.filter((s) => s.cart).length + " of 8 on the shelf"); mood("check", 1400); } });
    else if (Math.abs(x + 18.2) < 1.6 && back) brain.push({ wait: 2.4, pose: "build", face: Math.PI, enter: () => { say("> one quick game"); mood("wow", 2300); } });
    else if (Math.abs(x - 16.6) < 1.7 && back) brain.push({ wait: 1.6, pose: "reach", face: Math.PI, enter: () => { say("> no coins. robots don't get paid"); mood("alert", 1500); } });
    else if (x > BENCH.x - 5 && x < BENCH.x + 5 && back) brain.push({ enter: () => { say("> right, back to work"); mood("happy", 700); } });
    else if (v > 17) brain.push({ wait: 1.3, enter: () => { mood("dizzy", 1300); say("> ...that was high"); } });
    else brain.push({ wait: 0.5, enter: () => { mood("happy", 600); say("> thanks for the lift"); } });
  }

  /* ---------- pointer: look, grab, throw ---------- */
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), cursor = new THREE.Vector3(0, 3, 2), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  let drag = null, cursorMoved = -9, downAt = null;
  function aim(e) { const b = canvas.getBoundingClientRect(); ptr.set((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height * 2 - 1)); ray.setFromCamera(ptr, camera); }
  function hitEnt() { for (const h of ray.intersectObjects(pickables, true)) { const e = h.object.userData.ent; if (e) return e; } return null; }
  function onMove(e) {
    aim(e); cursorMoved = now;
    plane.constant = -(drag ? drag.z : 1); if (!ray.ray.intersectPlane(plane, tmp)) return;
    cursor.copy(tmp);
    if (drag) {
      const tx = THREE.MathUtils.clamp(tmp.x, ROOM.x0 + 1.2, ROOM.x1 - 1.2), ty = THREE.MathUtils.clamp(tmp.y, drag.min, ROOM.top - drag.head);
      if (drag.ent === robot) { const dir = Math.sign(tx - drag.target.x); if (dir && dir !== drag.dir && Math.abs(tx - drag.target.x) > 0.5) shake++; drag.dir = dir || drag.dir; }
      drag.target.set(tx, ty, drag.z);
    } else if (e.pointerType !== "touch") canvas.style.cursor = hitEnt() ? "grab" : (ray.intersectObjects(taps, true).length ? "pointer" : "default");
  }
  function grab(e) {
    aim(e); const hit = hitEnt();
    if (!hit) { const h = ray.intersectObjects(taps, true)[0]; if (h && h.object.userData.tap) h.object.userData.tap(h.point); return false; }
    if (hit.carried) { hit.carried = false; world.addBody(hit.body); hit.body.position.copy(hit.mesh.position); if (carrying === hit) carrying = null; const si = swarm.indexOf(hit); if (si >= 0) swarm.splice(si, 1); }
    hit.held = true; hit.body.wakeUp();
    const isBot = hit === robot, z = Math.max(hit.body.position.z, isBot ? 0.8 : -1.5);
    drag = { ent: hit, z, min: isBot ? REST_Y + 0.6 : 0.9, head: isBot ? 3.2 : 1.2, target: new THREE.Vector3(hit.body.position.x, Math.max(hit.body.position.y, isBot ? REST_Y + 1.4 : 1.6), z), dir: 0 };
    downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; canvas.style.cursor = "grabbing";
    if (isBot) { brain.interrupt("grabbed"); shake = 0; mood("wow"); say("> whoa. put me down somewhere good"); airborne = true; fallV = 0; }
    return true;
  }
  function release(e) {
    if (!drag) return;
    const d = drag; drag = null; d.ent.held = false; d.ent.rest = 0; canvas.style.cursor = "grab";
    if (d.ent === robot) { calmFace(); if (downAt && performance.now() - downAt.t < 260 && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6) { rb.velocity.set(0, 15, 0); mood("heart", 1100); say("> hello!"); } }
  }
  canvas.addEventListener("pointerdown", (e) => { if (grab(e)) { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} e.preventDefault(); } });
  canvas.addEventListener("touchstart", (e) => { aim(e.touches[0]); if (hitEnt()) e.preventDefault(); }, { passive: false });
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", release); window.addEventListener("pointercancel", release);

  /* ---------- low-resolution target and the screen pass ---------- */
  const target = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const post = new THREE.ShaderMaterial({
    uniforms: { tMap: { value: target.texture }, uRes: { value: new THREE.Vector2(4, 4) }, uTime: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }",
    fragmentShader: `
      uniform sampler2D tMap; uniform vec2 uRes; uniform float uTime; uniform vec3 uTint; varying vec2 vUv;
      float bayer(vec2 p){ vec2 q = mod(floor(p), 4.); float i = q.x + q.y * 4.;
        float m[16]; m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
        float v = 0.; for (int k = 0; k < 16; k++) if (float(k) == i) v = m[k]; return v / 16.; }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 cell = floor(vUv * uRes), px = (cell + .5) / uRes;
        vec3 col = texture2D(tMap, px).rgb * uTint;
        float lum = dot(col, vec3(.299, .587, .114));
        col = mix(vec3(lum), col, 1.16);                                   // a little more colour
        col += (lum - .45) * vec3(.05, .012, -.05);                        // warm lights, cool shadows
        col += (hash(cell) - .5) * .018;                                   // paper grain, fixed to the pixels
        col = floor(col * 8. + bayer(cell) * .5 + .25) / 8.;              // short palette, ordered dither between steps
        vec2 v = vUv * 2. - 1.; col *= 1. - .16 * pow(dot(v * vec2(.6, 1.), v * vec2(.6, 1.)), 2.);
        gl_FragColor = vec4(col, 1.);
        #include <colorspace_fragment>
      }`
  });
  const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));

  let camX = 0, quake = 0, lampPower = 70, lampKick = 0, fanBoost = 1, flutter = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
    halfW = VIEW_H / 2 * (w / h);
    camera.left = -halfW; camera.right = halfW; camera.top = VIEW_H / 2; camera.bottom = -VIEW_H / 2; camera.updateProjectionMatrix();
    const px = Math.max(1, Math.round(h / 270)), lw = Math.max(2, Math.round(w / px)), lh = Math.max(2, Math.round(h / px));
    target.setSize(lw, lh); post.uniforms.uRes.value.set(lw, lh);
  }
  new ResizeObserver(resize).observe(canvas); resize();
  function aimCamera(snap) {
    // On a narrow screen the view is a window onto the workshop that follows the robot.
    const slack = SPAN - halfW, want = slack > 0 ? THREE.MathUtils.clamp((drag && drag.ent !== robot ? drag.ent.body.position.x : rb.position.x), -slack, slack) : 0;
    camX = snap ? want : camX + (want - camX) * 0.06;
    const jx = quake > 0 ? (Math.random() - 0.5) * quake * 1.6 : 0, jy = quake > 0 ? (Math.random() - 0.5) * quake * 1.2 : 0;
    camera.position.set(camX + jx, camAt.y + jy + Math.sin(PITCH) * 90, Math.cos(PITCH) * 90); camera.lookAt(camX + jx, camAt.y + jy, 0);
  }
  aimCamera(true);

  /* ---------- the loop ---------- */
  let visible = true, last = performance.now(), t = 0, acc = 0, drawn = false, chuteT = 3, screenT = 0;
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { threshold: 0.02 }).observe(canvas);
  const STEP = 1 / 60;

  function tick(dt) {
    now += dt;
    if (drag) {                                    // a held thing chases the cursor, so letting go throws it
      const b = drag.ent.body;
      tmp.set((drag.target.x - b.position.x) * 13, (drag.target.y - b.position.y) * 13, (drag.z - b.position.z) * 8).clampLength(0, 44);
      b.velocity.set(tmp.x, tmp.y, tmp.z); if (drag.ent !== robot) b.angularVelocity.scale(0.92, b.angularVelocity);
      b.wakeUp();
      if (drag.ent === robot && shake > 5) { mood("dizzy"); say("> stop shaking me"); shake = -8; }
    }
    energy = Math.max(0, energy - dt / 150);
    brain.update(dt);
    if (!brain.step && !robot.held && !airborne) drive(0, 0);
    // the chute tops the crate up
    chuteT -= dt;
    if (chuteT < 0) { chuteT = 5; if (ents.filter((e) => e.kind === "part" && atHome(e)).length < 3 && count("part") < MAX_PARTS) { makePart(CRATE.x, 6.4, CRATE.z).body.velocity.set(0, -4, 0); burst(CRATE.x, 6.8, CRATE.z, 5, 4); } }
    world.step(STEP);
    const up = rb.position.y > REST_Y + 0.35;
    if (up || robot.held) { airborne = true; fallV = Math.max(fallV, -rb.velocity.y); }
    else if (airborne && !robot.held) { airborne = false; landed(fallV); fallV = 0; }
    for (const e of ents) {
      if (e.carried) continue;
      e.rest = e.body.velocity.length() < 0.9 && !e.held ? e.rest + dt : 0;
      if (e.body.position.y < -5) { e.body.position.set(0, 6, 2); e.body.velocity.setZero(); }
    }
  }

  function animate(dt) {
    const speed = Math.hypot(rb.velocity.x, rb.velocity.z);
    let dy = yawTo - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); yaw += dy * Math.min(1, dt * 9);
    gait += dt * speed * 2.2; squash = Math.max(0, squash - dt * 3.2);
    const sq = Math.sin(squash * Math.PI) * 0.22, breathe = Math.sin(t * 2.2), dangling = robot.held || airborne;
    bot.position.set(rb.position.x, rb.position.y - REST_Y, rb.position.z);
    bot.rotation.set(0, yaw, 0); bot.scale.set(1 + sq, 1 - sq, 1 + sq);
    let lean = 0, hop = 0, aL = [0, -0.16 - 0.04 * breathe], aR = [0, 0.16 + 0.04 * breathe], twist = 0, neckTo = 0.4, gripTo = 0.1, spin = speed * 3;
    if (dangling) { aL = [0, -2.4 + 0.4 * Math.sin(t * 11)]; aR = [0, 2.4 + 0.4 * Math.cos(t * 11)]; bot.rotation.z = THREE.MathUtils.clamp(-rb.velocity.x * 0.03, -0.6, 0.6); neckTo = 0.9; gripTo = 0.5; spin = 14; }
    else if (pose === "walk") { hop = 0.05 * Math.abs(Math.sin(gait * 2)); lean = 0.1; aL = [Math.sin(gait) * 0.4, -0.2]; aR = [-Math.sin(gait) * 0.4, 0.2]; }
    else if (pose === "bend") { lean = 0.45; aL = [-1.0, -0.3]; aR = [-1.0, 0.3]; gripTo = 0.5; neckTo = 0.2; }
    else if (pose === "reach") { aL = [-2.3, -0.2]; aR = [-2.3, 0.2]; neckTo = 1.5; }
    else if (pose === "build") { const h = Math.sin(t * 17); aL = [-1.4 + 0.5 * h, -0.2]; aR = [-1.4 - 0.5 * h, 0.2]; lean = 0.12; neckTo = 0.7; gripTo = 0.3 + 0.3 * h; }
    else if (pose === "wave") { aR = [0, 2.5 + 0.35 * Math.sin(t * 15)]; neckTo = 0.9; }
    else if (pose === "cheer") { aL = [0, -2.7]; aR = [0, 2.7]; hop = Math.abs(Math.sin(t * 9)) * 0.6; neckTo = 1.2 + 0.3 * Math.sin(t * 9); }
    else if (pose === "dance") { hop = Math.abs(Math.sin(t * 8)) * 0.4; twist = Math.sin(t * 4) * 0.9; aL = [0, -1.6 - Math.sin(t * 8)]; aR = [0, 1.6 + Math.cos(t * 8)]; neckTo = 0.8 + 0.6 * Math.sin(t * 8); spin = 9; }
    else if (pose === "charge") { neckTo = 0.3; aL = [0, -0.5]; aR = [0, 0.5]; }
    else if (pose === "magnet") { neckTo = 1.5; aL = [0, -2.2 + 0.2 * Math.sin(t * 20)]; aR = [0, 2.2 + 0.2 * Math.cos(t * 20)]; hop = 0.04 * Math.sin(t * 30); if (Math.random() < 0.3) burst(rb.position.x + (Math.random() - 0.5) * 2, rb.position.y + 4.6, rb.position.z, 1, 4); }
    if (carrying && !dangling) { aL = [-1.4, -0.3]; aR = [-1.4, 0.3]; gripTo = 0; }
    bot.position.y += hop; bot.rotation.x = lean; bot.rotation.y += twist;
    wheels.forEach((w) => { w.rotation.x += dt * spin; });
    prop.rotation.y += dt * (3 + speed * 4);
    for (let i = 0; i < 2; i++) { const a = i ? aR : aL, g = arms[i]; g.rotation.x += (a[0] - g.rotation.x) * 0.3; g.rotation.z += (a[1] - g.rotation.z) * 0.3; g.userData.claw.forEach((f, k) => { f.rotation.z = (k ? -1 : 1) * grip; }); }
    grip += (gripTo - grip) * 0.3; neckLen += (neckTo - neckLen) * 0.15;
    neck.scale.y = neckLen + 0.3; neck.position.y = 2.25 + (neckLen + 0.3) / 2; head.position.y = 2.3 + neckLen;
    torso.scale.set(1 + 0.015 * breathe, 1, 1 + 0.015 * breathe);
    needle.rotation.z = 1.2 - energy * 2.4;
    leds.forEach((l, i) => l.scale.setScalar(Math.sin(t * 5 + i * 2.1) > 0 ? 1 : 0.5));

    // head: watches what the user is dragging, else the cursor, else its work
    const focus = drag && drag.ent !== robot ? drag.ent.mesh.position : (now - cursorMoved < 2.5 ? cursor : null);
    let hy = 0, hx = 0;
    if (focus && pose !== "build") { hy = Math.atan2(focus.x - rb.position.x, Math.max(1.5, focus.z - rb.position.z + 6)) - bot.rotation.y; hy = THREE.MathUtils.clamp(Math.atan2(Math.sin(hy), Math.cos(hy)), -1.1, 1.1); hx = THREE.MathUtils.clamp((3.5 - focus.y) * 0.06, -0.4, 0.3); }
    head.rotation.y += (hy - head.rotation.y) * 0.12; head.rotation.x += (hx - head.rotation.x) * 0.12;
    head.rotation.z = 0.04 * Math.sin(t * 1.3) + (pose === "dance" ? 0.22 * Math.sin(t * 8) : 0);
    ears.forEach((a, i) => { a.rotation.z = (i ? -0.5 : 0.5) + 0.12 * Math.sin(t * 3 + i) - rb.velocity.x * 0.02; a.rotation.x = rb.velocity.z * 0.02; });
    magnet.visible = pose === "magnet" || swarm.length > 0; magnet.rotation.y += dt * 9;
    bot.updateMatrixWorld(); hands.set(0, 1.9, 1.5).applyMatrix4(bot.matrixWorld);

    for (const e of ents) {
      const si = swarm.indexOf(e);
      if (si >= 0) { const a = t * 3.2 + si * (6.283 / Math.max(3, swarm.length)), r = 2.0 + 0.3 * Math.sin(t * 2 + si); e.mesh.position.set(rb.position.x + Math.cos(a) * r, rb.position.y + 3.6 + 0.5 * Math.sin(t * 4 + si), rb.position.z + Math.sin(a) * r * 0.5); e.mesh.rotation.set(t * 2 + si, t * 3, si); }
      else if (e.carried) { e.mesh.position.copy(hands); e.mesh.quaternion.setFromEuler(new THREE.Euler(0, yaw, 0)); }
      else { e.mesh.position.copy(e.body.position); e.mesh.quaternion.copy(e.body.quaternion); }
    }
    // the shop is alive
    const building = pose === "build", dancing = pose === "dance", charging = pose === "charge";
    press.position.y = building ? 1.6 + 0.6 * Math.abs(Math.sin(t * 9)) : 2.2;
    beacon.scale.setScalar(building ? 1 + 0.5 * Math.abs(Math.sin(t * 12)) : 0.8);
    chuteLamp.scale.setScalar(chuteT < 0.8 ? 1.6 : 0.8);
    lampKick = Math.max(0, lampKick - dt * 0.5);
    lamps.forEach((l, i) => { l.rotation.z = (0.06 + lampKick) * Math.sin(t * (1.1 + lampKick * 4) + i * 2); });
    if (leak && leak.t > 0) { leak.t -= dt; if (Math.random() < 0.7) splash(leak.x, leak.y, leak.z, 2, leak.vx); }
    for (let k = 0; k < WN; k++) { if (wLife[k] <= 0) { wPos[k * 3 + 1] = -99; continue; } wLife[k] -= dt; wVel[k * 3 + 1] -= 26 * dt; for (let a = 0; a < 3; a++) wPos[k * 3 + a] += wVel[k * 3 + a] * dt; }
    wGeo.attributes.position.needsUpdate = true; fanBoost = Math.max(1, fanBoost - dt * 2); flutter = Math.max(0, flutter - dt * 0.4);
    lampLights.forEach((l, i) => { l.intensity = lampPower + 8 * Math.sin(t * 7 + i * 3) * (i === 3 && dancing ? 5 : 1); });
    fan.rotation.y += dt * 2.6 * fanBoost; fans.forEach((f) => { f.rotation.z += dt * 9 * fanBoost; });
    flags.forEach((f, i) => { f.rotation.z = 0.2 * Math.sin(t * 2.2 + i * 0.7); });
    bulbs.forEach((b, i) => b.scale.setScalar(((t * 3 + i) | 0) % 3 ? 1 : 0.5));
    speakers.forEach((s, i) => s.scale.setScalar(dancing ? 1 + 0.25 * Math.abs(Math.sin(t * 8 + i)) : 1));
    juke.position.y = dancing ? 0.1 * Math.abs(Math.sin(t * 8)) : 0;
    discoBall.rotation.y += dt * (dancing ? 3 : 0.4); tile.rotation.y += dt * (dancing ? 2.4 : 0.1);
    padRing.scale.setScalar(charging ? 1 + 0.25 * Math.abs(Math.sin(t * 5)) : 1);
    cells.forEach((c, i) => { c.visible = energy > i / 4 || (charging && ((t * 6) | 0) % 4 === i); });
    steam.forEach((s, i) => { const k = (t * 0.5 + i / 3) % 1; s.position.y = RY + 3.4 + k * 4; s.position.x = 14.6 + Math.sin(k * 5 + i) * 0.6; s.scale.setScalar(0.5 + k); s.visible = k < 0.85; });
    for (let k = 0; k < SP; k++) { if (spLife[k] <= 0) { spPos[k * 3 + 1] = -99; continue; } spLife[k] -= dt; spVel[k * 3 + 1] -= 30 * dt; for (let a = 0; a < 3; a++) spPos[k * 3 + a] += spVel[k * 3 + a] * dt; }
    spGeo.attributes.position.needsUpdate = true;
    // little screens: redraw a few times a second
    screenT -= dt;
    if (screenT < 0) {
      screenT = 0.14;
      const g = codeTex.userData.g; g.fillStyle = "#06140c"; g.fillRect(0, 0, 24, 16);
      for (let r = 0; r < 7; r++) { g.fillStyle = r === ((t * 3) | 0) % 7 ? "#eef0ff" : "#9dff6e"; g.fillRect(1 + (r % 3), 1 + r * 2, 4 + ((Math.sin(r * 7 + ((t * 2) | 0)) + 1) * 8 | 0), 1); }
      codeTex.needsUpdate = true;
      const a = arcadeTex.userData.g; a.fillStyle = "#17123c"; a.fillRect(0, 0, 16, 12); a.fillStyle = "#ff5fa2"; a.fillRect(((t * 6) | 0) % 14, 9, 3, 1); a.fillStyle = "#e4f222"; a.fillRect((7 + Math.sin(t * 3) * 6) | 0, ((t * 5) | 0) % 8, 1, 1); a.fillStyle = "#7df3ff"; for (let i = 0; i < 5; i++) a.fillRect(1 + i * 3, 1 + (i + ((t * 2) | 0)) % 2, 2, 1);
      arcadeTex.needsUpdate = true;
      drawBoard(((t * 14) | 0) % 150 < 78 ? ((t * 14) | 0) % 150 : -1);
    }
    clouds.forEach((c, i) => { c.position.x += dt * (0.5 + i * 0.18); if (c.position.x > 70) c.position.x = -70; });
    birds.forEach((b, i) => { b.position.x += dt * 4.5; if (b.position.x > 60) b.position.x = -60; b.position.y += Math.sin(t * 2 + i) * dt * 0.6; const f = Math.sin(t * 11 + i) * 0.7; b.userData.w[0].rotation.z = f; b.userData.w[1].rotation.z = -f; });
    washing.forEach((g, i) => { g.rotation.x = (0.18 + wind * 0.5 + flutter) * Math.sin(t * (2 + wind * 3) + i * 0.9); });
    fronds.forEach((f, i) => { f.rotation.z = (0.07 + wind * 0.2) * Math.sin(t * (1.4 + wind * 2) + i); });
    // weather and time of day ease toward what was asked for
    const k = Math.min(1, dt * 1.6), m = MOODS[sceneMood];
    key.color.lerp(m.sun, k); key.intensity += (m.sunPower - key.intensity) * k; hemi.intensity += (m.fill - hemi.intensity) * k;
    sky.material.color.lerp(m.sky, k); post.uniforms.uTint.value.lerp(m.tint, k); lampPower += (m.lamp - lampPower) * k;
    clouds.forEach((c) => c.material.color.lerp(m.sky, k));
    wind += ((raining ? 1 : 0) - wind) * k * 0.6; quake = Math.max(0, quake - dt * 0.9);
    rain.visible = wind > 0.05;
    if (rain.visible) { for (let i = 0; i < RAIN; i++) { rainPos[i * 3 + 1] -= dt * (34 + (i % 7)); rainPos[i * 3] -= dt * 5; if (rainPos[i * 3 + 1] < 0) { rainPos[i * 3] = (Math.random() - 0.5) * 96; rainPos[i * 3 + 1] = 32; rainPos[i * 3 + 2] = 6.5 + Math.random() * 14; } } rainGeo.attributes.position.needsUpdate = true; }
    aimCamera(false);
  }

  /* ---------- things the page can ask the world to do ---------- */
  const C = (n) => new THREE.Color(n);
  const MOODS = {
    day: { sun: C(0xfff1d6), sunPower: 2.5, fill: 1.25, sky: C(0xffffff), tint: C(0xffffff), lamp: 70 },
    dusk: { sun: C(0xff9a7a), sunPower: 1.7, fill: 0.9, sky: C(0xffa9c4), tint: new THREE.Color(1.05, 0.92, 0.98), lamp: 110 },
    night: { sun: C(0x7d95ff), sunPower: 0.45, fill: 0.42, sky: C(0x2a2f7a), tint: new THREE.Color(0.86, 0.9, 1.12), lamp: 170 }
  };
  let sceneMood = "day", raining = false, wind = 0, lowG = false;
  const RAIN = 260, rainPos = new Float32Array(RAIN * 3); for (let i = 0; i < RAIN; i++) rainPos.set([(Math.random() - 0.5) * 96, Math.random() * 32, 6.5 + Math.random() * 14], i * 3);
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xcfe6ff, size: 2, sizeAttenuation: false })); rain.frustumCulled = false; rain.visible = false; scene.add(rain);
  const actions = {
    day() { sceneMood = "day"; say("> morning. back to it"); mood("happy", 900); },
    dusk() { sceneMood = "dusk"; say("> golden hour. nice light for soldering"); mood("heart", 1100); },
    night() { sceneMood = "night"; say("> lights on. night shift"); mood("wink", 1100); },
    rain() { raining = !raining; say(raining ? "> rain. glad the roof holds" : "> rain's passing"); mood(raining ? "alert" : "happy", 1000); return raining; },
    quake() { quake = 1.6; for (const e of ents) if (!e.carried) { e.body.wakeUp(); e.body.velocity.set((Math.random() - 0.5) * 16, 6 + Math.random() * 9, (Math.random() - 0.3) * 7); e.body.angularVelocity.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); e.rest = 0; }
      if (!robot.held) brain.interrupt("quake", () => { mood("dizzy", 1500); rb.velocity.y = 10; say("> EARTHQUAKE. everything was just tidy"); }); },
    gravity() { lowG = !lowG; world.gravity.set(0, lowG ? -5 : -34, 0); for (const e of ents) { e.body.wakeUp(); if (lowG && !e.carried) e.body.velocity.y += 3 + Math.random() * 3; } if (lowG && !robot.held) rb.velocity.y = 7; say(lowG ? "> gravity's gone soft. wheee" : "> and we're heavy again"); mood(lowG ? "wow" : "happy", 1200); return lowG; },
    spill() { const n = Math.max(0, Math.min(6, MAX_PARTS - count("part"))); if (!n) { say("> that's every part we own. clean-up first"); mood("alert", 1200); return; }
      for (let i = 0; i < n; i++) { const p = makePart(CRATE.x, 6.2, CRATE.z); p.body.velocity.set((Math.random() - 0.35) * 22, 4 + Math.random() * 8, 5 + Math.random() * 6); p.body.angularVelocity.set(5, 4, 3); } burst(CRATE.x, 6.6, CRATE.z, 20, 10); say("> the chute's jammed open. parts everywhere"); mood("alert", 1200); },
    party() { if (robot.held) return; brain.interrupt("party"); brain.push({ enter: () => { say("> break time"); mood("note"); } }, { go: [DANCE.x, DANCE.z], reach: 0.8 }, { wait: 5, pose: "dance", exit: calmFace }); }
  };
  // click targets in the scene
  const SIGNS = ["AGENT SKILLS", "DRAG THE BOT", "SHIP IT", "BUILD SKILLS"]; let signAt = 0;
  tappable(sign, () => { boardText = SIGNS[++signAt % SIGNS.length]; drawBoard(-1); burst(0, 20.6, 8, 14, 8); say("> new sign. very official"); });
  tappable(tankMesh, () => { leak = { t: 2.4, x: -18.2, y: RY + 1.6, z: 0.4, vx: 3 }; say("> the tank's leaking again"); mood("alert", 1000); });
  tappable(juke, () => actions.party());
  tappable(arcadeMesh, () => { if (robot.held) return; brain.interrupt("arcade"); brain.push({ enter: () => { say("> one quick game"); mood("wow", 900); } }, { go: [-18.2, -1.6], reach: 0.7 }, { wait: 3.2, pose: "build", face: Math.PI, exit: () => { mood("check", 900); say("> high score"); } }); });
  tappable(vendMesh, () => { if (count("can") >= MAX_SMALL) { say("> it's empty. you drank it dry"); return; } const c = makeCan(16.6, 1.0, -3.2); c.body.velocity.set((Math.random() - 0.5) * 4, 3, 7); burst(16.6, 1.2, -3.4, 6, 4); say("> free can. someone has to bin it though"); });
  clouds.forEach((c) => tappable(c, () => actions.rain()));
  lamps.forEach((l) => tappable(l, () => { lampKick = 0.9; say("> careful with the lamps"); }));
  tappable(discoBall, () => actions.party());
  washing.forEach((g) => tappable(g, () => { flutter = 1.2; }));
  fans.forEach((f) => tappable(f.parent === room ? f : f.parent, () => { fanBoost = 8; }));
  birds.forEach((b) => tappable(b, () => { birds.forEach((q) => { q.position.y += 2 + Math.random() * 2; q.position.x += 6; }); }));
  tappable(palm, () => { flutter = 1; wind = 1; });
  if (ui) ui.act = (name) => (actions[name] ? actions[name]() : undefined);

  function draw() {
    renderer.setRenderTarget(target); renderer.render(scene, camera);
    renderer.setRenderTarget(null); post.uniforms.uTime.value = t; renderer.render(postScene, postCam);
    drawn = true;
  }
  function frame(time) {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) { last = time; return; }
    const dt = Math.min(0.05, (time - last) / 1000); last = time;
    if (calm) { if (drawn) return; } else { t += dt; acc += dt; let n = 0; while (acc >= STEP && n++ < 4) { tick(STEP); acc -= STEP; } }
    animate(dt); draw();
  }
  say("> booting workshop");
  requestAnimationFrame(frame);
  return actions;
}
