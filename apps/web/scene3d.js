/**
 * 3D návrhář kuchyně — Three.js scéna z Layout JSON.
 * Jednotky layoutu jsou mm; scéna používá metry (÷1000).
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const MM = 0.001;

const FINISHES = {
  "modern-matt-anthracite": {
    label: "Antracit matt",
    door: 0x2a2d31,
    doorRough: 0.55,
    doorMetal: 0.05,
    edge: 0x1c1e22,
    top: 0x9a7b55,
    topRough: 0.35,
    wall: 0xe8e2d8,
    floor: 0xb8a990,
    handle: 0xc0c4c8,
  },
  "white-gloss-warm-oak": {
    label: "Bílý lesk + dub",
    door: 0xf4f2ec,
    doorRough: 0.12,
    doorMetal: 0.15,
    edge: 0xe6e0d4,
    top: 0xc4a574,
    topRough: 0.4,
    wall: 0xf7f4ee,
    floor: 0xd2c4a8,
    handle: 0x8a9098,
  },
  "silk-grey-bleached-oak": {
    label: "Hedvábná šedá",
    door: 0xb8b6b0,
    doorRough: 0.45,
    doorMetal: 0.04,
    edge: 0xa8a69e,
    top: 0xd8cbb0,
    topRough: 0.42,
    wall: 0xf0ece4,
    floor: 0xcfc3ad,
    handle: 0x9aa0a6,
  },
  "natural-oak-linen": {
    label: "Dub / len",
    door: 0xc9a66b,
    doorRough: 0.5,
    doorMetal: 0.02,
    edge: 0xb8955c,
    top: 0xe8e4dc,
    topRough: 0.3,
    wall: 0xf5f0e6,
    floor: 0xd6c8ae,
    handle: 0x6e7378,
  },
  "soft-beige-stone": {
    label: "Beige stone",
    door: 0xd9cfc0,
    doorRough: 0.48,
    doorMetal: 0.03,
    edge: 0xc8bba8,
    top: 0x8f8a82,
    topRough: 0.32,
    wall: 0xf6f1e8,
    floor: 0xcfc4b0,
    handle: 0xa8adb2,
  },
  "black-frame-glass": {
    label: "Black frame",
    door: 0x1a1b1d,
    doorRough: 0.35,
    doorMetal: 0.2,
    edge: 0x111214,
    top: 0x2e3034,
    topRough: 0.28,
    wall: 0xece8e0,
    floor: 0xb0a48e,
    handle: 0xd0d4d8,
  },
  "sage-green-matte": {
    label: "Šalvěj",
    door: 0x7d8b78,
    doorRough: 0.5,
    doorMetal: 0.04,
    edge: 0x6a7766,
    top: 0xd6c8b0,
    topRough: 0.4,
    wall: 0xf3efe6,
    floor: 0xcbbfa8,
    handle: 0x8e949a,
  },
  "walnut-brass": {
    label: "Ořech / mosaz",
    door: 0x5c3d2e,
    doorRough: 0.45,
    doorMetal: 0.06,
    edge: 0x4a3125,
    top: 0xe8e0d2,
    topRough: 0.3,
    wall: 0xf2ebe2,
    floor: 0xc4b49a,
    handle: 0xc4a35a,
  },
  default: {
    label: "Standard",
    door: 0xd9d2c6,
    doorRough: 0.4,
    doorMetal: 0.05,
    edge: 0xc4bbae,
    top: 0x5c5346,
    topRough: 0.35,
    wall: 0xece6dc,
    floor: 0xc2b49a,
    handle: 0xb0b4b8,
  },
};

function finishOf(styleId) {
  if (styleId && FINISHES[styleId]) return FINISHES[styleId];
  const aliases = {
    "velvet-white": "white-gloss-warm-oak",
    "cashmere-white": "white-gloss-warm-oak",
    "lancelot-gloss": "white-gloss-warm-oak",
    "handleless-acrylic": "modern-matt-anthracite",
    "lacquer-veneer-elite": "walnut-brass",
    "natural-oak-linen": "natural-oak-linen",
  };
  if (styleId && aliases[styleId] && FINISHES[aliases[styleId]]) {
    return FINISHES[aliases[styleId]];
  }
  if (styleId) {
    const s = styleId.toLowerCase();
    if (s.includes("white") || s.includes("gloss")) return FINISHES["white-gloss-warm-oak"];
    if (s.includes("anthracite") || s.includes("black") || s.includes("acrylic"))
      return FINISHES["modern-matt-anthracite"];
    if (s.includes("grey") || s.includes("gray") || s.includes("silk"))
      return FINISHES["silk-grey-bleached-oak"];
    if (s.includes("oak") || s.includes("wood") || s.includes("veneer"))
      return FINISHES["natural-oak-linen"];
  }
  return FINISHES.default;
}

export class KitchenViewer {
  constructor(container) {
    this.container = container;
    this.layout = null;
    this.styleId = null;
    this._raf = 0;
    this._kitchen = new THREE.Group();
    this._kitchen.name = "kitchen";

    const w = container.clientWidth || 800;
    const h = container.clientHeight || 480;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1714);
    this.scene.fog = new THREE.Fog(0x1a1714, 8, 18);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.05, 40);
    this.camera.position.set(2.8, 1.7, 3.4);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 10;
    this.controls.target.set(1.5, 0.9, 0);

    this._addLights();
    this.scene.add(this._kitchen);

    this._onResize = () => this.resize();
    window.addEventListener("resize", this._onResize);
    this._tick = () => {
      this._raf = requestAnimationFrame(this._tick);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    this._tick();
  }

  _addLights() {
    const hemi = new THREE.HemisphereLight(0xfff5e8, 0x3a3228, 0.55);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff0dd, 1.35);
    key.position.set(3.5, 5.5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 20;
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    key.shadow.bias = -0.0002;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xc8d4e8, 0.35);
    fill.position.set(-3, 2.5, 1);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffc9a0, 0.25);
    rim.position.set(0, 2, -3);
    this.scene.add(rim);
  }

  resize() {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 480;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  setAutoRotate(on) {
    this.controls.autoRotate = !!on;
    this.controls.autoRotateSpeed = 0.6;
  }

  setStyle(styleId) {
    this.styleId = styleId;
    if (this.layout) this.build(this.layout, styleId);
  }

  resetCamera() {
    if (!this.layout) return;
    const run = this._runWidthM();
    const cx = run / 2;
    this.controls.target.set(cx, 0.95, -0.15);
    this.camera.position.set(cx + 1.6, 1.55, 2.8);
    this.controls.update();
  }

  screenshot() {
    this.renderer.render(this.scene, this.camera);
    const a = document.createElement("a");
    a.download = `kitchen-3d-${(this.layout?.layoutId || "navrh").slice(0, 8)}.png`;
    a.href = this.renderer.domElement.toDataURL("image/png");
    a.click();
  }

  _runWidthM() {
    const bases = (this.layout?.units || []).filter((u) => u.band === "base");
    if (!bases.length) return 3.6;
    const max = Math.max(...bases.map((u) => (u.offset_mm || 0) + (u.width_mm || 0)));
    const z = (this.layout?.zones || []).find((z) => z.band === "base");
    const fillers = (z?.filler_left_mm || 0) + (z?.filler_right_mm || 0);
    return Math.max(max, (z?.usable_raw_mm || max) + fillers) * MM;
  }

  build(layout, styleId) {
    this.layout = layout;
    this.styleId = styleId || layout.styleId || this.styleId;
    const fin = finishOf(this.styleId);

    while (this._kitchen.children.length) {
      const c = this._kitchen.children.pop();
      c.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
    }

    const params = layout.params || {};
    const plinth = (params.plinth_height || 100) * MM;
    const topTh = (params.countertop_thickness || 40) * MM;
    const wallGap = (params.wall_gap || 550) * MM;
    const corpusH = 730 * MM;
    const wallH = 720 * MM;
    const baseD = 560 * MM;
    const wallD = 320 * MM;
    const overhang = 40 * MM;

    const runW = this._runWidthM();
    const roomD = 2.4;
    const roomH = 2.6;
    const roomPad = 0.35;

    // Floor
    const floorMat = new THREE.MeshStandardMaterial({
      color: fin.floor,
      roughness: 0.75,
      metalness: 0.02,
    });
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(runW + roomPad * 2 + 0.4, roomD + 0.6),
      floorMat
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(runW / 2, 0, -roomD / 2 + 0.35);
    floor.receiveShadow = true;
    this._kitchen.add(floor);

    // Back wall
    const wallMat = new THREE.MeshStandardMaterial({
      color: fin.wall,
      roughness: 0.85,
      metalness: 0,
    });
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(runW + roomPad * 2, roomH, 0.08),
      wallMat
    );
    back.position.set(runW / 2, roomH / 2, -baseD - 0.04);
    back.receiveShadow = true;
    this._kitchen.add(back);

    // Side walls
    const sideGeo = new THREE.BoxGeometry(0.08, roomH, roomD * 0.55);
    const left = new THREE.Mesh(sideGeo, wallMat);
    left.position.set(-roomPad / 2, roomH / 2, -roomD * 0.25);
    left.receiveShadow = true;
    this._kitchen.add(left);
    const right = new THREE.Mesh(sideGeo, wallMat.clone());
    right.position.set(runW + roomPad / 2, roomH / 2, -roomD * 0.25);
    right.receiveShadow = true;
    this._kitchen.add(right);

    const doorMat = new THREE.MeshStandardMaterial({
      color: fin.door,
      roughness: fin.doorRough,
      metalness: fin.doorMetal,
    });
    const edgeMat = new THREE.MeshStandardMaterial({
      color: fin.edge,
      roughness: 0.55,
      metalness: 0.05,
    });
    const topMat = new THREE.MeshStandardMaterial({
      color: fin.top,
      roughness: fin.topRough,
      metalness: 0.08,
    });
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x1a1816,
      roughness: 0.7,
      metalness: 0.05,
    });
    const handleMat = new THREE.MeshStandardMaterial({
      color: fin.handle,
      roughness: 0.25,
      metalness: 0.85,
    });

    const bases = (layout.units || []).filter((u) => u.band === "base");
    const walls = (layout.units || []).filter((u) => u.band === "wall");
    const talls = (layout.units || []).filter((u) => u.band === "tall");

    for (const u of bases) {
      this._addBaseCabinet(u, {
        plinth,
        corpusH,
        baseD,
        doorMat,
        edgeMat,
        plinthMat,
        handleMat,
      });
    }

    // Continuous worktop over base run
    if (bases.length) {
      const minX = Math.min(...bases.map((u) => u.offset_mm * MM));
      const maxX = Math.max(...bases.map((u) => (u.offset_mm + u.width_mm) * MM));
      const topW = maxX - minX + 0.004;
      const topD = baseD + overhang;
      const topY = plinth + corpusH + topTh / 2;
      const top = new THREE.Mesh(new THREE.BoxGeometry(topW, topTh, topD), topMat);
      top.position.set(minX + topW / 2, topY, -topD / 2 + overhang);
      top.castShadow = true;
      top.receiveShadow = true;
      this._kitchen.add(top);
    }

    const worktopTop = plinth + corpusH + topTh;
    for (const u of walls) {
      const bottom =
        u.bottom_from_floor_mm != null
          ? u.bottom_from_floor_mm * MM
          : worktopTop + wallGap;
      this._addWallCabinet(u, {
        bottom,
        wallH,
        wallD,
        doorMat,
        edgeMat,
        handleMat,
      });
    }

    for (const u of talls) {
      this._addTallCabinet(u, {
        plinth,
        baseD,
        doorMat,
        edgeMat,
        plinthMat,
        handleMat,
      });
    }

    // Fillers visualization
    for (const z of layout.zones || []) {
      if (z.band !== "base") continue;
      const fl = (z.filler_left_mm || 0) * MM;
      const fr = (z.filler_right_mm || 0) * MM;
      const h = plinth + corpusH;
      if (fl > 0.005) {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(fl, h, baseD * 0.95),
          edgeMat
        );
        m.position.set(fl / 2, h / 2, -baseD / 2);
        m.castShadow = true;
        this._kitchen.add(m);
      }
      if (fr > 0.005) {
        const x0 = (z.usable_raw_mm || runW / MM) * MM - fr;
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(fr, h, baseD * 0.95),
          edgeMat
        );
        m.position.set(x0 + fr / 2, h / 2, -baseD / 2);
        m.castShadow = true;
        this._kitchen.add(m);
      }
    }

    this.resetCamera();
    this.resize();
  }

  _addBaseCabinet(u, ctx) {
    const w = u.width_mm * MM;
    const x0 = u.offset_mm * MM;
    const { plinth, corpusH, baseD, doorMat, edgeMat, plinthMat, handleMat } = ctx;

    // plinth
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.004, plinth, baseD - 0.05),
      plinthMat
    );
    p.position.set(x0 + w / 2, plinth / 2, -baseD / 2 + 0.02);
    p.castShadow = true;
    this._kitchen.add(p);

    // corpus
    const corpus = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.002, corpusH, baseD - 0.01),
      edgeMat
    );
    corpus.position.set(x0 + w / 2, plinth + corpusH / 2, -baseD / 2);
    corpus.castShadow = true;
    corpus.receiveShadow = true;
    this._kitchen.add(corpus);

    // fronts
    if (u.kind === "drawers" && u.drawers?.front_heights_mm) {
      let y = plinth;
      const fronts = u.drawers.front_heights_mm;
      const gap = 0.003;
      fronts.forEach((fh, i) => {
        const hh = fh * MM - gap;
        const front = new THREE.Mesh(
          new THREE.BoxGeometry(w - 0.008, hh, 0.018),
          doorMat
        );
        front.position.set(x0 + w / 2, y + hh / 2 + gap / 2, 0.01);
        front.castShadow = true;
        this._kitchen.add(front);
        // handle
        const handle = new THREE.Mesh(
          new THREE.BoxGeometry(Math.min(0.12, w * 0.35), 0.008, 0.012),
          handleMat
        );
        handle.position.set(x0 + w / 2, y + hh - 0.03, 0.025);
        this._kitchen.add(handle);
        y += fh * MM;
      });
    } else {
      const wings = u.doors?.wings || 1;
      const wingW = (w - 0.01 - (wings - 1) * 0.003) / wings;
      for (let i = 0; i < wings; i++) {
        const front = new THREE.Mesh(
          new THREE.BoxGeometry(wingW, corpusH - 0.006, 0.018),
          doorMat
        );
        const fx = x0 + 0.005 + wingW / 2 + i * (wingW + 0.003);
        front.position.set(fx, plinth + corpusH / 2, 0.01);
        front.castShadow = true;
        this._kitchen.add(front);
        const handle = new THREE.Mesh(
          new THREE.BoxGeometry(0.01, 0.14, 0.012),
          handleMat
        );
        const hx =
          wings === 1
            ? fx + wingW * 0.35
            : i === 0
              ? fx + wingW * 0.35
              : fx - wingW * 0.35;
        handle.position.set(hx, plinth + corpusH * 0.55, 0.025);
        this._kitchen.add(handle);
      }
    }
  }

  _addWallCabinet(u, ctx) {
    const w = u.width_mm * MM;
    const x0 = u.offset_mm * MM;
    const { bottom, wallH, wallD, doorMat, edgeMat, handleMat } = ctx;

    const corpus = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.002, wallH, wallD),
      edgeMat
    );
    corpus.position.set(x0 + w / 2, bottom + wallH / 2, -wallD / 2);
    corpus.castShadow = true;
    corpus.receiveShadow = true;
    this._kitchen.add(corpus);

    const wings = u.doors?.wings || (w > 0.6 ? 2 : 1);
    const wingW = (w - 0.01 - (wings - 1) * 0.003) / wings;
    for (let i = 0; i < wings; i++) {
      const front = new THREE.Mesh(
        new THREE.BoxGeometry(wingW, wallH - 0.006, 0.016),
        doorMat
      );
      const fx = x0 + 0.005 + wingW / 2 + i * (wingW + 0.003);
      front.position.set(fx, bottom + wallH / 2, 0.008);
      front.castShadow = true;
      this._kitchen.add(front);
      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.01, 0.1, 0.01),
        handleMat
      );
      handle.position.set(fx + (i === 0 ? wingW * 0.3 : -wingW * 0.3), bottom + 0.08, 0.02);
      this._kitchen.add(handle);
    }
  }

  _addTallCabinet(u, ctx) {
    const w = u.width_mm * MM;
    const x0 = u.offset_mm * MM;
    const h = (u.corpus_height_mm || 2100) * MM;
    const { plinth, baseD, doorMat, edgeMat, plinthMat, handleMat } = ctx;

    const p = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.004, plinth, baseD - 0.05),
      plinthMat
    );
    p.position.set(x0 + w / 2, plinth / 2, -baseD / 2 + 0.02);
    this._kitchen.add(p);

    const corpus = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.002, h, baseD - 0.01),
      edgeMat
    );
    corpus.position.set(x0 + w / 2, plinth + h / 2, -baseD / 2);
    corpus.castShadow = true;
    this._kitchen.add(corpus);

    const front = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.008, h - 0.006, 0.018),
      doorMat
    );
    front.position.set(x0 + w / 2, plinth + h / 2, 0.01);
    front.castShadow = true;
    this._kitchen.add(front);

    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.18, 0.012),
      handleMat
    );
    handle.position.set(x0 + w * 0.85, plinth + h * 0.45, 0.025);
    this._kitchen.add(handle);
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener("resize", this._onResize);
    this.controls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

export { FINISHES, finishOf };
