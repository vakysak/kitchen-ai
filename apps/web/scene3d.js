/**
 * 3D návrh z katalogu skříněk (SKU) + materiály korpus/front/PD.
 * Není AI render — každá skříňka = product.mesh z knihovny.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const MM = 0.001;

function hexColor(hex) {
  return new THREE.Color(hex || "#cccccc");
}

function makeWoodTexture(hex, grain = "vertical") {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  const base = hex || "#C9A66B";
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    const shade = i % 2 === 0 ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)";
    ctx.strokeStyle = shade;
    ctx.lineWidth = 1 + (i % 3);
    if (grain === "horizontal") {
      const y = (i / 40) * 256 + Math.sin(i) * 3;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(80, y + 4, 160, y - 4, 256, y);
      ctx.stroke();
    } else {
      const x = (i / 40) * 256 + Math.sin(i) * 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 4, 80, x - 4, 160, x, 256);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  return tex;
}

function materialFromFinish(fin, fallbackHex = "#dddddd") {
  if (!fin) {
    return new THREE.MeshStandardMaterial({
      color: hexColor(fallbackHex),
      roughness: 0.45,
      metalness: 0.04,
    });
  }
  const mat = new THREE.MeshStandardMaterial({
    color: hexColor(fin.hex || fallbackHex),
    roughness: fin.roughness ?? 0.45,
    metalness: fin.metalness ?? 0.04,
  });
  if (fin.kind === "wood") {
    const tex = makeWoodTexture(fin.hex, fin.grain || "vertical");
    mat.map = tex;
    mat.color.set("#ffffff");
    mat.roughness = fin.roughness ?? 0.48;
  }
  if (fin.finish === "gloss") {
    mat.roughness = Math.min(mat.roughness, 0.14);
    mat.metalness = Math.max(mat.metalness, 0.1);
  }
  return mat;
}

function materialFromGlass(fin, fallbackHex = "#C8DCE8") {
  const hex = fin?.hex || fallbackHex;
  return new THREE.MeshPhysicalMaterial({
    color: hexColor(hex),
    transmission: fin?.transmission ?? 0.65,
    roughness: fin?.roughness ?? 0.08,
    thickness: 0.015,
    transparent: true,
    opacity: fin?.opacity ?? 0.45,
    metalness: 0.05,
    ior: 1.5,
  });
}

export class KitchenViewer {
  constructor(container) {
    this.container = container;
    this.layout = null;
    this.materialsCatalog = null;
    this.materials = {
      corpusId: "corpus-white",
      frontId: "front-white-matt",
      countertopId: "top-oak",
      glassId: "glass-clear",
    };
    this._raf = 0;
    this._kitchen = new THREE.Group();

    const w = container.clientWidth || 800;
    const h = container.clientHeight || 480;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
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
    this.scene.fog = new THREE.Fog(0x1a1714, 9, 18);

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
    this.scene.add(new THREE.HemisphereLight(0xfff5e8, 0x3a3228, 0.55));
    const key = new THREE.DirectionalLight(0xfff0dd, 1.35);
    key.position.set(3.5, 5.5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    key.shadow.bias = -0.0002;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xc8d4e8, 0.35);
    fill.position.set(-3, 2.5, 1);
    this.scene.add(fill);
  }

  setMaterialsCatalog(doc) {
    this.materialsCatalog = doc;
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
    this.controls.autoRotateSpeed = 0.55;
  }

  setMaterials(partial) {
    this.materials = { ...this.materials, ...partial };
    if (this.layout) this.build(this.layout);
  }

  resetCamera() {
    if (!this.layout) return;
    const run = this._runWidthM();
    const cx = run / 2;
    this.controls.target.set(cx, 0.95, -0.15);
    this.camera.position.set(cx + 1.55, 1.5, 2.75);
    this.controls.update();
  }

  screenshot() {
    this.renderer.render(this.scene, this.camera);
    const a = document.createElement("a");
    a.download = `kitchen-${(this.layout?.layoutId || "navrh").slice(0, 8)}.png`;
    a.href = this.renderer.domElement.toDataURL("image/png");
    a.click();
  }

  _finish(slot, id) {
    const list = this.materialsCatalog?.[slot] || [];
    return list.find((x) => x.id === id) || null;
  }

  _runWidthM() {
    const bases = (this.layout?.units || []).filter((u) => u.band === "base");
    if (!bases.length) return 3.6;
    const max = Math.max(...bases.map((u) => (u.offset_mm || 0) + (u.width_mm || 0)));
    const z = (this.layout?.zones || []).find((z) => z.band === "base");
    return Math.max(max, z?.usable_raw_mm || max) * MM;
  }

  _clear() {
    while (this._kitchen.children.length) {
      const c = this._kitchen.children.pop();
      c.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
    }
  }

  build(layout) {
    this.layout = layout;
    if (layout.materials) {
      this.materials = { ...this.materials, ...layout.materials };
    }
    this._clear();

    const corpusFin = this._finish("corpus", this.materials.corpusId);
    const frontFin = this._finish("front", this.materials.frontId);
    const topFin = this._finish("countertop", this.materials.countertopId);

    const corpusMat = materialFromFinish(corpusFin, "#F2F0EA");
    const frontMat = materialFromFinish(frontFin, "#F5F3EE");
    const topMat = materialFromFinish(topFin, "#C4A574");
    // sokl = barva dvířek / frontů
    const plinthMat = frontMat;
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0xb8bcc0,
      roughness: 0.25,
      metalness: 0.85,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xece6dc,
      roughness: 0.85,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xc2b49a,
      roughness: 0.75,
    });

    const params = layout.params || {};
    const plinth = (params.plinth_height || 100) * MM;
    const topTh = (params.countertop_thickness || 40) * MM;
    const wallGap = (params.wall_gap || 550) * MM;
    const overhang = 40 * MM;

    const runW = this._runWidthM();
    const roomD = 2.4;
    const roomH = 2.6;
    const roomPad = 0.35;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(runW + roomPad * 2 + 0.4, roomD + 0.6),
      floorMat
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(runW / 2, 0, -roomD / 2 + 0.35);
    floor.receiveShadow = true;
    this._kitchen.add(floor);

    const back = new THREE.Mesh(
      new THREE.BoxGeometry(runW + roomPad * 2, roomH, 0.08),
      wallMat
    );
    const maxBaseD = Math.max(
      0.56,
      ...((layout.units || []).filter((u) => u.band === "base").map((u) => (u.depth_mm || 560) * MM))
    );
    back.position.set(runW / 2, roomH / 2, -maxBaseD - 0.04);
    back.receiveShadow = true;
    this._kitchen.add(back);

    const sideGeo = new THREE.BoxGeometry(0.08, roomH, roomD * 0.55);
    for (const x of [-roomPad / 2, runW + roomPad / 2]) {
      const side = new THREE.Mesh(sideGeo, wallMat);
      side.position.set(x, roomH / 2, -roomD * 0.25);
      side.receiveShadow = true;
      this._kitchen.add(side);
    }

    const bases = (layout.units || []).filter((u) => u.band === "base");
    const walls = (layout.units || []).filter((u) => u.band === "wall");
    const talls = (layout.units || []).filter((u) => u.band === "tall");

    const ctx = { plinth, corpusMat, frontMat, plinthMat, handleMat };

    for (const u of bases) {
      this._placeFromCatalog(u, "base", ctx);
    }

    if (bases.length) {
      const minX = Math.min(...bases.map((u) => u.offset_mm * MM));
      const maxX = Math.max(...bases.map((u) => (u.offset_mm + u.width_mm) * MM));
      const topW = maxX - minX + 0.004;
      const baseD = (bases[0].depth_mm || 560) * MM;
      const topD = baseD + overhang;
      const corpusH = (bases[0].height_mm || bases[0].corpus_height_mm || 730) * MM;
      const top = new THREE.Mesh(new THREE.BoxGeometry(topW, topTh, topD), topMat);
      top.position.set(minX + topW / 2, plinth + corpusH + topTh / 2, -topD / 2 + overhang);
      top.castShadow = true;
      top.receiveShadow = true;
      this._kitchen.add(top);
    }

    const worktopTop =
      plinth +
      ((bases[0]?.height_mm || bases[0]?.corpus_height_mm || 730) * MM) +
      topTh;

    for (const u of walls) {
      const bottom =
        u.bottom_from_floor_mm != null
          ? u.bottom_from_floor_mm * MM
          : worktopTop + wallGap;
      this._placeFromCatalog(u, "wall", { ...ctx, bottom });
    }
    for (const u of talls) {
      this._placeFromCatalog(u, "tall", ctx);
    }

    // Fillers
    for (const z of layout.zones || []) {
      if (z.band !== "base") continue;
      const fl = (z.filler_left_mm || 0) * MM;
      const fr = (z.filler_right_mm || 0) * MM;
      const h = plinth + 730 * MM;
      const d = 560 * MM;
      if (fl > 0.005) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(fl, h, d * 0.95), corpusMat);
        m.position.set(fl / 2, h / 2, -d / 2);
        m.castShadow = true;
        this._kitchen.add(m);
      }
      if (fr > 0.005) {
        const x0 = (z.usable_raw_mm || runW / MM) * MM - fr;
        const m = new THREE.Mesh(new THREE.BoxGeometry(fr, h, d * 0.95), corpusMat);
        m.position.set(x0 + fr / 2, h / 2, -d / 2);
        m.castShadow = true;
        this._kitchen.add(m);
      }
    }

    this.resetCamera();
    this.resize();
  }

  /**
   * Postaví skříňku přesně podle katalogového product / mesh.
   */
  _placeFromCatalog(u, band, ctx) {
    const product = u.product || {};
    const mesh = { ...(u.mesh || product.mesh || {}) };
    const opts = u.options || {};
    if (opts.glass) {
      mesh.front = "glass";
      mesh.glassId = opts.glassId || mesh.glassId;
    }
    if (opts.opening) mesh.opening = opts.opening;
    const template = mesh.template || (band === "wall" ? "wall_door" : "base_door");
    const w = (u.width_mm || product.width_mm || 600) * MM;
    const h = (u.height_mm || u.corpus_height_mm || product.height_mm || 730) * MM;
    const d = (u.depth_mm || product.depth_mm || (band === "wall" ? 320 : 560)) * MM;
    const x0 = (u.offset_mm || 0) * MM;
    const { plinth, corpusMat, frontMat, plinthMat, handleMat } = ctx;
    const glassId =
      mesh.glassId || opts.glassId || this.materials.glassId || "glass-clear";
    const glassMat = materialFromGlass(this._finish("glass", glassId));

    if (band === "base" || band === "tall") {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(w - 0.004, plinth, d - 0.05),
        plinthMat
      );
      p.position.set(x0 + w / 2, plinth / 2, -d / 2 + 0.02);
      p.castShadow = true;
      this._kitchen.add(p);

      const corpus = new THREE.Mesh(
        new THREE.BoxGeometry(w - 0.002, h, d - 0.01),
        corpusMat
      );
      corpus.position.set(x0 + w / 2, plinth + h / 2, -d / 2);
      corpus.castShadow = true;
      corpus.receiveShadow = true;
      this._kitchen.add(corpus);

      const frontKind = mesh.front || (template.includes("drawer") ? "drawers" : "doors");
      if (frontKind === "drawers") {
        this._drawers(u, product, mesh, x0, w, plinth, frontMat, handleMat);
      } else if (frontKind === "glass") {
        this._glassDoors(u, product, mesh, x0, w, plinth, h, frontMat, glassMat, handleMat, 0.01);
      } else if (frontKind === "lift" || mesh.opening === "lift") {
        this._liftDoor(u, product, mesh, x0, w, plinth, h, frontMat, handleMat, 0.01);
      } else {
        this._doors(u, product, mesh, x0, w, plinth, h, frontMat, handleMat, 0.01);
      }
      return;
    }

    // wall
    const bottom = ctx.bottom || 1.4;
    const corpus = new THREE.Mesh(new THREE.BoxGeometry(w - 0.002, h, d), corpusMat);
    corpus.position.set(x0 + w / 2, bottom + h / 2, -d / 2);
    corpus.castShadow = true;
    corpus.receiveShadow = true;
    this._kitchen.add(corpus);

    const frontKind = mesh.front || "doors";
    if (frontKind === "glass") {
      this._glassDoors(
        u,
        product,
        mesh,
        x0,
        w,
        bottom,
        h,
        frontMat,
        glassMat,
        handleMat,
        0.008,
        mesh.opening === "lift"
      );
    } else if (frontKind === "lift" || mesh.opening === "lift") {
      this._liftDoor(u, product, mesh, x0, w, bottom, h, frontMat, handleMat, 0.008);
    } else {
      this._doors(u, product, mesh, x0, w, bottom, h, frontMat, handleMat, 0.008);
    }
  }

  _doors(u, product, mesh, x0, w, y0, h, frontMat, handleMat, zFront) {
    const wings = Number(u.doors?.wings || product.doors || mesh.doors || 1);
    const gap = 0.003;
    const wingW = (w - 0.01 - (wings - 1) * gap) / wings;
    const hand = (product.hand || mesh.hand || "L").toUpperCase();
    for (let i = 0; i < wings; i++) {
      const front = new THREE.Mesh(
        new THREE.BoxGeometry(wingW, h - 0.006, 0.018),
        frontMat
      );
      const fx = x0 + 0.005 + wingW / 2 + i * (wingW + gap);
      front.position.set(fx, y0 + h / 2, zFront);
      front.castShadow = true;
      this._kitchen.add(front);

      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.005, 0.12, 12),
        handleMat
      );
      let hx;
      if (wings === 1) {
        hx = hand === "R" ? fx - wingW * 0.38 : fx + wingW * 0.38;
      } else {
        hx = i === 0 ? fx + wingW * 0.38 : fx - wingW * 0.38;
      }
      handle.position.set(hx, y0 + h * 0.5, zFront + 0.016);
      this._kitchen.add(handle);
    }
  }

  /** Výklop — jedno čelo, vodorovná úchytka dole. */
  _liftDoor(u, product, mesh, x0, w, y0, h, frontMat, handleMat, zFront) {
    const front = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.01, h - 0.006, 0.018),
      frontMat
    );
    front.position.set(x0 + w / 2, y0 + h / 2, zFront);
    front.castShadow = true;
    this._kitchen.add(front);

    const hw = Math.min(0.22, w * 0.45);
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(hw, 0.01, 0.012),
      handleMat
    );
    handle.position.set(x0 + w / 2, y0 + 0.045, zFront + 0.016);
    this._kitchen.add(handle);
  }

  /**
   * Prosklená dvířka: rámeček = front, výplň = sklo.
   * @param {boolean} lift — výklop (vodorovná úchytka)
   */
  _glassDoors(u, product, mesh, x0, w, y0, h, frameMat, glassMat, handleMat, zFront, lift = false) {
    const opening = lift || mesh.opening === "lift";
    const wings = opening ? 1 : Number(u.doors?.wings || product.doors || mesh.doors || 1);
    const gap = 0.003;
    const wingW = (w - 0.01 - (wings - 1) * gap) / wings;
    const hand = (product.hand || mesh.hand || "L").toUpperCase();
    const frameT = 0.028; // šířka rámečku

    for (let i = 0; i < wings; i++) {
      const fx = x0 + 0.005 + wingW / 2 + i * (wingW + gap);
      const fy = y0 + h / 2;

      // zadní plocha rámu
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(wingW, h - 0.006, 0.014),
        frameMat
      );
      frame.position.set(fx, fy, zFront);
      frame.castShadow = true;
      this._kitchen.add(frame);

      // skleněná výplň (vložená)
      const gw = Math.max(wingW - frameT * 2, 0.04);
      const gh = Math.max(h - 0.006 - frameT * 2, 0.04);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(gw, gh, 0.01), glassMat);
      glass.position.set(fx, fy, zFront + 0.008);
      this._kitchen.add(glass);

      if (opening) {
        const hw = Math.min(0.22, wingW * 0.45);
        const handle = new THREE.Mesh(
          new THREE.BoxGeometry(hw, 0.01, 0.012),
          handleMat
        );
        handle.position.set(fx, y0 + 0.045, zFront + 0.02);
        this._kitchen.add(handle);
      } else {
        const handle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.005, 0.005, 0.12, 12),
          handleMat
        );
        let hx;
        if (wings === 1) {
          hx = hand === "R" ? fx - wingW * 0.38 : fx + wingW * 0.38;
        } else {
          hx = i === 0 ? fx + wingW * 0.38 : fx - wingW * 0.38;
        }
        handle.position.set(hx, fy, zFront + 0.02);
        this._kitchen.add(handle);
      }
    }
  }

  _drawers(u, product, mesh, x0, w, plinth, frontMat, handleMat) {
    const fronts =
      u.drawers?.front_heights_mm ||
      product.drawer_fronts_mm ||
      mesh.drawer_fronts_mm ||
      [142, 142, 142, 286];
    const corpusH = (u.height_mm || u.corpus_height_mm || product.height_mm || 730) * MM;
    // vždy vejít do korpusu — nikdy přes desku
    const rawSum = fronts.reduce((a, b) => a + b, 0) || 1;
    const scale = rawSum * MM > corpusH ? corpusH / (rawSum * MM) : 1;
    let y = plinth;
    const gap = 0.0025;
    fronts.forEach((fh) => {
      const hh = Math.max(fh * MM * scale - gap, 0.04);
      if (y + hh > plinth + corpusH + 0.001) return;
      const front = new THREE.Mesh(
        new THREE.BoxGeometry(w - 0.008, hh, 0.018),
        frontMat
      );
      front.position.set(x0 + w / 2, y + hh / 2 + gap / 2, 0.01);
      front.castShadow = true;
      this._kitchen.add(front);
      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(Math.min(0.14, w * 0.4), 0.008, 0.01),
        handleMat
      );
      handle.position.set(x0 + w / 2, y + hh - 0.022, 0.024);
      this._kitchen.add(handle);
      y += fh * MM * scale;
    });
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener("resize", this._onResize);
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
