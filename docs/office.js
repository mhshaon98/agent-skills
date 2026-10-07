// The office scene. Generated from workshop.js (same robot, physics and brain) with office
// scenery and stations swapped in; edit shared behaviour there and scenery here.
// The hero: a wide pixel-art office you can play with. A robot builds skill
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
  BENCH = { x: -2, z: -4.3 }, STACK = { x: 4.7, z: -4.5 }, SHELF = { x: 10.5, xs: [8.1, 9.7, 11.3, 12.9], ys: [3.35, 5.0], z: -5.05 },
  DANCE = { x: 19, z: 0.6, r: 2.6 }, MUG = [1.7, 2.62, -4.1], TRAY = [0.2, 2.62, -4.7];
const STAND = { crate: [CRATE.x, -1.6], bench: [-1, -1.6], shelf: [SHELF.x, -1.6], basket: [BASKET.x, -1.6], stack: [STACK.x, -1.5], mug: [1.7, -1.6], tray: [0.2, -1.6] };
const LANE = 1.0, REST_Y = 2.1, VIEW_H = 17.6, PITCH = 0.2, SPAN = 28.6;

// 5 x 7 lettering for the signs
const FONT = { A: "01110100011000111111100011000110001", G: "01111100001000010111100011000101111", E: "11111100001000011110100001000011111", N: "10001110011010110101100111000110001", T: "11111001000010000100001000010000100", S: "01111100001000001110000010000111110", K: "10001100101010011000101001001010001", I: "11111001000010000100001000010011111", L: "10000100001000010000100001000011111", D: "11110100011000110001100011000111110", R: "11110100011000111110101001001010001", H: "10001100011000111111100011000110001", B: "11110100011000111110100011000111110", O: "01110100011000110001100011000101110", P: "11110100011000111110100001000010000", U: "10001100011000110001100011000101110", M: "10001110111010110101100011000110001", " ": "00000000000000000000000000000000000" };

export function mount(canvas, ui) {
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false }); } catch (e) { return false; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a262c);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 200);
  const camAt = new THREE.Vector3(0, 6.3, -1);
  let halfW = 25;

  const hemi = new THREE.HemisphereLight(0xfffdf0, 0x6f7f72, 1.7); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1d6, 2.5); key.position.set(3, 40, 15); key.castShadow = true;   // the sun
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.06;
  Object.assign(key.shadow.camera, { left: -56, right: 56, top: 44, bottom: -26, near: 1, far: 140 });
  scene.add(key);
  const lampLights = [-14, -2, 10, 19].map((x) => { const l = new THREE.PointLight(0xfffbe8, 45, 22, 1.6); l.position.set(x, 8.2, 0); scene.add(l); return l; });

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

  /* ---------- the room ---------- */
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

  /* ---------- the office: a cutaway of an open-plan floor ----------
     Cream walls, grey-sage cubicle partitions, dark green carpet, a tiled drop
     ceiling with flush light panels. The interactive stations are the front row;
     two more rows of cubicles and the far wall sit behind them. No names, logos
     or real screen contents: everything legible here is a generic stand-in. */
  const WALL = 0xe4dcc6, SAGE = 0x8c978a, SAGE_D = 0x5c6159, TRIM = 0xcdc7b4, CARPET = 0x3f5348, DESK = 0xdcd8cc, DESK_E = 0xb9b5a8, LEG = 0x8c8d88,
    CARD = 0xb08a5e, TAPE = 0xd2b98a, BLACK = 0x1b1c1f, GREY = 0x8d939c, BUTCHER = 0xc8965a, ESPRESSO = 0x33251f, PAPER = 0xf4f4ee, CEIL = 0xdcd8c9;
  const OT = { carpet: surface(CARPET, "concrete"), wallp: surface(WALL, "plaster"), fabric: surface(SAGE, "concrete"), card: surface(CARD, "concrete"), wood: surface(BUTCHER, "planks"), desk: surface(DESK, "concrete"), dark: surface(ESPRESSO, "planks") };
  const BACK = -16, CEIL_Y = 8.6;
  const flatPlane = (w, h, tex, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), toon(0xffffff, tex)); m.position.set(x, y, z); room.add(m); return m; };
  const wire = (pts, c) => part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]))), 20, 0.05, 5), c, room, 0, 0, 0, { flat: true });
  // floor and the cut edge of the slab
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(56, 23), toon(0xffffff, tiled(OT.carpet, 22, 9))); carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0, -4.8); carpet.receiveShadow = true; room.add(carpet);
  block(56, 1.6, 23, TEX.concrete, 0x6f757c, 0, -0.82, -4.8, { flat: true });
  part(box(56, 0.3, 0.2, 0.02), 0x2f5a4c, room, 0, -0.05, 6.75, { flat: true });
  // far wall, painted: pilaster, whiteboard with list lines, framed map, door, lit doorway, conduit, switches
  const farTex = paint(336, 52, (g, w, h) => {
    g.fillStyle = css(WALL); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 800; i++) { g.fillStyle = pick(["#ded6c0", "#e9e2cd", "#d9d1ba"]); g.fillRect((rnd() * w) | 0, (rnd() * h) | 0, 2, 1); }
    g.fillStyle = "#cfc7ae"; g.fillRect(0, 0, w, 3);                                                     // shade under the ceiling
    g.fillStyle = "#2f5a4c"; g.fillRect(0, h - 3, w, 3);                                                 // green baseboard
    g.fillStyle = "#d6ceb6"; g.fillRect(112, 0, 13, h); g.fillStyle = "#c3bba2"; g.fillRect(123, 0, 2, h);   // projecting column
    const wb = (x, y, ww, hh) => { g.fillStyle = "#aeb1b6"; g.fillRect(x - 1, y - 1, ww + 2, hh + 3); g.fillStyle = "#f4f4ee"; g.fillRect(x, y, ww, hh); g.fillStyle = "#3a3d44"; g.fillRect(x + 3, y + 3, 10, 1); for (let i = 0; i < 6; i++) { g.fillStyle = "#4a4d55"; g.fillRect(x + 3, y + 7 + i * 3, 3, 1); g.fillStyle = "#7d8088"; g.fillRect(x + 8, y + 7 + i * 3, 6 + ((rnd() * (ww - 20)) | 0), 1); } };
    wb(64, 12, 36, 24);
    g.fillStyle = "#6b6f78"; g.fillRect(186, 14, 13, 11); g.fillStyle = "#2a3140"; g.fillRect(187, 15, 11, 9);                    // framed picture
    g.fillStyle = "#8d8f8a"; g.fillRect(232, 9, 24, 18); g.fillStyle = "#eeeee6"; g.fillRect(233, 10, 22, 16); for (let i = 0; i < 26; i++) { g.fillStyle = pick(["#a9c8dc", "#e3b3b3", "#cfd8c0"]); g.fillRect(234 + ((rnd() * 19) | 0), 11 + ((rnd() * 13) | 0), 2 + ((rnd() * 2) | 0), 1); }   // wall map
    g.fillStyle = "#d9d1ba"; g.fillRect(268, 14, 13, 35); g.fillStyle = "#c3bba2"; g.fillRect(268, 14, 13, 1); g.fillRect(268, 14, 1, 35); g.fillStyle = "#8d939c"; g.fillRect(278, 32, 1, 2);   // door
    g.fillStyle = "#fbf6dc"; g.fillRect(294, 16, 12, 33); g.fillStyle = "#e9dfb8"; g.fillRect(294, 40, 12, 9); g.fillStyle = "#c3bba2"; g.fillRect(293, 15, 14, 1); g.fillRect(293, 15, 1, 34); g.fillRect(306, 15, 1, 34);   // open, lit doorway
    g.fillStyle = "#c9c1a8"; g.fillRect(130, 9, 50, 1); g.fillRect(130, 5, 1, 5); g.fillStyle = "#b9b19a"; g.fillRect(128, 3, 4, 3);   // conduit and junction box
    g.fillStyle = "#d2cab2"; for (const x of [58, 104, 226]) g.fillRect(x, 28, 2, 3);
    g.fillStyle = "#f2f0e6"; g.fillRect(316, 8, 10, 6); g.fillStyle = "#1b1c1f"; g.fillRect(318, 10, 6, 2);                          // thermostat-ish boxes
  });
  flatPlane(56, CEIL_Y, farTex, 0, CEIL_Y / 2, BACK);
  for (const s of [-1, 1]) block(0.6, CEIL_Y, 22.6, OT.wallp, null, s * 27.7, CEIL_Y / 2, -4.8, { flat: true });
  block(1.5, CEIL_Y, 1.5, OT.wallp, 0xf2efe4, 17.5, CEIL_Y / 2, -10.6, { flat: true });                                              // freestanding white column
  // the ceiling, drawn receding toward you: 2x4 tiles, flush light panels, return-air grilles, sprinkler heads
  const ROWS = [5, 7, 9, 12, 15];
  const ceilTex = paint(336, 48, (g, w, h) => {
    g.fillStyle = css(CEIL); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { g.fillStyle = pick(["#d2cebf", "#e3dfd0", "#c9c5b6"]); g.fillRect((rnd() * w) | 0, (rnd() * h) | 0, 1, 1); }
    let y = h; const cells = [];
    ROWS.forEach((rh, r) => { y -= rh; const cw = 22 + r * 7; g.fillStyle = "#c4c0b0"; g.fillRect(0, y, w, 1); for (let x = (r % 2) * (cw / 2) - cw; x < w; x += cw) { g.fillRect(Math.round(x), y, 1, rh); cells.push([Math.round(x) + 1, y + 1, cw - 1, rh - 1, r]); } });
    cells.forEach(([x, cy, cw, ch, r], i) => {
      const k = (i * 7 + r * 3) % 11;
      if (k === 0 || k === 5) { g.fillStyle = "#fbfcf4"; g.fillRect(x + 1, cy, cw - 2, ch); g.fillStyle = "#eef0e2"; g.fillRect(x + 1, cy + ch - 1, cw - 2, 1); }
      else if (k === 8) { g.fillStyle = "#6f6d64"; g.fillRect(x + 2, cy, Math.min(cw - 4, ch * 2), ch); g.fillStyle = "#b9b6a8"; g.fillRect(x + 2 + Math.min(cw - 4, ch * 2) / 2 - 2, cy + ch / 2 - 1, 4, 2); }
      else if (k === 3) { g.fillStyle = "#8d8f8a"; g.fillRect(x + (cw >> 1), cy + (ch >> 1), 1, 1); }
      else if (k === 9 && r > 1) { g.fillStyle = "#c2b99c"; g.fillRect(x + 3, cy + 1, 6, 2); }                                         // a water stain
    });
    g.fillStyle = "#b9b5a6"; g.fillRect(0, h - 1, w, 1);
  });
  flatPlane(56, 8, ceilTex, 0, CEIL_Y + 4, BACK - 0.02);
  const troffers = [[-19, 9.3, 3.2, 0.7], [3, 10.4, 4.2, 1.0], [-9, 12.0, 5.2, 1.4], [16, 12.0, 5.2, 1.4], [-22, 14.2, 6.4, 1.9]].map(([x, y, w, hh]) => part(box(w, hh, 0.04, 0.01), 0xfbfcf4, room, x, y, BACK + 0.04, { glow: true }));
  const lamps = troffers;
  // window strip in the far-left part of the wall: one shared sky material behind dark frames
  const skyTex = paint(48, 16, (g) => { ["#62afea", "#86c6f2", "#a9d8f7", "#c6e6fa"].forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * 3, 48, 4); }); g.fillStyle = "#ffffff"; g.fillRect(6, 3, 9, 2); g.fillRect(30, 5, 11, 2); for (let x = 0; x < 48;) { const bw = 4 + ((rnd() * 6) | 0), bh = 3 + ((rnd() * 6) | 0); g.fillStyle = pick(["#8aa2b8", "#9db4c8", "#7d93aa"]); g.fillRect(x, 16 - bh, bw, bh); x += bw + 1; } g.fillStyle = "#6f8f5a"; g.fillRect(0, 15, 48, 1); });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 2.3), new THREE.MeshBasicMaterial({ map: skyTex })); sky.position.set(-5.4, 5.7, BACK + 0.16); room.add(sky);
  part(box(9.6, 2.7, 0.2, 0.02), BLACK, room, -5.4, 5.7, BACK + 0.02, { flat: true });
  for (let i = 0; i <= 4; i++) part(box(0.16, 2.5, 0.12, 0.01), BLACK, room, -10.0 + i * 2.3, 5.7, BACK + 0.22, { flat: true });
  part(box(1.3, 0.7, 0.3, 0.03), BLACK, room, 1.4, 7.9, BACK + 0.4, { flat: true }); const exitGlow = part(box(1.0, 0.36, 0.04, 0.01), 0xff3b4a, room, 1.4, 7.9, BACK + 0.58, { glow: true }); part(cyl(0.03, 0.5, 4), GREY, room, 1.4, 8.4, BACK + 0.4);

  // office kit
  function partition(x, z, w, h, o) { o = o || {}; const g = new THREE.Group(); g.position.set(x, 0, z); if (o.side) g.rotation.y = Math.PI / 2; room.add(g); const m = part(new THREE.BoxGeometry(w, h, 0.28), 0xffffff, g, 0, h / 2 + 0.3, 0, { map: tiled(OT.fabric, Math.max(1, Math.round(w / 3)), 1) }); part(box(w + 0.12, 0.18, 0.38, 0.03), TRIM, g, 0, h + 0.36, 0, { flat: true }); for (const s of [-1, 1]) part(box(0.16, h + 0.2, 0.38, 0.03), TRIM, g, s * w / 2, h / 2 + 0.26, 0, { flat: true }); for (let sx = -w / 2 + 3.4; sx < w / 2 - 1; sx += 3.4) part(box(0.08, h, 0.3, 0.01), 0x7d887b, g, sx, h / 2 + 0.3, 0, { flat: true }); part(box(w, 0.32, 0.32, 0.02), SAGE_D, g, 0, 0.16, 0, { flat: true }); return m; }
  function monitor(parent, x, y, z, w, h, tex, ry) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry || 0; parent.add(g); part(box(w, h, 0.12, 0.04), BLACK, g, 0, h / 2 + 0.5, 0, { line: 0.02 }); part(box(w - 0.12, h - 0.12, 0.03, 0.01), 0xffffff, g, 0, h / 2 + 0.5, 0.07, { glow: true, map: tex }); part(cyl(0.06, 0.6, 6), BLACK, g, 0, 0.28, -0.1); part(box(0.8, 0.05, 0.5, 0.02), BLACK, g, 0, 0.03, -0.05); return g; }
  const meshTex = paint(8, 8, (g) => { g.clearRect(0, 0, 8, 8); g.fillStyle = "#1b1c1f"; for (let i = 0; i < 8; i += 2) { g.fillRect(i, 0, 1, 8); g.fillRect(0, i, 8, 1); } });
  function chair(x, z, ry) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; room.add(g); for (let i = 0; i < 5; i++) { const leg = part(box(0.9, 0.1, 0.14, 0.03), BLACK, g, 0, 0.14, 0, { flat: true }); leg.rotation.y = i * 1.257; leg.translateX(0.42); part(ball(0.1), BLACK, leg, 0.42, -0.04, 0, { flat: true }); } part(cyl(0.08, 1.0, 6), GREY, g, 0, 0.7, 0); part(box(1.5, 0.2, 1.45, 0.08), BLACK, g, 0, 1.3, 0, { line: 0.03 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.7), new THREE.MeshBasicMaterial({ map: tiled(meshTex, 5, 6), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide })); back.position.set(0, 2.5, -0.7); back.rotation.x = -0.1; g.add(back);
    part(new THREE.TorusGeometry(0.72, 0.08, 6, 14), BLACK, g, 0, 2.5, -0.7, { flat: true }).scale.set(0.92, 1.2, 1); part(box(0.3, 0.9, 0.14, 0.04), BLACK, g, 0, 1.7, -0.72);
    for (const s of [-1, 1]) { part(box(0.1, 0.6, 0.1, 0.03), BLACK, g, s * 0.82, 1.65, -0.1); part(box(0.2, 0.1, 0.8, 0.04), BLACK, g, s * 0.82, 1.98, 0.0); } return g; }
  function carton(x, y, z, w, h, d, o) { o = o || {}; block(w, h, d, OT.card, null, x, y, z, { line: 0.015 }); part(box(w * 0.22, 0.02, d + 0.02, 0.005), TAPE, room, x, y + h / 2 + 0.01, z, { flat: true }); part(box(w * 0.22, h * 0.4, 0.02, 0.005), TAPE, room, x, y + h * 0.3, z + d / 2 + 0.01, { flat: true }); if (o.label) part(box(w * 0.6, h * 0.22, 0.02, 0.005), PAPER, room, x, y - h * 0.05, z + d / 2 + 0.02, { flat: true }); if (o.open) for (const s of [-1, 1]) { const f = block(w, 0.06, d * 0.5, OT.card, null, x, y + h / 2 + 0.2, z + s * d * 0.62, { flat: true }); f.rotation.x = s * 0.9; } }
  function desk(x, z, w, d, o) { o = o || {}; block(w, 0.14, d, o.top || OT.desk, null, x, 2.2, z, { line: 0.01 }); part(box(w, 0.06, 0.04, 0.01), o.edge || DESK_E, room, x, 2.14, z + d / 2, { flat: true }); for (const s of [-1, 1]) { part(box(0.22, 2.1, d * 0.5, 0.03), o.leg || LEG, room, x + s * (w / 2 - 0.5), 1.08, z); part(box(0.32, 0.12, d * 0.95, 0.03), o.leg || LEG, room, x + s * (w / 2 - 0.5), 0.06, z); if (o.casters) for (const k of [-1, 1]) part(ball(0.14), BLACK, room, x + s * (w / 2 - 0.5), 0.1, z + k * d * 0.42, { flat: true }); } }
  function bin(x, z) { part(cyl(0.5, 1.2, 10, 0.6), GREY, room, x, 0.6, z, { line: 0.03 }); part(cyl(0.66, 0.14, 10), PAPER, room, x, 1.2, z, { flat: true }); }
  const idleTex = paint(24, 14, (g) => { g.fillStyle = "#101318"; g.fillRect(0, 0, 24, 14); g.fillStyle = "#1c2028"; g.fillRect(2, 2, 6, 1); });
  const winTex = paint(24, 14, (g) => { g.fillStyle = "#2f6fb5"; g.fillRect(0, 0, 24, 14); g.fillStyle = "#8fd0f6"; g.beginPath(); g.moveTo(6, 11); g.lineTo(12, 3); g.lineTo(18, 11); g.fill(); g.fillStyle = "#eef6f2"; g.fillRect(0, 12, 24, 2); });
  const photoTex = paint(10, 16, (g) => { g.fillStyle = "#f4f4ee"; g.fillRect(0, 0, 10, 16); g.fillStyle = "#3d4450"; g.fillRect(0, 0, 10, 7); g.fillStyle = "#8d939c"; g.fillRect(1, 3, 4, 4); g.fillRect(5, 4, 4, 3); g.fillStyle = "#9aa0aa"; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) g.fillRect(1 + c * 2, 9 + r * 2 - 1, 1, 1); });
  const nightTex = paint(10, 18, (g) => { g.fillStyle = "#f4f4ee"; g.fillRect(0, 0, 10, 18); g.fillStyle = "#151a2c"; g.fillRect(0, 0, 10, 7); g.fillStyle = "#f2c56a"; for (let i = 0; i < 9; i++) g.fillRect((rnd() * 10) | 0, 2 + ((rnd() * 4) | 0), 1, 1); g.fillStyle = "#1b1c1f"; g.fillRect(1, 8, 4, 1); g.fillStyle = "#9aa0aa"; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) g.fillRect(1 + c * 2, 11 + r * 2 - 1, 1, 1); g.fillStyle = "#d94b4b"; g.fillRect(1, 16, 3, 1); });
  const posterTex = paint(26, 10, (g) => { g.fillStyle = "#2b2d30"; g.fillRect(0, 0, 26, 10); g.fillStyle = "#b9bcc2"; for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) g.fillRect(1 + c * 2, 1 + r * 2, 1, 1); });
  function stickies(x, y, z, cols) { cols.forEach((c, i) => part(box(0.4, 0.4, 0.03, 0.005), c, room, x + i * 0.52, y + (i % 2) * 0.06, z, { flat: true })); }
  function penCup(x, y, z) { part(cyl(0.2, 0.5, 8), BLACK, room, x, y + 0.25, z, { line: 0.05 }); [[0xd94b4b, -0.08], [0x2f6fb5, 0.06], [BLACK, 0.0], [0xf2d94a, 0.1]].forEach(([c, dx], i) => part(box(0.05, 0.6, 0.05, 0.01), c, room, x + dx, y + 0.62, z - 0.06 + i * 0.04, { flat: true }).rotation.z = dx * 2); }

  // back rows of cubicles: scenery, each a little different
  for (const [z, off] of [[-12.6, 1.5], [-8.4, -1.2]]) for (let i = 0; i < 6; i++) {
    const x = -22 + i * 8.6 + off, v = (i + (z < -10 ? 0 : 3)) % 6;
    partition(x, z - 1.3, 7.6, 4.3); partition(x - 3.9, z, 2.6, 4.3, { side: true }); desk(x, z, 6.4, 2.2);
    if (v === 0) { monitor(room, x - 0.9, 2.27, z - 0.4, 1.9, 1.15, idleTex, 0.2); monitor(room, x + 1.1, 2.27, z - 0.4, 1.9, 1.15, idleTex, -0.2); part(box(1.6, 0.08, 0.5, 0.02), BLACK, room, x, 2.32, z + 0.5); part(box(0.7, 1.5, 1.5, 0.05), BLACK, room, x + 2.7, 0.75, z); chair(x + 0.2, z + 1.7, Math.PI + 0.3); }
    else if (v === 1) { carton(x - 1.6, 2.85, z - 0.2, 1.3, 1.1, 1.1, { open: true }); part(cyl(0.26, 0.7, 8), PAPER, room, x - 0.2, 2.62, z + 0.3); part(cyl(0.27, 0.12, 8), 0x2f6fb5, room, x - 0.2, 3.0, z + 0.3, { flat: true }); part(cyl(0.16, 0.6, 8), 0x35d6c0, room, x + 0.6, 2.57, z + 0.1); part(box(0.5, 0.36, 0.5, 0.05), 0xdfe2e6, room, x + 1.5, 2.45, z + 0.2); flatPlane(1.0, 1.6, photoTex, x + 2.4, 3.5, z - 1.14); }
    else if (v === 2) { monitor(room, x - 0.4, 2.27, z - 0.4, 2.0, 1.2, winTex, 0.1); part(box(0.8, 1.5, 1.4, 0.05), BLACK, room, x - 2.6, 3.02, z - 0.2, { line: 0.02 }); part(box(1.6, 0.08, 0.5, 0.02), BLACK, room, x - 0.2, 2.32, z + 0.5); chair(x - 0.3, z + 1.8, Math.PI - 0.4); bin(x + 2.4, z + 0.3); }
    else if (v === 3) { carton(x + 1.6, 2.72, z - 0.3, 1.2, 0.9, 1.0, { label: true }); carton(x + 1.6, 3.6, z - 0.3, 1.0, 0.8, 0.9); block(4.2, 0.3, 0.9, OT.card, null, x - 0.8, 2.42, z + 0.2, { line: 0.02 }); part(box(1.0, 0.04, 0.7, 0.01), PAPER, room, x - 2.4, 2.3, z + 0.5, { flat: true }); }
    else if (v === 4) { const arm = new THREE.Group(); arm.position.set(x, 2.27, z - 0.2); room.add(arm); part(cyl(0.08, 1.4, 6), BLACK, arm, 0, 0.7, 0); for (const s of [-1, 1]) { part(box(2.0, 1.2, 0.1, 0.04), BLACK, arm, s * 1.05, 1.5, 0.05 * s, { line: 0.02 }).rotation.y = s * -0.15; } part(box(1.7, 0.08, 0.5, 0.02), BLACK, room, x - 0.6, 2.32, z + 0.7); chair(x + 0.5, z + 1.9, Math.PI + 0.6); block(2.8, 0.1, 0.9, OT.desk, null, x + 1.4, 3.3, z - 1.05); for (const s of [-1, 1]) part(box(0.08, 0.5, 0.7, 0.02), BLACK, room, x + 1.4 + s * 1.2, 3.05, z - 1.05, { flat: true }); stickies(x + 0.6, 3.0, z - 1.12, [0xf2d94a, 0xf2d94a, 0x35d6c0]); penCup(x + 2.2, 3.35, z - 1.0); part(box(0.5, 0.3, 0.4, 0.04), PAPER, room, x + 0.8, 3.5, z - 1.0); flatPlane(2.6, 1.0, posterTex, x - 1.6, 3.6, z - 1.14); }
    else { monitor(room, x + 0.8, 2.27, z - 0.4, 1.9, 1.15, idleTex, -0.1); part(box(0.9, 0.3, 0.9, 0.05), BLACK, room, x - 2.0, 2.42, z); part(box(1.2, 0.03, 0.9, 0.01), PAPER, room, x - 0.6, 2.29, z + 0.4, { flat: true }).rotation.y = 0.3; bin(x - 2.6, z + 1.2); chair(x + 1.0, z + 1.6, Math.PI); flatPlane(1.0, 1.6, photoTex, x - 2.6, 3.4, z - 1.14); }
  }
  // back-left corner: a wooden bench on casters, a dark L-desk and a bookcase
  desk(-22.6, -9.4, 5.4, 2.3, { top: OT.wood, edge: 0xa87a44, leg: 0xf2efe4, casters: true }); monitor(room, -23.6, 2.27, -9.9, 2.0, 1.2, idleTex, 0.3);
  part(cyl(0.07, 1.3, 6), BLACK, room, -21.4, 2.9, -10.0); part(box(1.0, 0.1, 0.1, 0.03), BLACK, room, -21.0, 3.5, -10.0).rotation.z = 0.5; part(box(1.4, 0.3, 0.8, 0.04), 0xdfe2e6, room, -22.2, 2.42, -9.0); wire([[-22.8, 2.5, -9.0], [-22.4, 2.9, -8.8], [-21.8, 2.5, -9.1]], 0x2f6fb5);
  block(4.4, 2.3, 1.6, OT.dark, null, -24.6, 1.15, -14.2); block(4.8, 0.16, 2.0, OT.desk, null, -24.6, 2.36, -14.2); block(3.2, 3.6, 1.2, OT.dark, null, -20.6, 1.8, -15.0); carton(-20.6, 4.0, -15.0, 1.5, 0.7, 1.0);
  // side partitions that frame the front row
  partition(-25.6, -2.6, 6, 4.4, { side: true }); partition(25.6, -2.6, 6, 4.4, { side: true });

  // things the rest of the file expects from a scene
  const clouds = [], birds = [], washing = [], fronds = [], bulbs = [], acs = [], fans = acs, palm = new THREE.Group(), RY = 30;

  /* ---------- stations ---------- */
  // charging corner: filing cabinet with a paper stack, a tray sorter beside it, a floor mat
  part(cyl(PAD.r, 0.08, 28), 0x2a3330, room, PAD.x, 0.04, PAD.z, { flat: true });
  const padRing = part(new THREE.TorusGeometry(PAD.r * 0.62, 0.1, 8, 28), 0x8fd67a, room, PAD.x, 0.12, PAD.z, { glow: true }); padRing.rotation.x = Math.PI / 2;
  part(box(2.6, 3.2, 1.8, 0.06), BLACK, room, -21.8, 1.6, -4.6, { line: 0.02 }); for (const y of [0.85, 2.35]) { part(box(2.3, 1.3, 0.06, 0.02), 0x26282e, room, -21.8, y, -3.68, { flat: true }); part(box(0.7, 0.1, 0.08, 0.02), GREY, room, -21.8, y + 0.3, -3.62, { flat: true }); }
  solid(1.3, 1.6, 0.9, -21.8, 1.6, -4.6);
  part(box(1.2, 0.7, 1.0, 0.05), 0x26282e, room, -22.3, 3.56, -4.7, { line: 0.03 });
  const cells = [0, 1, 2, 3].map((i) => part(box(0.2, 0.34, 0.06, 0.02), 0x8fd67a, room, -22.65 + i * 0.26, 3.56, -4.18, { glow: true }));
  [[PAPER, 0], [0xd94b4b, 0.1], [PAPER, -0.15], [0x2f6fb5, 0.2], [PAPER, 0.05], [0x9ad0e8, -0.1]].forEach(([c, r], i) => part(box(1.2, 0.1, 0.9, 0.02), c, room, -21.0, 3.26 + i * 0.1, -4.5, { flat: true }).rotation.y = r);
  wire([[-21, 0.06, -3.7], [-20.6, 0.06, -1.6], [PAD.x, 0.06, PAD.z - 0.6]], BLACK); wire([[-22.6, 3.3, -3.8], [-23.4, 1.6, -3.4], [-24.2, 0.1, -2.8]], 0x2f6fb5);
  desk(-24.5, -4.9, 2.2, 1.9); part(box(1.8, 1.6, 1.3, 0.04), PAPER, room, -24.5, 3.07, -5.0, { line: 0.02 }); for (let i = 0; i < 6; i++) { part(box(1.7, 0.03, 1.2, 0.005), 0xc9cdd3, room, -24.5, 2.35 + i * 0.26, -4.96, { flat: true }); part(box(1.5, 0.08, 0.04, 0.005), i % 2 ? PAPER : 0xdfe2e6, room, -24.5, 2.42 + i * 0.26, -4.34, { flat: true }); }
  for (const dx of [-0.42, 0.42]) { carton(-24.5 + dx, 4.25, -5.0, 0.78, 0.74, 0.8, { label: true }); }
  // printer (click it and it prints)
  const arcadeMesh = part(box(2.6, 2.6, 1.9, 0.08), 0xdfe2e6, room, -18.2, 1.3, -4.6, { line: 0.02 }); solid(1.3, 1.6, 0.95, -18.2, 1.6, -4.6);
  part(box(2.7, 0.7, 2.0, 0.08), 0x8d939c, room, -18.2, 2.9, -4.6, { line: 0.02 }); part(box(2.0, 0.08, 1.2, 0.02), PAPER, room, -18.2, 3.3, -4.3); for (const y of [0.6, 1.4]) part(box(2.3, 0.06, 0.04, 0.01), 0x8d939c, room, -18.2, y, -3.64, { flat: true });
  const arcadeTex = paint(16, 12, () => {}); part(box(0.8, 0.5, 0.06, 0.01), 0xffffff, room, -17.6, 2.9, -3.58, { glow: true, map: arcadeTex }); part(box(1.9, 0.1, 0.7, 0.02), 0x26282e, room, -18.4, 2.0, -3.4);
  // waste bin with a liner
  for (const [dx, dz, w, d] of [[0, 0.95, 2.2, 0.2], [0, -0.95, 2.2, 0.2], [1, 0, 0.2, 2.0], [-1, 0, 0.2, 2.0]]) { part(box(w, 1.5, d, 0.05), GREY, room, BASKET.x + dx, 0.75, BASKET.z + dz, { line: 0.02 }); solid(w / 2, 0.75, d / 2, BASKET.x + dx, 0.75, BASKET.z + dz); }
  for (const [dx, dz, w, d] of [[0, 1.08, 2.5, 0.12], [1.14, 0, 0.12, 2.3], [-1.14, 0, 0.12, 2.3]]) part(box(w, 0.5, d, 0.04), PAPER, room, BASKET.x + dx, 1.32, BASKET.z + dz, { flat: true });
  // delivery carton the parts come from
  for (const [dx, dz, w, d] of [[0, 1.45, 3.3, 0.25], [0, -1.45, 3.3, 0.25], [1.52, 0, 0.25, 2.9], [-1.52, 0, 0.25, 2.9]]) { block(w, 1.9, d, OT.card, null, CRATE.x + dx, 0.95, CRATE.z + dz, { line: 0.015 }); solid(w / 2, 0.95, d / 2, CRATE.x + dx, 0.95, CRATE.z + dz); }
  solid(1.4, 0.15, 1.4, CRATE.x, 0.15, CRATE.z);
  for (const s of [-1, 1]) { const flap = block(3.3, 0.08, 1.3, OT.card, null, CRATE.x, 2.25, CRATE.z + s * 1.95, { flat: true }); flap.rotation.x = s * 0.7; const side = block(1.3, 0.08, 2.9, OT.card, null, CRATE.x + s * 2.0, 2.2, CRATE.z, { flat: true }); side.rotation.z = -s * 0.8; }
  part(box(1.5, 0.6, 0.04, 0.01), PAPER, room, CRATE.x - 0.4, 1.1, CRATE.z + 1.6, { flat: true }); part(box(0.5, 0.2, 0.05, 0.01), 0xd94b4b, room, CRATE.x - 0.7, 1.2, CRATE.z + 1.62, { flat: true }); part(box(0.3, 1.9, 0.04, 0.005), TAPE, room, CRATE.x + 0.9, 0.95, CRATE.z + 1.59, { flat: true });
  const chuteLamp = part(ball(0.14), 0xf2d94a, room, CRATE.x + 1.3, 2.4, CRATE.z - 1.3, { glow: true });
  // the desk: partition behind, an L of two white tops, screens and clutter
  partition(BENCH.x, -5.75, 12.4, 4.6); partition(-8.15, -4.3, 3.0, 4.6, { side: true });
  block(4.0, 0.14, 2.9, OT.desk, null, BENCH.x - 2.9, 2.2, BENCH.z, { line: 0.012 }); block(5.76, 0.14, 2.9, OT.desk, null, BENCH.x + 2.02, 2.2, BENCH.z, { line: 0.012 });
  part(box(9.8, 0.07, 0.05, 0.01), DESK_E, room, BENCH.x, 2.13, BENCH.z + 1.45, { flat: true });
  for (const dx of [-4.2, -0.9, 3.9]) { part(box(0.26, 2.0, 0.5, 0.04), LEG, room, BENCH.x + dx, 1.05, BENCH.z); part(box(0.4, 0.14, 2.5, 0.04), LEG, room, BENCH.x + dx, 0.07, BENCH.z); }
  solid(4.9, 1.15, 1.45, BENCH.x, 1.15, BENCH.z);
  // under the desk: bin, power strip, loops of cable
  part(cyl(0.6, 1.5, 10, 0.7), BLACK, room, 0.6, 0.75, BENCH.z + 0.3, { line: 0.02 }); part(cyl(0.76, 0.14, 10), PAPER, room, 0.6, 1.5, BENCH.z + 0.3, { flat: true });
  part(box(0.2, 1.3, 0.3, 0.03), 0xe09a4f, room, BENCH.x - 0.9, 0.9, BENCH.z + 0.36); for (let i = 0; i < 4; i++) part(box(0.06, 0.16, 0.2, 0.01), BLACK, room, BENCH.x - 0.78, 0.45 + i * 0.3, BENCH.z + 0.4, { flat: true });
  part(box(0.8, 0.26, 0.5, 0.04), BLACK, room, -1.4, 0.13, BENCH.z + 1.0);
  wire([[-3.2, 2.1, BENCH.z + 0.6], [-2.8, 0.9, BENCH.z + 0.8], [-2.2, 1.3, BENCH.z + 0.7], [-1.4, 0.3, BENCH.z + 1.0]], BLACK); wire([[1.6, 2.1, BENCH.z + 0.2], [1.2, 0.7, BENCH.z + 0.5], [-0.4, 1.0, BENCH.z + 0.5], [-0.8, 0.5, BENCH.z + 0.4]], BLACK); wire([[-1.0, 0.1, BENCH.z + 1.2], [0.4, 0.08, BENCH.z + 1.7], [2.2, 0.08, BENCH.z + 1.4]], BLACK);
  // left wing: a test rig along the partition and small desk clutter
  const machine = new THREE.Group(); machine.position.set(-5.0, 2.3, BENCH.z - 0.3); room.add(machine);
  part(box(3.0, 0.12, 0.34, 0.02), 0xb9bcc2, machine, 0, 0.08, -0.55);
  [[-1.1, 0xdfe2e6, 0.6, 0.8], [-0.4, 0x8d939c, 0.7, 0.9], [0.35, 0xdfe2e6, 0.5, 0.7], [0.9, 0xf2efe4, 0.36, 0.6]].forEach(([x, c, w, hh]) => { part(box(w, hh, 0.6, 0.04), c, machine, x, 0.14 + hh / 2, -0.5, { line: 0.04 }); part(box(w * 0.6, 0.08, 0.04, 0.01), 0x8fd67a, machine, x, hh, -0.18, { glow: true }); part(box(w * 0.7, 0.06, 0.04, 0.01), BLACK, machine, x, hh * 0.45, -0.18, { flat: true }); });
  for (const x of [-1.5, 1.25]) part(box(0.14, 0.5, 0.5, 0.02), 0xe09a4f, machine, x, 0.34, -0.5);
  const press = part(box(0.4, 0.1, 0.06, 0.01), 0xf2d94a, machine, -0.4, 0.5, -0.18, { glow: true });
  const beacon = part(ball(0.13), 0xff3b4a, machine, 0.9, 0.95, -0.4, { glow: true });
  wire([[-6.1, 2.9, BENCH.z - 0.7], [-6.5, 2.4, BENCH.z + 0.2], [-5.8, 2.32, BENCH.z + 0.8], [-4.6, 2.32, BENCH.z + 0.5], [-4.2, 2.6, BENCH.z - 0.4]], 0x2f6fb5); wire([[-4.7, 2.8, BENCH.z - 0.6], [-4.4, 2.34, BENCH.z + 0.1], [-3.4, 2.32, BENCH.z + 0.4], [-2.9, 2.32, BENCH.z + 0.9]], 0x2f6fb5); wire([[-5.4, 2.7, BENCH.z - 0.6], [-5.2, 2.34, BENCH.z], [-5.6, 2.32, BENCH.z + 0.5]], PAPER);
  solid(1.4, 0.2, 0.5, -5.0, 2.5, BENCH.z - 0.8);
  part(box(1.7, 0.2, 1.15, 0.08), 0x202227, room, -5.9, 2.38, BENCH.z + 0.75, { line: 0.02 }).rotation.y = 0.12; part(box(0.3, 0.1, 0.2, 0.03), GREY, room, -5.7, 2.52, BENCH.z + 0.8);              // sleeve
  part(box(1.5, 0.08, 1.05, 0.03), BLACK, room, -3.9, 2.31, BENCH.z + 0.75).rotation.y = -0.1; part(box(1.0, 0.1, 0.72, 0.02), 0xb98a72, room, -4.05, 2.4, BENCH.z + 0.75).rotation.y = -0.1; part(box(0.5, 0.08, 0.3, 0.02), 0x6a4a3e, room, -3.3, 2.4, BENCH.z + 0.5);   // flat clutter
  part(new THREE.SphereGeometry(0.34, 12, 8, 0, 6.3, 0, 1.5), PAPER, room, -4.3, 2.3, BENCH.z - 0.05, { line: 0.05 }); part(cyl(0.3, 0.06, 10), 0xc9a36a, room, -3.6, 2.3, BENCH.z - 0.1, { flat: true });
  penCup(-3.3, 2.27, BENCH.z - 0.9);
  const stand = new THREE.Group(); stand.position.set(-6.6, 2.27, BENCH.z - 0.2); stand.rotation.y = 0.5; room.add(stand); for (const s of [-1, 1]) { part(box(0.1, 1.2, 0.1, 0.02), PAPER, stand, s * 0.7, 0.55, 0.2).rotation.x = 0.5; part(box(0.1, 0.9, 0.1, 0.02), PAPER, stand, s * 0.7, 0.42, -0.2).rotation.x = -0.4; } part(box(1.5, 0.1, 0.1, 0.02), PAPER, stand, 0, 0.3, 0.45); part(box(1.5, 0.1, 0.1, 0.02), PAPER, stand, 0, 0.95, -0.02);
  // right top: wide screen, portrait screen on an arm, keyboard, mouse, phone, tray, bottles
  const codeTex = paint(54, 16, () => {});
  const ultra = new THREE.Group(); ultra.position.set(BENCH.x + 1.4, 2.27, BENCH.z - 0.55); room.add(ultra);
  [-1, 0, 1].forEach((k) => { const seg = new THREE.Group(); seg.position.set(k * 1.14, 0, Math.abs(k) * 0.13); seg.rotation.y = -k * 0.22; ultra.add(seg); part(box(1.2, 1.32, 0.12, 0.03), BLACK, seg, 0, 1.36, 0, { line: 0.02 }); const t = codeTex.clone(); t.repeat.set(1 / 3, 1); t.offset.set((k + 1) / 3, 0); t.needsUpdate = true; (ultra.userData.t = ultra.userData.t || []).push(t); part(box(1.14, 1.22, 0.03, 0.01), 0xffffff, seg, 0, 1.36, 0.07, { glow: true, map: t }); });
  part(cyl(0.09, 0.8, 6), BLACK, ultra, 0, 0.4, -0.15); part(box(1.3, 0.06, 0.8, 0.02), BLACK, ultra, 0, 0.03, -0.1);
  const sideTex = paint(12, 22, (g) => { g.fillStyle = "#f4f4ee"; g.fillRect(0, 0, 12, 22); g.fillStyle = "#3d6fb0"; g.fillRect(0, 0, 12, 2); for (let r = 0; r < 9; r++) { g.fillStyle = r % 3 ? "#c9cdd3" : "#9aa0aa"; g.fillRect(1, 3 + r * 2, 3 + ((rnd() * 7) | 0), 1); } g.fillStyle = "#f2d94a"; g.fillRect(7, 12, 4, 4); g.fillStyle = "#3d6fb0"; g.fillRect(0, 11, 12, 1); });
  const portrait = new THREE.Group(); portrait.position.set(BENCH.x + 4.1, 2.27, BENCH.z - 0.35); portrait.rotation.y = -0.4; room.add(portrait);
  part(box(1.1, 1.9, 0.1, 0.03), BLACK, portrait, 0, 1.75, 0, { line: 0.02 }); part(box(1.02, 1.8, 0.03, 0.01), 0xffffff, portrait, 0, 1.75, 0.06, { glow: true, map: sideTex }); part(cyl(0.07, 1.5, 6), BLACK, portrait, 0.3, 0.75, -0.25); part(box(0.7, 0.1, 0.1, 0.03), BLACK, portrait, 0.15, 1.5, -0.2); part(box(0.5, 0.1, 0.4, 0.03), BLACK, portrait, 0.3, 0.05, -0.25);
  const kbTex = paint(30, 10, (g) => { g.fillStyle = "#cfc9b8"; g.fillRect(0, 0, 30, 10); for (let r = 0; r < 4; r++) for (let c = 0; c < 14; c++) { g.fillStyle = (c === 0 || c === 13 || r === 0) ? "#8d939c" : "#f1ecdd"; if ((r === 1 && c === 13) || (r === 3 && c === 0) || (r === 0 && c === 0) || (r === 3 && c === 12)) g.fillStyle = "#e09a4f"; g.fillRect(1 + c * 2, 1 + r * 2, 1, 1); } });
  part(box(1.9, 0.16, 0.72, 0.04), 0xffffff, room, BENCH.x + 1.9, 2.36, BENCH.z + 0.8, { map: kbTex, line: 0.03 }).rotation.x = 0.08;
  part(box(0.34, 0.36, 0.5, 0.12), BLACK, room, BENCH.x + 3.5, 2.44, BENCH.z + 0.85, { line: 0.05 });
  part(box(0.9, 0.3, 1.0, 0.06), BLACK, room, BENCH.x - 0.2, 2.42, BENCH.z + 0.1, { line: 0.03 }); part(box(0.36, 0.5, 0.06, 0.02), 0x7cc4f2, room, BENCH.x - 0.1, 2.72, BENCH.z - 0.05, { glow: true }).rotation.x = -0.5; part(box(0.28, 0.2, 0.9, 0.08), 0x26282e, room, BENCH.x - 0.62, 2.56, BENCH.z + 0.1);   // desk phone
  part(cyl(0.22, 0.05, 10), BLACK, room, BENCH.x + 0.75, 2.3, BENCH.z + 0.55); part(box(0.06, 0.4, 0.06, 0.01), BLACK, room, BENCH.x + 0.75, 2.5, BENCH.z + 0.5); part(box(0.36, 0.6, 0.06, 0.03), 0x202227, room, BENCH.x + 0.75, 2.85, BENCH.z + 0.52).rotation.x = -0.2;   // phone on a disc stand
  part(box(0.7, 0.3, 0.5, 0.03), PAPER, room, BENCH.x + 1.3, 2.42, BENCH.z + 0.1, { line: 0.04 }); part(box(0.5, 0.1, 0.34, 0.01), 0xf2d94a, room, BENCH.x + 1.3, 2.5, BENCH.z + 0.1, { flat: true });                 // organiser tray
  part(cyl(0.13, 0.55, 8), 0xdff3f6, room, BENCH.x + 2.5, 2.55, BENCH.z + 0.15); part(box(0.2, 0.2, 0.02, 0.005), 0x2f6fb5, room, BENCH.x + 2.5, 2.55, BENCH.z + 0.29, { flat: true }); part(cyl(0.04, 0.22, 5), PAPER, room, BENCH.x + 2.5, 2.92, BENCH.z + 0.15);   // pump bottle
  part(cyl(0.08, 0.26, 6), 0xe09a4f, room, BENCH.x + 2.15, 2.4, BENCH.z + 0.3); part(cyl(0.085, 0.07, 6), PAPER, room, BENCH.x + 2.15, 2.56, BENCH.z + 0.3, { flat: true });
  part(box(1.0, 0.03, 1.3, 0.01), PAPER, room, BENCH.x - 0.5, 2.29, BENCH.z + 0.95, { flat: true }).rotation.y = 0.25;
  // on the partition: framed whiteboard with the tally, magnets, sheets, tags; a calendar; a poster further along
  const counter = paint(128, 52, () => {});
  let built = 0, shipped = 0, energy = 0.8;
  function drawCounter() { const g = counter.userData.g; g.fillStyle = "#f4f4ee"; g.fillRect(0, 0, 128, 52); g.font = "bold 13px monospace"; g.textBaseline = "middle"; g.fillStyle = "#2f6fb5"; g.fillText("BUILT " + String(built).padStart(3, "0"), 6, 14); g.fillStyle = "#d94b4b"; g.fillText("SENT  " + String(shipped).padStart(3, "0"), 6, 32); g.fillStyle = "#e9e9e0"; g.fillRect(82, 5, 22, 18); g.fillStyle = "#9aa0aa"; for (let i = 0; i < 4; i++) g.fillRect(84, 8 + i * 3, 14, 1); g.fillStyle = "#d94b4b"; g.fillRect(118, 6, 4, 4); g.fillRect(118, 20, 4, 4); g.fillStyle = "#f2d94a"; g.fillRect(117, 12, 6, 6); g.fillStyle = "#f2d94a"; g.fillRect(104, 40, 9, 9); g.fillStyle = "#3d4450"; g.fillRect(40, 2, 3, 3); g.fillRect(98, 2, 3, 3); counter.needsUpdate = true; }
  drawCounter();
  part(box(5.6, 2.5, 0.1, 0.03), 0xaeb1b6, room, BENCH.x - 3.0, 4.0, -5.53); flatPlane(5.4, 2.3, counter, BENCH.x - 3.0, 4.0, -5.46); part(box(2.4, 0.12, 0.2, 0.02), BLACK, room, BENCH.x - 3.6, 2.72, -5.45); for (const dx of [-1.6, 1.6]) part(box(0.1, 0.4, 0.3, 0.02), 0xaeb1b6, room, BENCH.x - 3.0 + dx, 5.1, -5.6);
  const flags = [0xf2d94a, 0xf2d94a, 0x7cc4f2, 0xff9fc6, 0xf2d94a].map((c, i) => part(box(0.42, 0.42, 0.03, 0.01), c, room, BENCH.x + 0.4 + i * 0.56, 3.3 + (i % 2) * 0.5, -5.56, { flat: true }));
  flatPlane(1.0, 1.8, nightTex, BENCH.x + 4.3, 3.9, -5.58);
  chair(BENCH.x + 6.3, 0.3, Math.PI - 0.7);
  // a partition with two close shelves for finished skills, and a dark dotted poster above
  partition(SHELF.x, -5.75, 7.4, 5.4);
  for (const y of [2.63, 4.28]) { block(6.6, 0.16, 1.4, OT.desk, 0xd9d3bd, SHELF.x, y + 0.04, SHELF.z - 0.05, { line: 0.015 }); solid(3.3, 0.12, 0.7, SHELF.x, y, SHELF.z - 0.05); for (const dx of [-2.9, 2.9]) part(box(0.12, 0.7, 0.9, 0.03), BLACK, room, SHELF.x + dx, y - 0.4, SHELF.z - 0.2, { flat: true }); }
  // water cooler (click the bottle or the base)
  const vendMesh = part(box(1.7, 3.6, 1.6, 0.1), 0xf2efe4, room, 16.6, 1.8, -4.6, { line: 0.02 }); solid(0.85, 2.6, 0.8, 16.6, 2.6, -4.6);
  const tankMesh = part(cyl(0.7, 1.7, 12), 0x8fd0f6, room, 16.6, 4.5, -4.6, { line: 0.03 }); part(cyl(0.3, 0.3, 8), 0x2f6fb5, room, 16.6, 3.72, -4.6);
  part(box(0.24, 0.16, 0.2, 0.03), 0x2f6fb5, room, 16.3, 2.9, -3.75); part(box(0.24, 0.16, 0.2, 0.03), 0xd94b4b, room, 16.9, 2.9, -3.75); part(box(1.2, 0.1, 0.5, 0.02), GREY, room, 16.6, 2.3, -3.7); for (let i = 0; i < 4; i++) part(cyl(0.16, 0.05, 8), PAPER, room, 17.9, 0.05 + i * 0.05, -3.9, { flat: true });
  // break corner: a dark cabinet with a radio, a rug in front
  const tileTex = paint(32, 32, (g) => { g.fillStyle = "#33463c"; g.fillRect(0, 0, 32, 32); g.strokeStyle = "#55685b"; g.lineWidth = 2; g.strokeRect(3, 3, 26, 26); g.strokeStyle = "#8c978a"; g.strokeRect(8, 8, 16, 16); });
  const tile = new THREE.Mesh(cyl(DANCE.r, 0.06, 28), toon(0xffffff, tileTex)); tile.position.set(DANCE.x, 0.03, DANCE.z); tile.receiveShadow = true; room.add(tile);
  const juke = new THREE.Group(); juke.position.set(21.2, 0, -4.4); room.add(juke);
  part(new THREE.BoxGeometry(3.2, 2.4, 1.8), 0xffffff, juke, 0, 1.2, 0, { map: tiled(OT.dark, 1, 1), line: 0.02 }); part(box(3.3, 0.14, 1.9, 0.03), 0xdcd8cc, juke, 0, 2.46, 0);
  part(box(2.0, 1.0, 0.8, 0.1), 0x26282e, juke, -0.3, 3.05, 0, { line: 0.04 });
  const speakers = [-0.55, 0.55].map((dx) => { const s = part(cyl(0.32, 0.1, 12), GREY, juke, dx - 0.3, 3.05, 0.42); s.rotation.x = Math.PI / 2; return s; });
  part(cyl(0.03, 1.2, 4), GREY, juke, 0.5, 4.0, -0.2).rotation.z = -0.3; part(cyl(0.3, 0.7, 8, 0.36), 0xd94b4b, juke, 1.2, 2.88, 0.2); for (let i = 0; i < 4; i++) part(ball(0.3), 0x4fc27a, juke, 1.2 + Math.cos(i * 1.6) * 0.2, 3.5 + i * 0.2, 0.2 + Math.sin(i * 1.6) * 0.2, { flat: true }).scale.set(0.6, 1.2, 0.6);
  solid(1.6, 1.25, 0.9, 21.2, 1.25, -4.4);
  const discoBall = part(cyl(0.2, 0.1, 8), PAPER, room, DANCE.x, 8.5, BACK + 0.3, { flat: true });
  const fan = new THREE.Group(); room.add(fan);
  const steam = [];
  // the big wall whiteboard, left of the windows: click it for a new sketch
  const board = paint(120, 56, () => {}); let boardText = "AGENT SKILLS";
  function drawBoard(sweep) {
    const g = board.userData.g; g.fillStyle = "#f4f4ee"; g.fillRect(0, 0, 120, 56);
    const v = ["AGENT SKILLS", "DRAG THE BOT", "SHIP IT", "BUILD SKILLS"].indexOf(boardText);
    g.strokeStyle = "#2f6fb5"; g.lineWidth = 1; g.beginPath();
    if (v % 2 === 0) { g.moveTo(8, 34); g.lineTo(70, 34); for (let i = 0; i < 5; i++) { g.moveTo(18 + i * 12, 38); g.arc(14 + i * 12, 38, 4, 0, 7); } g.moveTo(8, 20); g.lineTo(40, 20); g.lineTo(52, 30); g.rect(78, 12, 12, 22); g.moveTo(20, 12); g.arc(16, 12, 4, 0, 7); g.moveTo(34, 12); g.arc(30, 12, 4, 0, 7); }
    else { g.rect(8, 10, 22, 12); g.rect(46, 10, 22, 12); g.rect(84, 10, 22, 12); g.moveTo(30, 16); g.lineTo(46, 16); g.moveTo(68, 16); g.lineTo(84, 16); g.rect(46, 34, 22, 12); g.moveTo(57, 22); g.lineTo(57, 34); }
    g.stroke();
    g.strokeStyle = "#d94b4b"; g.beginPath(); g.moveTo(8, 50); for (let i = 0; i < 6; i++) { g.lineTo(14 + i * 14, 50); g.lineTo(14 + i * 14, 44); g.lineTo(21 + i * 14, 44); g.lineTo(21 + i * 14, 50); } g.stroke();
    letters(g, boardText, 104 - boardText.length * 6, 3, 1, 1, "#2b2f38");
    if (sweep >= 0 && sweep < 20) { g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(sweep * 6, 0, 6, 56); }
    board.needsUpdate = true;
  }
  drawBoard(-1);
  part(box(8.3, 4.0, 0.14, 0.03), 0xaeb1b6, room, -20.6, 5.6, BACK + 0.12, { flat: true }); const sign = flatPlane(8.0, 3.73, board, -20.6, 5.6, BACK + 0.22);
  part(box(7.6, 0.12, 0.3, 0.02), 0xaeb1b6, room, -20.6, 3.58, BACK + 0.25, { flat: true }); [0x2f6fb5, 0xd94b4b, 0x2b2f38, 0x2f6fb5].forEach((c, i) => part(box(0.7, 0.1, 0.1, 0.02), c, room, -22.6 + i * 1.1, 3.7, BACK + 0.28, { flat: true }));

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
  [[0xf4f4ee, -6, 3.4], [0xe6e8e0, 12.5, 2.8]].forEach(([c, x, z]) => { const g = new THREE.Group(); part(new THREE.IcosahedronGeometry(0.62, 0), c, g, 0, 0, 0, { line: 0.06 }); part(new THREE.IcosahedronGeometry(0.5, 0), 0xd9dbd2, g, 0.12, 0.1, 0.1, { flat: true }); ent("ball", g, new CANNON.Sphere(0.62), 0.5, x, 0.7, z, { material: bouncy }); });
  const mg = new THREE.Group(); part(cyl(0.26, 0.7, 12), 0x1b1c1f, mg, 0, 0, 0, { line: 0.08 }); part(cyl(0.17, 0.26, 10), 0x1b1c1f, mg, 0, 0.46, 0, { flat: true }); part(cyl(0.19, 0.08, 10), 0x8d939c, mg, 0, 0.62, 0, { flat: true });
  ent("mug", mg, new CANNON.Cylinder(0.34, 0.34, 0.66, 10), 0.4, MUG[0], MUG[1], MUG[2]);
  const wr = new THREE.Group(); part(box(1.0, 0.2, 0.62, 0.05), 0x26282e, wr, 0, 0, 0, { line: 0.08 }); part(box(0.8, 0.04, 0.16, 0.01), 0x9fd0b0, wr, 0, 0.11, -0.18, { glow: true }); for (let i = 0; i < 8; i++) part(box(0.14, 0.04, 0.1, 0.005), 0x8d939c, wr, -0.3 + (i % 4) * 0.2, 0.11, 0.02 + ((i / 4) | 0) * 0.16, { flat: true });
  ent("tool", wr, new CANNON.Box(V(0.5, 0.11, 0.31)), 0.5, 9, 0.4, 3.4);
  [0, 1, 2].forEach((i) => { const g = new THREE.Group(); part(new THREE.BoxGeometry(1.5, 1.5, 1.5), 0xffffff, g, 0, 0, 0, { line: 0.04, map: OT.card }); part(box(0.32, 1.52, 1.52, 0.01), TAPE, g, 0, 0, 0, { flat: true }); part(box(0.8, 0.36, 0.02, 0.01), PAPER, g, 0.1, 0.2, 0.76, { flat: true }); ent("box", g, new CANNON.Box(V(0.75, 0.75, 0.75)), 1.4, STACK.x, 0.76 + i * 1.52, STACK.z, { slot: i }); });

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
  const WORDS = { cart: "cartridge", part: "part", ball: "paper ball", can: "cup", mug: "bottle", tool: "calculator", box: "box" },
    WHERE = { cart: "back on the shelf", part: "in the delivery box", ball: "in the bin", can: "in the bin", mug: "on the desk", tool: "on the desk", box: "on the stack" };

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
    else if (Math.hypot(x - DANCE.x, z - DANCE.z) < DANCE.r + 0.5) brain.push({ wait: 1.6, pose: "wave", face: 0, enter: () => { say("> nice rug. good spot for a break"); mood("happy", 1500); } });
    else if (Math.abs(x - CRATE.x) < 2.6 && back) brain.push({ wait: 1.3, pose: "bend", face: Math.PI, enter: () => { say("> rummaging"); mood("wow", 1200); }, exit: () => { for (let i = 0; i < Math.min(3, MAX_PARTS - count("part")); i++) { const p = makePart(CRATE.x, 3, CRATE.z); p.body.velocity.set((Math.random() - 0.3) * 14, 13, 4 + Math.random() * 5); p.body.angularVelocity.set(4, 3, 2); } } });
    else if (Math.abs(x - SHELF.x) < 3.4 && back) brain.push({ wait: 1.5, pose: "cheer", face: Math.PI, enter: () => { say("> " + slots.filter((s) => s.cart).length + " of 8 on the shelf"); mood("check", 1400); } });
    else if (Math.abs(x + 18.2) < 1.6 && back) brain.push({ wait: 2.4, pose: "build", face: Math.PI, enter: () => { say("> checking the print queue"); mood("wow", 2300); } });
    else if (Math.abs(x - 16.6) < 1.7 && back) brain.push({ wait: 1.6, pose: "reach", face: Math.PI, enter: () => { say("> hydration is for humans"); mood("alert", 1500); } });
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
    troffers.forEach((l) => { l.visible = lampKick > 0 ? Math.random() > 0.45 : true; }); exitGlow.visible = ((t * 1.5) | 0) % 8 !== 0;
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
      const g = codeTex.userData.g, ph = (t * 2) | 0; g.fillStyle = "#d9dbe0"; g.fillRect(0, 0, 54, 16); g.fillStyle = "#3d6fb0"; g.fillRect(0, 0, 54, 1);
      g.fillStyle = "#c2c5cc"; g.fillRect(1, 2, 20, 13); g.fillStyle = "#f4f4ee"; g.fillRect(22, 2, 12, 13); g.fillRect(35, 2, 18, 13);
      [["#35b8a6", 3, 4, 4, 5], ["#63c070", 8, 4, 4, 5], ["#e58aa6", 13, 5, 5, 2], ["#2b2f38", 8, 10, 6, 3], ["#35b8a6", 3, 10, 3, 3]].forEach(([c, x, y, w, hh], i) => { g.fillStyle = (i === ph % 5) ? "#f2d94a" : c; g.fillRect(x, y, w, hh); });
      for (let r = 0; r < 6; r++) { g.fillStyle = r === ph % 6 ? "#3d6fb0" : "#9aa0aa"; g.fillRect(23 + (r % 2), 3 + r * 2, 5 + ((r * 5) % 5), 1); }
      g.fillStyle = "#d94b4b"; g.fillRect(36, 3, 16, 2); g.fillStyle = "#f2d94a"; for (let r = 0; r < 4; r++) g.fillRect(37 + (r % 2) * 7, 7 + r * 2, 3, 1); g.fillStyle = "#9aa0aa"; for (let r = 0; r < 4; r++) g.fillRect(41 + (r % 2) * 7, 7 + r * 2, 2, 1);
      ultra.userData.t.forEach((q) => { q.needsUpdate = true; });
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
    day: { sun: C(0xfffaf0), sunPower: 1.25, fill: 1.7, sky: C(0xffffff), tint: C(0xffffff), lamp: 70 },
    dusk: { sun: C(0xffb089), sunPower: 0.9, fill: 1.15, sky: C(0xffa9c4), tint: new THREE.Color(1.05, 0.92, 0.98), lamp: 110 },
    night: { sun: C(0x7d95ff), sunPower: 0.45, fill: 0.42, sky: C(0x2a2f7a), tint: new THREE.Color(0.86, 0.9, 1.12), lamp: 170 }
  };
  let sceneMood = "day", raining = false, wind = 0, lowG = false;
  const RAIN = 260, rainPos = new Float32Array(RAIN * 3); for (let i = 0; i < RAIN; i++) rainPos.set([(Math.random() - 0.5) * 96, Math.random() * 32, 6.5 + Math.random() * 14], i * 3);
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xcfe6ff, size: 2, sizeAttenuation: false })); rain.frustumCulled = false; rain.visible = false; scene.add(rain);
  const actions = {
    day() { sceneMood = "day"; say("> lights up. back to it"); mood("happy", 900); },
    dusk() { sceneMood = "dusk"; say("> golden hour through the windows"); mood("heart", 1100); },
    night() { sceneMood = "night"; say("> lights on. night shift"); mood("wink", 1100); },
    rain() { raining = !raining; say(raining ? "> rain. glad the roof holds" : "> rain's passing"); mood(raining ? "alert" : "happy", 1000); return raining; },
    quake() { quake = 1.6; for (const e of ents) if (!e.carried) { e.body.wakeUp(); e.body.velocity.set((Math.random() - 0.5) * 16, 6 + Math.random() * 9, (Math.random() - 0.3) * 7); e.body.angularVelocity.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); e.rest = 0; }
      if (!robot.held) brain.interrupt("quake", () => { mood("dizzy", 1500); rb.velocity.y = 10; say("> EARTHQUAKE. everything was just tidy"); }); },
    gravity() { lowG = !lowG; world.gravity.set(0, lowG ? -5 : -34, 0); for (const e of ents) { e.body.wakeUp(); if (lowG && !e.carried) e.body.velocity.y += 3 + Math.random() * 3; } if (lowG && !robot.held) rb.velocity.y = 7; say(lowG ? "> gravity's gone soft. wheee" : "> and we're heavy again"); mood(lowG ? "wow" : "happy", 1200); return lowG; },
    spill() { const n = Math.max(0, Math.min(6, MAX_PARTS - count("part"))); if (!n) { say("> that's every part we own. clean-up first"); mood("alert", 1200); return; }
      for (let i = 0; i < n; i++) { const p = makePart(CRATE.x, 6.2, CRATE.z); p.body.velocity.set((Math.random() - 0.35) * 22, 4 + Math.random() * 8, 5 + Math.random() * 6); p.body.angularVelocity.set(5, 4, 3); } burst(CRATE.x, 6.6, CRATE.z, 20, 10); say("> a delivery just tipped over. parts everywhere"); mood("alert", 1200); },
    party() { if (robot.held) return; brain.interrupt("party"); brain.push({ enter: () => { say("> break time"); mood("note"); } }, { go: [DANCE.x, DANCE.z], reach: 0.8 }, { wait: 5, pose: "dance", exit: calmFace }); }
  };
  // click targets in the scene
  const SIGNS = ["AGENT SKILLS", "DRAG THE BOT", "SHIP IT", "BUILD SKILLS"]; let signAt = 0;
  tappable(sign, () => { boardText = SIGNS[++signAt % SIGNS.length]; drawBoard(-1); say("> new sketch on the whiteboard"); });
  tappable(tankMesh, () => { leak = { t: 2.0, x: 16.3, y: 2.9, z: -3.6, vx: -1 }; say("> someone left the cooler running"); mood("alert", 1000); });
  tappable(arcadeMesh, () => { if (count("ball") >= MAX_SMALL) { say("> out of paper. finally"); return; } const g = new THREE.Group(); part(new THREE.IcosahedronGeometry(0.5, 0), 0xf4f4ee, g, 0, 0, 0, { line: 0.07 }); const p = ent("ball", g, new CANNON.Sphere(0.5), 0.3, -18.2, 3.7, -3.6, { material: bouncy }); p.body.velocity.set((Math.random() - 0.3) * 6, 5, 8); burst(-18.2, 3.5, -3.6, 5, 4); say("> the printer's spitting out pages again"); });
  tappable(vendMesh, () => { if (count("can") >= MAX_SMALL) { say("> it's empty. you drank it dry"); return; } const c = makeCan(16.6, 1.0, -3.2); c.body.velocity.set((Math.random() - 0.5) * 4, 3, 7); burst(16.6, 1.2, -3.4, 6, 4); say("> a cup. someone has to bin it though"); });
  clouds.forEach((c) => tappable(c, () => actions.rain()));
  troffers.forEach((l) => tappable(l, () => { lampKick = 1.2; say("> that tube needs replacing"); }));
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
  say("> morning. booting up");
  requestAnimationFrame(frame);
  return actions;
}
