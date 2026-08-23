import { KitchenViewer } from "./scene3d.js";

async function api(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("cs-CZ");
  } catch {
    return iso;
  }
}

async function refreshHealth() {
  const pill = document.getElementById("health-pill");
  try {
    const h = await api("/health");
    pill.textContent = "online · " + h.service;
    pill.classList.add("ok");
  } catch {
    pill.textContent = "offline";
    pill.classList.remove("ok");
  }
}

function dims(p) {
  const parts = [p.width_mm, p.height_mm, p.depth_mm].filter((v) => v != null);
  return parts.length ? parts.join("×") : "—";
}

async function loadCatalog() {
  const zone = document.getElementById("cat-zone").value;
  const source = document.getElementById("cat-source").value;
  const q = document.getElementById("cat-q").value.trim();
  const params = new URLSearchParams({ limit: "80" });
  if (zone) params.set("zone", zone);
  if (source) params.set("source", source);
  if (q) params.set("q", q);
  const data = await api("/api/v1/catalog/products?" + params);
  const tbody = document.getElementById("cat-tbody");
  document.getElementById("cat-meta").textContent =
    `Zobrazeno ${data.items.length} z ${data.total}`;
  if (!data.items.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="muted">Nic nenalezeno.</td></tr>';
    return;
  }
  tbody.innerHTML = data.items
    .map(
      (p) => `<tr>
        <td><code>${p.sku || p.id}</code></td>
        <td>${p.name || "—"}</td>
        <td>${p.family || "—"}</td>
        <td>${dims(p)}</td>
        <td class="muted">${p.source || "—"}</td>
      </tr>`
    )
    .join("");
}

async function loadCatalogIndex() {
  const idx = await api("/api/v1/catalog/products/index");
  document.getElementById("stat-products").textContent = String(
    idx.stats?.total_products ?? "—"
  );
  const host = document.getElementById("cat-families");
  host.innerHTML = (idx.families || [])
    .map(
      (f) =>
        `<button type="button" class="chip" data-family="${f.id}">${f.id} (${f.count})</button>`
    )
    .join("");
  host.querySelectorAll("[data-family]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const family = btn.getAttribute("data-family");
      const zone = document.getElementById("cat-zone").value;
      const source = document.getElementById("cat-source").value;
      const params = new URLSearchParams({ limit: "80", family });
      if (zone) params.set("zone", zone);
      if (source) params.set("source", source);
      const data = await api("/api/v1/catalog/products?" + params);
      document.getElementById("cat-meta").textContent =
        `${family}: ${data.items.length} z ${data.total}`;
      const tbody = document.getElementById("cat-tbody");
      tbody.innerHTML = data.items
        .map(
          (p) => `<tr>
            <td><code>${p.sku || p.id}</code></td>
            <td>${p.name || "—"}</td>
            <td>${p.family || "—"}</td>
            <td>${dims(p)}</td>
            <td class="muted">${p.source || "—"}</td>
          </tr>`
        )
        .join("");
    });
  });
}

document.getElementById("cat-btn").addEventListener("click", () => {
  loadCatalog().catch((e) => alert(e.message));
});
document.getElementById("cat-q").addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") loadCatalog().catch(console.error);
});

async function loadStyles() {
  const data = await api("/api/v1/styles");
  const host = document.getElementById("style-chips");
  host.innerHTML = (data.items || [])
    .map((s) => `<button type="button" class="chip" data-style="${s.id}">${s.name}</button>`)
    .join("");
  host.querySelectorAll("[data-style]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const s = await api("/api/v1/styles/" + btn.getAttribute("data-style"));
      const inspired = (s.inspired_by || []).join(", ");
      document.getElementById("style-detail").textContent =
        `${s.name} — ${s.mood || ""} · inspirace: ${inspired}`;
    });
  });
}

async function loadExamples() {
  const data = await api("/api/v1/references/examples");
  const tbody = document.getElementById("examples-tbody");
  if (!data.items?.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="muted">Žádné sestavy.</td></tr>';
    return;
  }
  tbody.innerHTML = data.items
    .map(
      (e) => `<tr data-ex="${e.id}" style="cursor:pointer">
        <td><strong>${e.name}</strong></td>
        <td>${(e.palette || []).join(" · ")}</td>
        <td>${e.module_count ?? "—"}</td>
        <td class="muted">${(e.module_widths_mm || []).slice(0, 8).join(", ")}${(e.module_widths_mm || []).length > 8 ? "…" : ""}</td>
      </tr>`
    )
    .join("");
  tbody.querySelectorAll("[data-ex]").forEach((row) => {
    row.addEventListener("click", async () => {
      const ex = await api("/api/v1/references/examples/" + row.getAttribute("data-ex"));
      const sample = (ex.modules || [])
        .slice(0, 6)
        .map((m) => `${m.label}${m.width_mm ? ` (${m.width_mm} mm)` : ""}`)
        .join(" · ");
      document.getElementById("example-detail").textContent =
        `${ex.name}: ${sample}${(ex.modules || []).length > 6 ? "…" : ""} — mapovat na korpus 730 mm.`;
    });
  });
}

async function refreshSurveys() {
  const tbody = document.getElementById("survey-tbody");
  const data = await api("/api/v1/surveys");
  document.getElementById("stat-surveys").textContent = String(data.count ?? 0);
  if (!tbody) return;
  if (!data.items?.length) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="muted">Zatím žádný survey — nahraj JSON.</td></tr>';
    return;
  }
  tbody.innerHTML = data.items
    .map(
      (s) => `<tr>
        <td>${s.project?.customerName || "—"}</td>
        <td><code>${s.surveyId}</code></td>
        <td>${fmtDate(s.importedAt)}</td>
        <td></td>
      </tr>`
    )
    .join("");
}

async function refreshLayouts() {
  const data = await api("/api/v1/layouts");
  document.getElementById("stat-layouts").textContent = String(data.count ?? 0);
  const tbody = document.getElementById("layouts-tbody");
  if (!data.items?.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="muted">Zatím žádný layout.</td></tr>';
    return;
  }
  tbody.innerHTML = data.items
    .map(
      (l) => `<tr>
        <td>${l.customerName || "—"}</td>
        <td><code>${l.layoutId.slice(0, 8)}…</code></td>
        <td>${l.unit_count ?? "—"}</td>
        <td>${l.ok ? "✓" : "✗"}</td>
        <td><button type="button" class="btn tiny ghost" data-layout="${l.layoutId}">Otevřít</button></td>
      </tr>`
    )
    .join("");
  tbody.querySelectorAll("[data-layout]").forEach((btn) => {
    btn.addEventListener("click", () => {
      loadLayout(btn.getAttribute("data-layout")).catch((e) => alert(e.message));
    });
  });
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let viewer = null;
let rotating = false;
let materialsDoc = null;

function ensureViewer() {
  if (viewer) return viewer;
  const host = document.getElementById("view3d");
  viewer = new KitchenViewer(host);
  if (materialsDoc) viewer.setMaterialsCatalog(materialsDoc);
  return viewer;
}

function showViewer(hasScene) {
  document.getElementById("view3d-empty").classList.toggle("hidden", !!hasScene);
}

function fillMaterialSelects(doc) {
  materialsDoc = doc;
  const map = [
    ["mat-corpus", doc.corpus, doc.defaults?.corpusId],
    ["mat-front", doc.front, doc.defaults?.frontId],
    ["mat-top", doc.countertop, doc.defaults?.countertopId],
  ];
  for (const [id, items, def] of map) {
    const sel = document.getElementById(id);
    if (!sel || !items) continue;
    sel.innerHTML = items
      .map((m) => {
        const kind = m.kind === "wood" ? " · vzor" : "";
        return `<option value="${m.id}">${m.name}${kind}</option>`;
      })
      .join("");
    if (def && [...sel.options].some((o) => o.value === def)) sel.value = def;
  }
  if (viewer) viewer.setMaterialsCatalog(doc);
}

async function loadMaterials() {
  const doc = await api("/api/v1/catalog/materials");
  fillMaterialSelects(doc);
}

function currentMaterials() {
  return {
    corpusId: document.getElementById("mat-corpus")?.value,
    frontId: document.getElementById("mat-front")?.value,
    countertopId: document.getElementById("mat-top")?.value,
  };
}

function cabinetPreviewSvg(p) {
  const w = Math.min(Number(p.width_mm) || 600, 900);
  const scale = 110 / w;
  const bw = Math.max(w * scale, 72);
  const isDrawer = (p.family || "").includes("drawer");
  const isWall = p.zone === "wall";
  const isTall = p.zone === "tall";
  const h = isWall ? 64 : isTall ? 96 : 82;
  const doors = Number(p.doors || p.mesh?.doors || (w <= 600 ? 1 : 2));
  let fronts = "";
  if (isDrawer) {
    const stack = p.drawer_fronts_mm || p.mesh?.drawer_fronts_mm || [142, 142, 142, 286];
    const total = stack.reduce((a, b) => a + b, 0) || 1;
    let y = 6;
    stack.forEach((fh) => {
      const hh = (fh / total) * (h - 10);
      fronts += `<rect x="6" y="${y}" width="${bw - 12}" height="${Math.max(hh - 1.2, 4)}" rx="1.5"
        fill="#c9956a" stroke="#7a5a38" stroke-width="0.8"/>`;
      fronts += `<rect x="${bw / 2 - 10}" y="${y + 2}" width="20" height="2.2" rx="1" fill="#4a4038"/>`;
      y += hh;
    });
  } else {
    const gap = 2;
    const wingW = (bw - 12 - (doors - 1) * gap) / doors;
    for (let i = 0; i < doors; i++) {
      const x = 6 + i * (wingW + gap);
      fronts += `<rect x="${x}" y="6" width="${wingW}" height="${h - 10}" rx="2"
        fill="${isWall ? "#d8b896" : "#e0b98a"}" stroke="#8a6844" stroke-width="0.8"/>`;
      const hx = i === 0 && doors > 1 ? x + wingW - 5 : x + 5;
      fronts += `<rect x="${hx}" y="${h / 2 - 8}" width="2.2" height="16" rx="1" fill="#4a4038"/>`;
    }
  }
  const plinth = isWall ? "" : `<rect x="4" y="${h - 2}" width="${bw - 8}" height="4" fill="#3a3530"/>`;
  return `<svg viewBox="0 0 ${bw} ${h + (isWall ? 2 : 4)}" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="${bw - 2}" height="${h - (isWall ? 0 : 2)}" rx="3" fill="#1e1b18" stroke="#5a5048"/>
    ${fronts}${plinth}
  </svg>`;
}

let lineItems = []; // {sku, name, width_mm, zone, family}

function renderLineStrip() {
  const host = document.getElementById("line-strip");
  const widthEl = document.getElementById("line-width");
  if (!lineItems.length) {
    host.innerHTML = '<span class="muted">Klikni na skříňku v katalogu…</span>';
    widthEl.textContent = "0 mm";
    return;
  }
  const total = lineItems.reduce((s, x) => s + (x.width_mm || 0), 0);
  widthEl.textContent = `${total} mm`;
  host.innerHTML = lineItems
    .map(
      (it, i) => `<span class="line-chip">
        <code>${it.sku}</code> ${it.width_mm}
        <button type="button" data-rm="${i}" title="Odebrat">×</button>
      </span>`
    )
    .join("");
  host.querySelectorAll("[data-rm]").forEach((btn) => {
    btn.addEventListener("click", () => {
      lineItems.splice(Number(btn.getAttribute("data-rm")), 1);
      renderLineStrip();
    });
  });
}

async function loadLibraryGrid() {
  const zone = document.getElementById("lib-zone").value;
  const family = document.getElementById("lib-family").value;
  const params = new URLSearchParams({ limit: "60", source: "kitchen_ai" });
  if (zone) params.set("zone", zone);
  if (family) params.set("family", family);
  const data = await api("/api/v1/catalog/library?" + params);
  const host = document.getElementById("lib-grid");
  // prefer common widths for cleaner grid
  const items = (data.items || []).filter((p) => {
    const w = p.width_mm || 0;
    return w === 400 || w === 450 || w === 500 || w === 600 || w === 800 || w === 900;
  });
  const show = items.length ? items : data.items || [];
  host.innerHTML = show
    .slice(0, 48)
    .map(
      (p) => `<button type="button" class="lib-card" data-sku="${p.sku}"
        data-name="${escapeXml(p.name || p.sku)}" data-w="${p.width_mm}"
        data-zone="${p.zone || ""}" data-family="${p.family || ""}">
        ${cabinetPreviewSvg(p)}
        <strong>${p.width_mm} mm</strong>
        <code>${escapeXml(p.sku)}</code>
        <span>${escapeXml((p.family || "").replace(/_/g, " "))}</span>
      </button>`
    )
    .join("");
  host.querySelectorAll(".lib-card").forEach((card) => {
    card.addEventListener("click", () => {
      lineItems.push({
        sku: card.getAttribute("data-sku"),
        name: card.getAttribute("data-name"),
        width_mm: Number(card.getAttribute("data-w")),
        zone: card.getAttribute("data-zone"),
        family: card.getAttribute("data-family"),
      });
      renderLineStrip();
    });
  });
}

function renderLayout(layout) {
  const v = layout.validation || {};
  const st = layout.stats || {};
  if (layout.materials) {
    const c = document.getElementById("mat-corpus");
    const f = document.getElementById("mat-front");
    const t = document.getElementById("mat-top");
    if (c && layout.materials.corpusId) c.value = layout.materials.corpusId;
    if (f && layout.materials.frontId) f.value = layout.materials.frontId;
    if (t && layout.materials.countertopId) t.value = layout.materials.countertopId;
  }

  document.getElementById("design-summary").innerHTML =
    `<strong>${escapeXml(layout.project?.customerName || "3D návrh")}</strong> · ` +
    `z katalogu · ${st.base_count || 0} spodní · ${st.wall_count || 0} horní · ` +
    `validace ${v.ok ? "<span style='color:var(--ok)'>OK</span>" : "<span style='color:#e07a6a'>blokováno</span>"} · ` +
    `<code>${layout.layoutId.slice(0, 8)}…</code>`;

  try {
    const vwr = ensureViewer();
    if (materialsDoc) vwr.setMaterialsCatalog(materialsDoc);
    layout.materials = { ...layout.materials, ...currentMaterials() };
    vwr.build(layout);
    showViewer(true);
    requestAnimationFrame(() => viewer?.resize());
  } catch (err) {
    console.error(err);
    showViewer(false);
    document.getElementById("design-msg").hidden = false;
    document.getElementById("design-msg").className = "msg err";
    document.getElementById("design-msg").textContent =
      "3D scéna selhala: " + (err.message || err);
  }

  const bom = layout.bom || [];
  document.getElementById("bom-tbody").innerHTML = bom.length
    ? bom
        .map(
          (b) => `<tr>
            <td><code>${b.sku}</code></td>
            <td>${escapeXml(b.name || b.family || b.band)}</td>
            <td>${b.width_mm}</td>
            <td>${b.qty}</td>
          </tr>`
        )
        .join("")
    : '<tr><td colspan="4" class="muted">—</td></tr>';

  const issues = v.issues || [];
  const list = document.getElementById("issues-list");
  if (!issues.length) {
    list.innerHTML = '<li class="sev-INFO">Žádné nálezy.</li>';
  } else {
    list.innerHTML = issues
      .map(
        (i) =>
          `<li class="sev-${i.severity}"><strong>${i.severity}</strong> · ${escapeXml(i.message)}</li>`
      )
      .join("");
  }
}

async function loadLayout(layoutId) {
  const layout = await api("/api/v1/layouts/" + layoutId);
  if (layout.units?.length) {
    lineItems = layout.units.map((u) => ({
      sku: u.sku,
      name: u.name,
      width_mm: u.width_mm,
      zone: u.band,
      family: u.family,
    }));
    renderLineStrip();
  }
  renderLayout(layout);
  document.getElementById("design").scrollIntoView({ behavior: "smooth" });
}

async function generateDesign() {
  const msg = document.getElementById("design-msg");
  if (!lineItems.length) {
    msg.hidden = false;
    msg.className = "msg err";
    msg.textContent = "Nejdřív přidej skříňky z vizuálního katalogu.";
    return;
  }
  msg.hidden = false;
  msg.className = "msg";
  msg.textContent = "Sestavuji 3D z katalogu…";
  const mats = currentMaterials();
  const layout = await api("/api/v1/layouts/from-catalog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      skus: lineItems.map((x) => x.sku),
      plinth_height: Number(document.getElementById("design-plinth").value || 100),
      countertop_thickness: Number(document.getElementById("design-top").value || 40),
      corpusId: mats.corpusId,
      frontId: mats.frontId,
      countertopId: mats.countertopId,
      customerName: "Návrh z katalogu",
    }),
  });
  msg.className = "msg ok";
  msg.textContent = `Layout ${layout.layoutId.slice(0, 8)}… · ${layout.stats.unit_count} SKU · ${layout.stats.total_width_base_mm} mm`;
  renderLayout(layout);
  await refreshLayouts();
}

document.getElementById("design-run").addEventListener("click", () => {
  generateDesign().catch((e) => {
    const msg = document.getElementById("design-msg");
    msg.hidden = false;
    msg.className = "msg err";
    msg.textContent = e.message;
  });
});

document.getElementById("line-clear").addEventListener("click", () => {
  lineItems = [];
  renderLineStrip();
});

document.getElementById("line-preset").addEventListener("click", () => {
  // předvolba ~3,5 m: dvířka + šuplíky + dvířka (bez horních)
  lineItems = [
    { sku: "KA-BD-600", name: "Dvířková 600", width_mm: 600, zone: "base", family: "base_door" },
    { sku: "KA-BZ-600", name: "Šuplíková 600", width_mm: 600, zone: "base", family: "base_drawers" },
    { sku: "KA-BD-600", name: "Dvířková 600", width_mm: 600, zone: "base", family: "base_door" },
    { sku: "KA-BD-600", name: "Dvířková 600", width_mm: 600, zone: "base", family: "base_door" },
    { sku: "KA-BD-500", name: "Dvířková 500", width_mm: 500, zone: "base", family: "base_door" },
    { sku: "KA-BD-600", name: "Dvířková 600", width_mm: 600, zone: "base", family: "base_door" },
  ];
  renderLineStrip();
});

document.getElementById("lib-refresh").addEventListener("click", () => {
  loadLibraryGrid().catch((e) => alert(e.message));
});
document.getElementById("lib-zone").addEventListener("change", () => {
  loadLibraryGrid().catch(console.error);
});
document.getElementById("lib-family").addEventListener("change", () => {
  loadLibraryGrid().catch(console.error);
});

async function applyMaterialsLive() {
  if (!viewer?.layout) return;
  const mats = currentMaterials();
  viewer.setMaterials(mats);
  const id = viewer.layout.layoutId;
  if (!id) return;
  try {
    await api("/api/v1/layouts/" + id + "/materials", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mats),
    });
  } catch {
    /* ok */
  }
}

["mat-corpus", "mat-front", "mat-top"].forEach((id) => {
  document.getElementById(id)?.addEventListener("change", () => {
    applyMaterialsLive().catch(console.error);
  });
});

document.getElementById("cam-reset").addEventListener("click", () => {
  ensureViewer().resetCamera();
});
document.getElementById("cam-rotate").addEventListener("click", () => {
  rotating = !rotating;
  ensureViewer().setAutoRotate(rotating);
  document.getElementById("cam-rotate").textContent = rotating
    ? "Stop otáčení"
    : "Auto-otáčení";
});
document.getElementById("cam-shot").addEventListener("click", () => {
  if (!viewer?.layout) return;
  viewer.screenshot();
});


async function refreshModules() {
  const data = await api("/api/v1/modules");
  const host = document.getElementById("module-chips");
  const parts = [];
  for (const m of data.deferred || []) parts.push(`<span class="chip deferred">${m}</span>`);
  for (const m of data.active || []) parts.push(`<span class="chip active">${m}</span>`);
  for (const m of data.planned || []) parts.push(`<span class="chip planned">${m}</span>`);
  host.innerHTML = parts.join("");
  document.getElementById("stat-active").textContent = String((data.active || []).length);
}

async function calcWorktop() {
  const plinth = Number(document.getElementById("plinth").value || 100);
  const top = Number(document.getElementById("top").value || 40);
  const data = await api("/api/v1/catalog/cabinets/worktop-height", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plinth_height: plinth, countertop_thickness: top }),
  });
  document.getElementById("calc-result").innerHTML =
    `${data.corpus_height} + ${data.plinth_height} + ${data.countertop_thickness} = <strong>${data.worktop_height_mm} mm</strong>`;
}

document.getElementById("calc-btn").addEventListener("click", () => {
  calcWorktop().catch((e) => alert(e.message));
});

async function frontPlan() {
  const width = Number(document.getElementById("cab-width").value || 600);
  const data = await api("/api/v1/catalog/cabinets/front-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ width_mm: width }),
  });
  const d = data.doors;
  const dr = data.drawers;
  let text = `Šířka ${data.snapped_width_mm} mm → <strong>${d.label}</strong>`;
  if (d.wings === 2 && d.wing_widths_mm) {
    text += ` (${d.wing_widths_mm.join(" + ")} mm)`;
  }
  text += ` · šuplíky ${dr.composition} (= ${dr.sum_mm} mm)`;
  if (data.warnings?.length) {
    text += `<br><span class="muted">${data.warnings.join(" · ")}</span>`;
  }
  document.getElementById("front-result").innerHTML = text;
}

async function loadWidthChips() {
  const rules = await api("/api/v1/catalog/cabinets/rules");
  const host = document.getElementById("width-chips");
  const mods = (rules.modules_mm || []).filter((w) => w % 100 === 0 || w === 450 || w === 350);
  host.innerHTML = mods
    .map((w) => `<button type="button" class="chip" data-w="${w}">${w}</button>`)
    .join("");
  host.querySelectorAll("[data-w]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("cab-width").value = btn.getAttribute("data-w");
      frontPlan().catch(console.error);
    });
  });
}

document.getElementById("front-btn").addEventListener("click", () => {
  frontPlan().catch((e) => alert(e.message));
});

document.getElementById("import-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const msg = document.getElementById("import-msg");
  const file = document.getElementById("survey-file").files?.[0];
  if (!file) return;
  const fd = new FormData();
  fd.append("file", file);
  msg.hidden = false;
  try {
    const data = await api("/api/v1/surveys/import", { method: "POST", body: fd });
    msg.className = "msg ok";
    msg.textContent = `Uloženo: ${data.surveyId}` + (data.projectHint ? ` (${data.projectHint})` : "");
    await refreshSurveys();
  } catch (e) {
    msg.className = "msg err";
    msg.textContent = e.message;
  }
});

Promise.all([
  refreshHealth(),
  refreshSurveys(),
  refreshLayouts(),
  refreshModules(),
  calcWorktop(),
  frontPlan(),
  loadWidthChips(),
  loadCatalogIndex(),
  loadCatalog(),
  loadStyles(),
  loadExamples(),
  loadMaterials(),
  loadLibraryGrid(),
]).catch(console.error);
renderLineStrip();
