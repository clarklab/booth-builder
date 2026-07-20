import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  BANNER_HEIGHT_FT,
  IN_PER_FT,
  RACK_LEAN_DEG,
  RACK_ROWS,
  TABLE_TOP_HEIGHT_IN,
  TABLE_TOP_THICKNESS_IN,
  TENT_EAVE_FT,
  TENT_PEAK_FT,
  VHS,
  itemKindById,
} from '../domain/constants';
import {
  computeStats,
  defaultRackSide,
  money,
  propRestsOnTable,
  tableFlatPlacements,
  tableTypicalPrice,
} from '../domain/layout';
import type { Layout } from '../domain/types';

// ---------- Procedural pixel-art "VHS cover" atlas ----------
// Self-contained (no network / no licensing): each cell is a randomly
// generated retro cover, heavily pixelated via NearestFilter. Tapes pick a
// cell per-instance via an InstancedBufferAttribute + a tiny shader tweak.
const COVER_COLS = 6;
const COVER_ROWS = 5;
const COVER_COUNT = COVER_COLS * COVER_ROWS;
let _coverAtlas: THREE.CanvasTexture | null = null;

function coverAtlas(): THREE.CanvasTexture {
  if (_coverAtlas) return _coverAtlas;
  const cell = 64;
  const canvas = document.createElement('canvas');
  canvas.width = COVER_COLS * cell;
  canvas.height = COVER_ROWS * cell;
  const ctx = canvas.getContext('2d')!;
  for (let r = 0; r < COVER_ROWS; r++)
    for (let c = 0; c < COVER_COLS; c++)
      drawCover(ctx, c * cell, r * cell, cell, r * COVER_COLS + c);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  _coverAtlas = tex;
  return tex;
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  seed: number,
) {
  let s = (seed * 2654435761) % 2147483647 || 12345;
  const rnd = () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
  const hue = Math.floor(rnd() * 360);
  ctx.fillStyle = `hsl(${hue}, 55%, ${22 + Math.floor(rnd() * 16)}%)`;
  ctx.fillRect(x, y, size, size);
  const grid = 8;
  const cs = size / grid;
  const accent = Math.floor(rnd() * 360);
  for (let i = 0; i < grid; i++)
    for (let j = 0; j < grid; j++) {
      if (rnd() < 0.5) {
        const h = (accent + Math.floor(rnd() * 90) - 45 + 360) % 360;
        ctx.fillStyle = `hsl(${h}, 78%, ${45 + Math.floor(rnd() * 35)}%)`;
        ctx.fillRect(x + i * cs, y + j * cs, cs + 1, cs + 1);
      }
    }
  // Title band + a bright "title" bar.
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(x + size * 0.08, y + size * 0.7, size * 0.84, size * 0.18);
  ctx.fillStyle = `hsl(${(accent + 180) % 360}, 85%, 72%)`;
  ctx.fillRect(x + size * 0.12, y + size * 0.75, size * (0.25 + rnd() * 0.5), size * 0.06);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
}

/** Scale a box geometry's UVs so each face maps to a single atlas cell. */
function scaleCoverUV(geo: THREE.BufferGeometry) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, uv.getX(i) / COVER_COLS, uv.getY(i) / COVER_ROWS);
  uv.needsUpdate = true;
}

/** Material that offsets each instance's UV to a different atlas cell. */
function coverMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    map: coverAtlas(),
    roughness: 0.55,
    metalness: 0.02,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'attribute vec2 coverOffset;\n' +
      shader.vertexShader.replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\n\tvMapUv += coverOffset;',
      );
  };
  return mat;
}

/** Clone a cover-UV geometry and attach a per-instance atlas-cell offset. */
function withCovers(
  base: THREE.BufferGeometry,
  count: number,
  seed: number,
): THREE.BufferGeometry {
  const geo = base.clone();
  const offs = new Float32Array(Math.max(count, 1) * 2);
  for (let i = 0; i < count; i++) {
    const idx = ((seed + i * 7) % COVER_COUNT + COVER_COUNT) % COVER_COUNT;
    offs[i * 2] = (idx % COVER_COLS) / COVER_COLS;
    offs[i * 2 + 1] = Math.floor(idx / COVER_COLS) / COVER_ROWS;
  }
  geo.setAttribute('coverOffset', new THREE.InstancedBufferAttribute(offs, 2));
  return geo;
}

type Props = {
  layout: Layout;
  markedAvg: number;
  onClose: () => void;
};

type Disposable = { dispose: () => void };

export function Scene3D({ layout, markedAvg, onClose }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stats = useMemo(() => computeStats(layout), [layout]);

  useEffect(() => {
    const mount = mountRef.current!;
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    const tentFt = layout.tentFt;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a1120');
    scene.fog = new THREE.Fog('#0a1120', 30, 90);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 500);
    camera.position.set(tentFt * 1.1, tentFt * 1.05, tentFt * 1.35);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3;
    controls.maxDistance = 80;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.target.set(0, TABLE_TOP_HEIGHT_IN / IN_PER_FT, 0);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(tentFt, tentFt * 2, tentFt * 0.6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const s = tentFt * 1.2;
    key.shadow.camera.left = -s;
    key.shadow.camera.right = s;
    key.shadow.camera.top = s;
    key.shadow.camera.bottom = -s;
    key.shadow.camera.far = tentFt * 6;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9db4ff, 0.4);
    fill.position.set(-tentFt, tentFt, -tentFt);
    scene.add(fill);

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: '#0e1730', roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(80, 80, 0x21406b, 0x162542);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    scene.add(grid);

    // Tent
    scene.add(buildTent(tentFt));

    // Shared tape assets
    const tableTopY = TABLE_TOP_HEIGHT_IN / IN_PER_FT;
    const topThick = TABLE_TOP_THICKNESS_IN / IN_PER_FT;
    const tapeThick = VHS.thicknessIn / IN_PER_FT;
    const faceLong = VHS.longIn / IN_PER_FT; // 187mm
    const faceShort = VHS.shortIn / IN_PER_FT; // 103mm

    const flatGeo = new THREE.BoxGeometry(faceLong * 0.94, tapeThick, faceShort * 0.94);
    const standGeo = new THREE.BoxGeometry(faceShort * 0.9, faceLong * 0.9, tapeThick * 0.9);
    scaleCoverUV(flatGeo);
    scaleCoverUV(standGeo);
    const coverMat = coverMaterial();
    const disposables: Disposable[] = [flatGeo, standGeo, coverMat];
    const cursor = { n: 0 };
    const dummy = new THREE.Object3D();
    const statsInner = computeStats(layout);

    for (const item of layout.items) {
      const kind = itemKindById(item.kindId);
      if (kind.prop === 'banner') {
        buildBanner(scene, tentFt, item.bannerEdge ?? 0, disposables);
        continue;
      }
      const group = new THREE.Group();
      group.position.set(item.xFt - tentFt / 2, 0, item.yFt - tentFt / 2);
      group.rotation.y = (-item.rotation * Math.PI) / 180;
      scene.add(group);

      if (kind.category !== 'table') {
        // A prop sitting over a table rests on the tabletop; otherwise the floor.
        const baseY = propRestsOnTable(item, layout) ? tableTopY : 0;
        if (kind.prop === 'tv') buildTV(group, baseY, disposables);
        else if (kind.prop === 'vinyl') buildVinyl(group, baseY, disposables, coverMat, cursor);
        continue;
      }

      const lengthFt = kind.lengthFt;
      const widthFt = kind.widthFt;

      // Table top
      const topMat = new THREE.MeshStandardMaterial({ color: '#c9a56a', roughness: 0.75 });
      const top = new THREE.Mesh(new THREE.BoxGeometry(lengthFt, topThick, widthFt), topMat);
      top.position.y = tableTopY - topThick / 2;
      top.castShadow = true;
      top.receiveShadow = true;
      group.add(top);
      disposables.push(top.geometry, topMat);

      // Legs
      const legMat = new THREE.MeshStandardMaterial({
        color: '#4b5563', roughness: 0.4, metalness: 0.6,
      });
      const legGeo = new THREE.BoxGeometry(0.1, tableTopY - topThick, 0.1);
      const inset = 0.25;
      for (const [lx, lz] of [
        [lengthFt / 2 - inset, widthFt / 2 - inset],
        [-(lengthFt / 2 - inset), widthFt / 2 - inset],
        [lengthFt / 2 - inset, -(widthFt / 2 - inset)],
        [-(lengthFt / 2 - inset), -(widthFt / 2 - inset)],
      ] as [number, number][]) {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(lx, (tableTopY - topThick) / 2, lz);
        leg.castShadow = true;
        group.add(leg);
      }
      disposables.push(legGeo, legMat);

      // Flat tapes on top (with tapes under any prop removed)
      const placements = tableFlatPlacements(item, layout);
      const flatCovered = withCovers(flatGeo, placements.length, cursor.n);
      cursor.n += placements.length;
      const inst = new THREE.InstancedMesh(flatCovered, coverMat, placements.length);
      inst.castShadow = true;
      inst.receiveShadow = true;
      for (let i = 0; i < placements.length; i++) {
        const p = placements[i];
        dummy.position.set(
          (p.x + p.w / 2) / IN_PER_FT - lengthFt / 2,
          tableTopY + tapeThick / 2,
          (p.y + p.h / 2) / IN_PER_FT - widthFt / 2,
        );
        dummy.rotation.set(0, p.rotated ? Math.PI / 2 : 0, 0);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
      disposables.push(inst, flatCovered);

      // Front rack (on the chosen edge)
      if (item.frontRack) {
        const side = item.rackSide ?? defaultRackSide(item, layout);
        const onLongEdge = side === 0 || side === 2;
        buildRack(group, {
          edgeLen: onLongEdge ? lengthFt : widthFt,
          halfDepth: onLongEdge ? widthFt / 2 : lengthFt / 2,
          yaw: [0, Math.PI / 2, Math.PI, -Math.PI / 2][side],
          tableTopY, standGeo, coverMat, faceShort, disposables, cursor, dummy,
        });
      }

      // Hovering, camera-facing price label
      const stat = statsInner.perTable.find((p) => p.uid === item.uid);
      if (stat) {
        const sprite = makeLabelSprite(
          money(tableTypicalPrice(stat, markedAvg)),
          `${stat.tapes} tapes`,
          disposables,
        );
        sprite.position.set(0, tableTopY + 2.6, 0);
        group.add(sprite);
      }
    }

    // Render loop
    let raf = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      for (const d of disposables) d.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
        else if (m) m.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [layout, markedAvg]);

  return (
    <div className="overlay">
      <div className="overlay-bar">
        <h2>🎡 3D Booth Preview</h2>
        <span className="badge">
          Tent {layout.tentFt}′×{layout.tentFt}′ · {stats.tableCount} tables ·{' '}
          <strong>{stats.totalTapes.toLocaleString()} VHS tapes</strong>
        </span>
        <div className="spacer" />
        <button className="btn" onClick={onClose}>✕ Close</button>
      </div>
      <div className="overlay-canvas" ref={mountRef}>
        <div className="overlay-hint">
          drag to orbit · scroll to zoom · right-drag to pan
        </div>
      </div>
    </div>
  );
}

// ---------- Front rack (leaned display board with standing tapes) ----------
function buildRack(
  parent: THREE.Group,
  o: {
    edgeLen: number; halfDepth: number; yaw: number; tableTopY: number;
    standGeo: THREE.BoxGeometry; coverMat: THREE.MeshStandardMaterial;
    faceShort: number;
    disposables: Disposable[]; cursor: { n: number };
    dummy: THREE.Object3D;
  },
) {
  const lean = (RACK_LEAN_DEG * Math.PI) / 180;
  const slope = o.tableTopY / Math.cos(lean);
  const baseOut = o.tableTopY * Math.tan(lean);
  const boardThick = 0.06;

  // Holder orients the canonical rack (leaning out toward +z) to the chosen edge.
  const holder = new THREE.Group();
  holder.rotation.y = o.yaw;
  parent.add(holder);

  const rack = new THREE.Group();
  rack.position.set(0, o.tableTopY / 2, o.halfDepth + baseOut / 2);
  rack.rotation.x = -lean;
  holder.add(rack);

  // Plywood board
  const boardMat = new THREE.MeshStandardMaterial({ color: '#b98a4b', roughness: 0.85 });
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(o.edgeLen, slope, boardThick),
    boardMat,
  );
  board.castShadow = true;
  board.receiveShadow = true;
  rack.add(board);
  o.disposables.push(board.geometry, boardMat);

  // Standing tapes, face-out, RACK_ROWS rows
  const perRow = Math.floor(o.edgeLen / o.faceShort);
  if (perRow < 1) return;
  const count = perRow * RACK_ROWS;
  const geo = withCovers(o.standGeo, count, o.cursor.n);
  o.cursor.n += count;
  const inst = new THREE.InstancedMesh(geo, o.coverMat, count);
  inst.castShadow = true;
  const usedW = perRow * o.faceShort;
  const rowPitch = slope / RACK_ROWS;
  const zFace = boardThick / 2 + (VHS.thicknessIn / IN_PER_FT) / 2 + 0.01;
  let idx = 0;
  for (let r = 0; r < RACK_ROWS; r++) {
    const y = -slope / 2 + rowPitch * (r + 0.5);
    for (let c = 0; c < perRow; c++) {
      const x = -usedW / 2 + o.faceShort * (c + 0.5);
      o.dummy.position.set(x, y, zFace);
      o.dummy.rotation.set(0, 0, 0);
      o.dummy.updateMatrix();
      inst.setMatrixAt(idx, o.dummy.matrix);
      idx++;
    }
  }
  inst.instanceMatrix.needsUpdate = true;
  rack.add(inst);
  o.disposables.push(inst, geo);
}

// ---------- CRT TV (sits on the given surface height) ----------
function buildTV(parent: THREE.Group, baseY: number, disposables: Disposable[]) {
  const bodyH = 1.35;
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#9ca3af', roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, bodyH, 1.4), bodyMat);
  body.position.y = baseY + bodyH / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  parent.add(body);
  disposables.push(body.geometry, bodyMat);

  // Screen (slightly emissive, faces +z / front)
  const screenMat = new THREE.MeshStandardMaterial({
    color: '#0b1a2a', emissive: '#12324f', emissiveIntensity: 0.6, roughness: 0.2,
  });
  const screen = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.0, 0.06), screenMat);
  screen.position.set(0, baseY + bodyH / 2 + 0.02, 0.72);
  parent.add(screen);
  disposables.push(screen.geometry, screenMat);
}

// ---------- Vinyl display (crate of records) ----------
function buildVinyl(
  parent: THREE.Group,
  baseY: number,
  disposables: Disposable[],
  coverMat: THREE.MeshStandardMaterial,
  cursor: { n: number },
) {
  const g = new THREE.Group();
  g.position.y = baseY;
  parent.add(g);
  const crateMat = new THREE.MeshStandardMaterial({ color: '#7c5a3a', roughness: 0.85 });
  const w = 2, d = 2, h = 1.2, t = 0.08;
  const parts: [number, number, number, number, number, number][] = [
    // [sx,sy,sz, px,py,pz]
    [w, t, d, 0, t / 2, 0], // base
    [w, h, t, 0, h / 2, -d / 2 + t / 2], // back
    [w, h, t, 0, h / 2, d / 2 - t / 2], // front
    [t, h, d, -w / 2 + t / 2, h / 2, 0], // left
    [t, h, d, w / 2 - t / 2, h / 2, 0], // right
  ];
  for (const [sx, sy, sz, px, py, pz] of parts) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), crateMat);
    m.position.set(px, py, pz);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    disposables.push(m.geometry);
  }
  disposables.push(crateMat);

  // Album sleeves standing in the crate, leaning slightly, front to back.
  const sleeve = 1.1; // ~12" covers
  const sleeveBase = new THREE.BoxGeometry(sleeve, sleeve, 0.05);
  scaleCoverUV(sleeveBase);
  const n = 12;
  const sleeveGeo = withCovers(sleeveBase, n, cursor.n);
  cursor.n += n;
  sleeveBase.dispose();
  const inst = new THREE.InstancedMesh(sleeveGeo, coverMat, n);
  inst.castShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const z = -0.8 + (1.6 * i) / (n - 1);
    dummy.position.set(0, sleeve / 2 + 0.1, z);
    dummy.rotation.set(-0.12, 0, 0); // slight lean
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  inst.instanceMatrix.needsUpdate = true;
  g.add(inst);
  disposables.push(inst, sleeveGeo);
}

// ---------- Banner hung at the top of the poles ----------
function buildBanner(
  scene: THREE.Scene,
  tentFt: number,
  edge: number,
  disposables: Disposable[],
) {
  const half = tentFt / 2;
  const H = BANNER_HEIGHT_FT;
  const yCenter = TENT_EAVE_FT - H / 2; // top flush with the eave (pole tops)
  const thick = 0.05;
  const spanX = edge === 0 || edge === 2;
  const geo = spanX
    ? new THREE.BoxGeometry(tentFt, H, thick)
    : new THREE.BoxGeometry(thick, H, tentFt);
  const mat = new THREE.MeshStandardMaterial({
    color: '#dc2626', roughness: 0.85, side: THREE.DoubleSide,
  });
  const banner = new THREE.Mesh(geo, mat);
  if (edge === 0) banner.position.set(0, yCenter, half);
  else if (edge === 2) banner.position.set(0, yCenter, -half);
  else if (edge === 1) banner.position.set(half, yCenter, 0);
  else banner.position.set(-half, yCenter, 0);
  banner.castShadow = true;
  scene.add(banner);
  disposables.push(geo, mat);

  // A pale valance stripe across the middle for a printed-banner look.
  const stripeGeo = spanX
    ? new THREE.BoxGeometry(tentFt * 0.98, H * 0.28, thick + 0.01)
    : new THREE.BoxGeometry(thick + 0.01, H * 0.28, tentFt * 0.98);
  const stripeMat = new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.9 });
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.copy(banner.position);
  scene.add(stripe);
  disposables.push(stripeGeo, stripeMat);
}

// ---------- Camera-facing price label ----------
function makeLabelSprite(
  price: string,
  sub: string,
  disposables: Disposable[],
): THREE.Sprite {
  const W = 320, H = 150;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const round = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  ctx.fillStyle = 'rgba(11,17,32,0.9)';
  round(8, 8, W - 16, H - 16, 22);
  ctx.fill();
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 4;
  round(8, 8, W - 16, H - 16, 22);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 66px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(price, W / 2, H / 2 - 14);
  ctx.fillStyle = '#9fb1c9';
  ctx.font = '30px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(sub, W / 2, H / 2 + 40);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({
    map: tex, transparent: true, depthTest: false, depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.6, 1.22, 1);
  sprite.renderOrder = 999;
  disposables.push(tex, mat);
  return sprite;
}

// ---------- Tent ----------
function buildTent(tentFt: number): THREE.Group {
  const g = new THREE.Group();
  const half = tentFt / 2;
  const eave = TENT_EAVE_FT;
  const peakY = TENT_PEAK_FT;
  const corners: [number, number][] = [
    [-half, -half], [half, -half], [half, half], [-half, half],
  ];

  const poleMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1', roughness: 0.35, metalness: 0.7,
  });
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, eave, 10);
  for (const [x, z] of corners) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, eave / 2, z);
    pole.castShadow = true;
    g.add(pole);
  }

  const linePts: THREE.Vector3[] = [];
  const peak = new THREE.Vector3(0, peakY, 0);
  const eaveV = corners.map(([x, z]) => new THREE.Vector3(x, eave, z));
  for (let i = 0; i < 4; i++) {
    linePts.push(eaveV[i].clone(), eaveV[(i + 1) % 4].clone());
    linePts.push(eaveV[i].clone(), peak.clone());
  }
  const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
  g.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: '#93c5fd' })));

  const roofPos: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = eaveV[i];
    const b = eaveV[(i + 1) % 4];
    roofPos.push(a.x, a.y, a.z, b.x, b.y, b.z, peak.x, peak.y, peak.z);
  }
  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(roofPos, 3));
  roofGeo.computeVertexNormals();
  const roofMat = new THREE.MeshStandardMaterial({
    color: '#38bdf8', transparent: true, opacity: 0.16,
    side: THREE.DoubleSide, roughness: 0.9,
  });
  g.add(new THREE.Mesh(roofGeo, roofMat));

  const valPts: THREE.Vector3[] = [];
  const drop = 0.6;
  const vEave = corners.map(([x, z]) => new THREE.Vector3(x, eave - drop, z));
  for (let i = 0; i < 4; i++) {
    valPts.push(vEave[i].clone(), vEave[(i + 1) % 4].clone());
    valPts.push(eaveV[i].clone(), vEave[i].clone());
  }
  const valGeo = new THREE.BufferGeometry().setFromPoints(valPts);
  g.add(new THREE.LineSegments(valGeo, new THREE.LineBasicMaterial({ color: '#3b6ea5' })));

  return g;
}
