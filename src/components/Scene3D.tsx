import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
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
import { packTable } from '../domain/packing';
import { computeStats } from '../domain/layout';
import type { Layout } from '../domain/types';

// A palette of "VHS cover" colors for the mosaic.
const COVERS = [
  '#e2574c', '#f0a132', '#f7d154', '#4fb477', '#3a9dbf',
  '#5b6ee1', '#8e5ad1', '#d264a8', '#c0392b', '#2c7873',
  '#e08e45', '#6d8ea0', '#b5651d', '#7a9e3f', '#9b59b6',
];

type Props = {
  layout: Layout;
  onClose: () => void;
};

type Disposable = { dispose: () => void };

export function Scene3D({ layout, onClose }: Props) {
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
    const tapeMat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.05 });
    const disposables: Disposable[] = [flatGeo, standGeo, tapeMat];
    const cursor = { n: 0 };
    const color = new THREE.Color();
    const dummy = new THREE.Object3D();

    for (const item of layout.items) {
      const kind = itemKindById(item.kindId);
      const group = new THREE.Group();
      group.position.set(item.xFt - tentFt / 2, 0, item.yFt - tentFt / 2);
      group.rotation.y = (-item.rotation * Math.PI) / 180;
      scene.add(group);

      if (kind.category !== 'table') {
        if (kind.prop === 'tv') buildTV(group, disposables);
        else if (kind.prop === 'vinyl') buildVinyl(group, disposables, cursor, color);
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

      // Flat tapes on top
      const pack = packTable(
        widthFt * IN_PER_FT, lengthFt * IN_PER_FT, VHS.longIn, VHS.shortIn,
      );
      const inst = new THREE.InstancedMesh(flatGeo, tapeMat, pack.count);
      inst.castShadow = true;
      inst.receiveShadow = true;
      for (let i = 0; i < pack.placements.length; i++) {
        const p = pack.placements[i];
        dummy.position.set(
          (p.x + p.w / 2) / IN_PER_FT - lengthFt / 2,
          tableTopY + tapeThick / 2,
          (p.y + p.h / 2) / IN_PER_FT - widthFt / 2,
        );
        dummy.rotation.set(0, p.rotated ? Math.PI / 2 : 0, 0);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        color.set(COVERS[(cursor.n++ * 7) % COVERS.length]);
        inst.setColorAt(i, color);
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      group.add(inst);
      disposables.push(inst);

      // Front rack
      if (item.frontRack) {
        buildRack(group, {
          lengthFt, widthFt, tableTopY, standGeo, tapeMat,
          faceShort, faceLong, disposables, cursor, color, dummy,
        });
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
  }, [layout]);

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
    lengthFt: number; widthFt: number; tableTopY: number;
    standGeo: THREE.BoxGeometry; tapeMat: THREE.MeshStandardMaterial;
    faceShort: number; faceLong: number;
    disposables: Disposable[]; cursor: { n: number };
    color: THREE.Color; dummy: THREE.Object3D;
  },
) {
  const lean = (RACK_LEAN_DEG * Math.PI) / 180;
  const slope = o.tableTopY / Math.cos(lean);
  const baseOut = o.tableTopY * Math.tan(lean);
  const boardThick = 0.06;

  const rack = new THREE.Group();
  rack.position.set(0, o.tableTopY / 2, o.widthFt / 2 + baseOut / 2);
  rack.rotation.x = -lean;
  parent.add(rack);

  // Plywood board
  const boardMat = new THREE.MeshStandardMaterial({ color: '#b98a4b', roughness: 0.85 });
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(o.lengthFt, slope, boardThick),
    boardMat,
  );
  board.castShadow = true;
  board.receiveShadow = true;
  rack.add(board);
  o.disposables.push(board.geometry, boardMat);

  // Standing tapes, face-out, RACK_ROWS rows
  const perRow = Math.floor(o.lengthFt / o.faceShort);
  if (perRow < 1) return;
  const count = perRow * RACK_ROWS;
  const inst = new THREE.InstancedMesh(o.standGeo, o.tapeMat, count);
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
      o.color.set(COVERS[(o.cursor.n++ * 7) % COVERS.length]);
      inst.setColorAt(idx, o.color);
      idx++;
    }
  }
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  rack.add(inst);
  o.disposables.push(inst);
}

// ---------- CRT TV on a stand ----------
function buildTV(parent: THREE.Group, disposables: Disposable[]) {
  const standH = 1.6;
  const standMat = new THREE.MeshStandardMaterial({ color: '#33415a', roughness: 0.7 });
  const stand = new THREE.Mesh(new THREE.BoxGeometry(1.5, standH, 1.4), standMat);
  stand.position.y = standH / 2;
  stand.castShadow = true;
  stand.receiveShadow = true;
  parent.add(stand);
  disposables.push(stand.geometry, standMat);

  // CRT body (deeper at the back)
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#9ca3af', roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.35, 1.4), bodyMat);
  body.position.y = standH + 0.7;
  body.castShadow = true;
  parent.add(body);
  disposables.push(body.geometry, bodyMat);

  // Screen (slightly emissive, faces +z / front)
  const screenMat = new THREE.MeshStandardMaterial({
    color: '#0b1a2a', emissive: '#12324f', emissiveIntensity: 0.6, roughness: 0.2,
  });
  const screen = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.0, 0.06), screenMat);
  screen.position.set(0, standH + 0.72, 0.72);
  parent.add(screen);
  disposables.push(screen.geometry, screenMat);
}

// ---------- Vinyl display (crate of records) ----------
function buildVinyl(
  parent: THREE.Group,
  disposables: Disposable[],
  cursor: { n: number },
  color: THREE.Color,
) {
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
    parent.add(m);
    disposables.push(m.geometry);
  }
  disposables.push(crateMat);

  // Album sleeves standing in the crate, leaning slightly, front to back.
  const sleeve = 1.1; // ~12" covers
  const sleeveGeo = new THREE.BoxGeometry(sleeve, sleeve, 0.05);
  const sleeveMat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
  const n = 12;
  const inst = new THREE.InstancedMesh(sleeveGeo, sleeveMat, n);
  inst.castShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const z = -0.8 + (1.6 * i) / (n - 1);
    dummy.position.set(0, sleeve / 2 + 0.1, z);
    dummy.rotation.set(-0.12, 0, 0); // slight lean
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
    color.set(COVERS[(cursor.n++ * 5 + 2) % COVERS.length]);
    inst.setColorAt(i, color);
  }
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  parent.add(inst);
  disposables.push(inst, sleeveGeo, sleeveMat);
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
