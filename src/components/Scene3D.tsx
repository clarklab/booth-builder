import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  IN_PER_FT,
  TABLE_TOP_HEIGHT_IN,
  TABLE_TOP_THICKNESS_IN,
  TENT_EAVE_FT,
  TENT_PEAK_FT,
  VHS,
  tableKindById,
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

export function Scene3D({ layout, onClose }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stats = useMemo(() => computeStats(layout), [layout]);

  useEffect(() => {
    const mount = mountRef.current!;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a1120');
    scene.fog = new THREE.Fog('#0a1120', 30, 90);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 500);
    const tentFt = layout.tentFt;
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
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // stay above the ground
    controls.target.set(0, TABLE_TOP_HEIGHT_IN / IN_PER_FT, 0);

    // ---------- Lighting ----------
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

    // ---------- Ground ----------
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

    // ---------- Tent (wireframe canopy) ----------
    scene.add(buildTent(tentFt));

    // ---------- Tables + tapes ----------
    const tableTopY = TABLE_TOP_HEIGHT_IN / IN_PER_FT;
    const topThick = TABLE_TOP_THICKNESS_IN / IN_PER_FT;
    const tapeThick = VHS.thicknessIn / IN_PER_FT;
    const tapeW = VHS.widthIn / IN_PER_FT; // along local x
    const tapeH = VHS.heightIn / IN_PER_FT; // along local z

    const tapeGeo = new THREE.BoxGeometry(tapeW * 0.94, tapeThick, tapeH * 0.94);
    const tapeMat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.05 });

    const disposables: { dispose: () => void }[] = [tapeGeo, tapeMat];
    let tapeColorCursor = 0;

    for (const table of layout.tables) {
      const kind = tableKindById(table.kindId);
      const lengthFt = kind.lengthFt;
      const widthFt = kind.widthFt;

      const group = new THREE.Group();
      group.position.set(table.xFt - tentFt / 2, 0, table.yFt - tentFt / 2);
      group.rotation.y = (-table.rotation * Math.PI) / 180;
      scene.add(group);

      // Table top
      const topMat = new THREE.MeshStandardMaterial({
        color: '#c9a56a',
        roughness: 0.75,
      });
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(lengthFt, topThick, widthFt),
        topMat,
      );
      top.position.y = tableTopY - topThick / 2;
      top.castShadow = true;
      top.receiveShadow = true;
      group.add(top);
      disposables.push(top.geometry, topMat);

      // Legs
      const legMat = new THREE.MeshStandardMaterial({
        color: '#4b5563',
        roughness: 0.4,
        metalness: 0.6,
      });
      const legGeo = new THREE.BoxGeometry(0.1, tableTopY - topThick, 0.1);
      const inset = 0.25;
      const legXY: [number, number][] = [
        [lengthFt / 2 - inset, widthFt / 2 - inset],
        [-(lengthFt / 2 - inset), widthFt / 2 - inset],
        [lengthFt / 2 - inset, -(widthFt / 2 - inset)],
        [-(lengthFt / 2 - inset), -(widthFt / 2 - inset)],
      ];
      for (const [lx, lz] of legXY) {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(lx, (tableTopY - topThick) / 2, lz);
        leg.castShadow = true;
        group.add(leg);
      }
      disposables.push(legGeo, legMat);

      // Tapes (instanced), packed in local frame: x = length, z = width
      const pack = packTable(
        widthFt * IN_PER_FT,
        lengthFt * IN_PER_FT,
        VHS.widthIn,
        VHS.heightIn,
      );
      const inst = new THREE.InstancedMesh(tapeGeo, tapeMat, pack.count);
      inst.castShadow = true;
      inst.receiveShadow = true;
      const dummy = new THREE.Object3D();
      const color = new THREE.Color();
      for (let i = 0; i < pack.placements.length; i++) {
        const p = pack.placements[i];
        const cxIn = p.x + p.w / 2;
        const cyIn = p.y + p.h / 2;
        dummy.position.set(
          cxIn / IN_PER_FT - lengthFt / 2,
          tableTopY + tapeThick / 2,
          cyIn / IN_PER_FT - widthFt / 2,
        );
        dummy.rotation.set(0, p.rotated ? Math.PI / 2 : 0, 0);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        color.set(COVERS[(tapeColorCursor * 7) % COVERS.length]);
        inst.setColorAt(i, color);
        tapeColorCursor++;
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      group.add(inst);
      disposables.push(inst);
    }

    // ---------- Render loop ----------
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
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
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
        <button className="btn" onClick={onClose}>
          ✕ Close
        </button>
      </div>
      <div className="overlay-canvas" ref={mountRef}>
        <div className="overlay-hint">
          drag to orbit · scroll to zoom · right-drag to pan
        </div>
      </div>
    </div>
  );
}

/** Build a wireframe pop-up canopy: 4 posts, eave square, hip lines, peak,
 *  plus translucent roof panels so it reads as a real tent. */
function buildTent(tentFt: number): THREE.Group {
  const g = new THREE.Group();
  const half = tentFt / 2;
  const eave = TENT_EAVE_FT;
  const peakY = TENT_PEAK_FT;

  const corners: [number, number][] = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ];

  // Solid poles (legs)
  const poleMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    roughness: 0.35,
    metalness: 0.7,
  });
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, eave, 10);
  for (const [x, z] of corners) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, eave / 2, z);
    pole.castShadow = true;
    g.add(pole);
  }

  // Frame lines: eave square + hips to peak
  const linePts: THREE.Vector3[] = [];
  const peak = new THREE.Vector3(0, peakY, 0);
  const eaveV = corners.map(([x, z]) => new THREE.Vector3(x, eave, z));
  for (let i = 0; i < 4; i++) {
    const a = eaveV[i];
    const b = eaveV[(i + 1) % 4];
    linePts.push(a.clone(), b.clone()); // eave edge
    linePts.push(a.clone(), peak.clone()); // hip to peak
  }
  const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
  const lineMat = new THREE.LineBasicMaterial({ color: '#93c5fd' });
  g.add(new THREE.LineSegments(lineGeo, lineMat));

  // Translucent roof panels (4 triangles meeting at the peak)
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
    color: '#38bdf8',
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    roughness: 0.9,
  });
  g.add(new THREE.Mesh(roofGeo, roofMat));

  // A faint valance line just under the eave for the classic canopy look.
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
