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

function cabinetPreviewSvg(p, forceWidth) {
  const bw = 110;
  const isDrawer = (p.family || "").includes("drawer");
  const isWall = p.zone === "wall";
  const isTall = p.zone === "tall";
  const isCorner = (p.family || "").includes("corner");
  const isOven = (p.family || "").includes("oven");
  const isWaste = (p.family || "").includes("waste");
  const isLift = p.family === "wall_lift" || p.opening === "lift";
  const isGlass = !!p.glass;
  const h = isWall ? 64 : isTall ? 96 : 82;
  const doors = Number(p.doors || p.mesh?.doors || 1);
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
  } else if (isOven) {
    fronts += `<rect x="6" y="6" width="${bw - 12}" height="${h * 0.42}" rx="2" fill="#3a3836" stroke="#6a6460"/>`;
    fronts += `<rect x="6" y="${6 + h * 0.42 + 3}" width="${bw - 12}" height="${h * 0.42}" rx="2" fill="#e0b98a" stroke="#8a6844"/>`;
    fronts += `<rect x="${bw / 2 - 12}" y="${10}" width="24" height="3" rx="1" fill="#888"/>`;
  } else if (isWaste) {
    fronts += `<rect x="6" y="6" width="${bw - 12}" height="${h - 10}" rx="2" fill="#e0b98a" stroke="#8a6844"/>`;
    fronts += `<circle cx="${bw / 2}" cy="${h / 2}" r="8" fill="none" stroke="#4a4038" stroke-width="1.5"/>`;
  } else if (isCorner) {
    fronts += `<path d="M6 6 H${bw * 0.55} V${h - 4} H6 Z" fill="#e0b98a" stroke="#8a6844"/>`;
    fronts += `<path d="M${bw * 0.55} 6 H${bw - 6} V${h * 0.55} H${bw * 0.55} Z" fill="#d4a574" stroke="#8a6844"/>`;
  } else if (isLift) {
    const fill = isGlass ? "#9eb8c8" : "#e0b98a";
    fronts += `<rect x="6" y="6" width="${bw - 12}" height="${h - 10}" rx="2" fill="${fill}" stroke="#8a6844" stroke-width="0.8"/>`;
    if (isGlass) {
      fronts += `<rect x="12" y="12" width="${bw - 24}" height="${h - 28}" rx="1" fill="#c5d8e4" opacity="0.85"/>`;
    }
    fronts += `<rect x="${bw / 2 - 14}" y="${h - 14}" width="28" height="3" rx="1" fill="#4a4038"/>`;
    fronts += `<path d="M${bw / 2 - 8} 18 L${bw / 2} 12 L${bw / 2 + 8} 18" fill="none" stroke="#4a4038" stroke-width="1.2"/>`;
  } else {
    const gap = 2;
    const wingW = (bw - 12 - (doors - 1) * gap) / Math.max(doors, 1);
    for (let i = 0; i < Math.max(doors, 1); i++) {
      const x = 6 + i * (wingW + gap);
      const fill = isGlass ? "#9eb8c8" : isWall ? "#d8b896" : "#e0b98a";
      fronts += `<rect x="${x}" y="6" width="${wingW}" height="${h - 10}" rx="2"
        fill="${fill}" stroke="#8a6844" stroke-width="0.8"/>`;
      if (isGlass) {
        fronts += `<rect x="${x + 5}" y="11" width="${wingW - 10}" height="${h - 20}" rx="1" fill="#c5d8e4" opacity="0.85"/>`;
      }
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

const FAMILY_LABELS = {
  base_door: "Dvířková",
  base_drawers: "Šuplíková",
  base_oven: "Trouba",
  base_waste: "Koš",
  base_corner: "Rohová",
  wall_door: "Horní dvířková",
  wall_lift: "Horní výklop",
  wall_corner: "Horní rohová",
  tall_pantry: "Sloup / potravinová",
};

const ZONE_LABELS = { base: "spodní", wall: "horní", tall: "vysoká" };

const FAMILY_ORDER = [
  "base_door",
  "base_drawers",
  "base_oven",
  "base_waste",
  "base_corner",
  "wall_door",
  "wall_lift",
  "wall_corner",
  "tall_pantry",
];

const GLASSABLE = new Set([
  "base_door",
  "base_corner",
  "wall_door",
  "wall_lift",
  "wall_corner",
  "tall_pantry",
]);

/** @type {Record<string, {family:string, zone:string, label:string, widths:number[], byWidth:Record<number, object>, sample:object, opening?:string, skuFamily?:string}>} */
let libraryTypes = {};

function familyLabel(family) {
  return FAMILY_LABELS[family] || String(family || "").replace(/_/g, " ");
}

function defaultGlassId() {
  return (
    materialsDoc?.defaults?.glassId ||
    materialsDoc?.glass?.[0]?.id ||
    "glass-clear"
  );
}

function glassOptionsHtml(selected) {
  const items = materialsDoc?.glass || [];
  if (!items.length) {
    return `<option value="glass-clear">Čiré</option>`;
  }
  return items
    .map(
      (g) =>
        `<option value="${g.id}" ${g.id === selected ? "selected" : ""}>${escapeXml(g.name)}</option>`
    )
    .join("");
}

function resolveSkuForWidth(family, width) {
  const t = libraryTypes[family];
  if (!t) return null;
  return t.byWidth[width] || null;
}

function addLineItemFromType(family, width, extras = {}) {
  const product = resolveSkuForWidth(family, Number(width));
  if (!product) {
    alert(`Šířka ${width} mm pro ${familyLabel(family)} není v katalogu.`);
    return;
  }
  const opening =
    extras.opening ||
    libraryTypes[family]?.opening ||
    (family === "wall_lift" ? "lift" : "hinge");
  const glass = !!extras.glass;
  lineItems.push({
    sku: product.sku,
    name: product.name || familyLabel(family),
    width_mm: product.width_mm,
    zone: product.zone || libraryTypes[family]?.zone,
    family,
    label: familyLabel(family),
    opening,
    glass,
    glassId: glass ? extras.glassId || defaultGlassId() : null,
  });
  renderLineStrip();
}

let lineItems = []; // {sku, name, width_mm, zone, family, label, opening, glass, glassId}

function renderLineStrip() {
  const host = document.getElementById("line-strip");
  const widthEl = document.getElementById("line-width");
  if (!lineItems.length) {
    host.innerHTML = '<span class="muted">Vyber druh skříně a šířku v katalogu…</span>';
    widthEl.textContent = "0 mm";
    return;
  }
  const total = lineItems.reduce((s, x) => s + (x.width_mm || 0), 0);
  widthEl.textContent = `${total} mm`;
  host.innerHTML = lineItems
    .map((it, i) => {
      const t = libraryTypes[it.family];
      const widths = t?.widths || [it.width_mm];
      const opts = widths
        .map((w) => `<option value="${w}" ${w === it.width_mm ? "selected" : ""}>${w}</option>`)
        .join("");
      const canGlass = GLASSABLE.has(it.family) && !(it.family || "").includes("drawer");
      const glassCtrl = canGlass
        ? `<label class="line-glass" title="Prosklená dvířka">
            <input type="checkbox" data-gidx="${i}" ${it.glass ? "checked" : ""} /> sklo
          </label>
          <select data-glassidx="${i}" title="Barva skla" ${it.glass ? "" : "disabled"}>
            ${glassOptionsHtml(it.glassId || defaultGlassId())}
          </select>`
        : "";
      return `<span class="line-chip">
        <span class="line-label">${escapeXml(it.label || familyLabel(it.family))}</span>
        <select data-widx="${i}" title="Šířka">${opts}</select>
        ${glassCtrl}
        <button type="button" data-rm="${i}" title="Odebrat">×</button>
      </span>`;
    })
    .join("");
  host.querySelectorAll("[data-rm]").forEach((btn) => {
    btn.addEventListener("click", () => {
      lineItems.splice(Number(btn.getAttribute("data-rm")), 1);
      renderLineStrip();
    });
  });
  host.querySelectorAll("select[data-widx]").forEach((sel) => {
    sel.addEventListener("change", () => {
      const idx = Number(sel.getAttribute("data-widx"));
      const w = Number(sel.value);
      const it = lineItems[idx];
      const product = resolveSkuForWidth(it.family, w);
      if (!product) return;
      lineItems[idx] = {
        ...it,
        sku: product.sku,
        name: product.name || it.name,
        width_mm: product.width_mm,
      };
      renderLineStrip();
    });
  });
  host.querySelectorAll("input[data-gidx]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const idx = Number(cb.getAttribute("data-gidx"));
      lineItems[idx].glass = cb.checked;
      if (cb.checked && !lineItems[idx].glassId) {
        lineItems[idx].glassId = defaultGlassId();
      }
      if (!cb.checked) lineItems[idx].glassId = null;
      renderLineStrip();
    });
  });
  host.querySelectorAll("select[data-glassidx]").forEach((sel) => {
    sel.addEventListener("change", () => {
      const idx = Number(sel.getAttribute("data-glassidx"));
      lineItems[idx].glassId = sel.value;
      lineItems[idx].glass = true;
    });
  });
}

async function loadLibraryGrid() {
  const zoneFilter = document.getElementById("lib-zone").value;
  const host = document.getElementById("lib-grid");
  try {
  const params = new URLSearchParams({ limit: "300", source: "kitchen_ai" });
  const data = await api("/api/v1/catalog/library?" + params);

  const groups = {};
  for (const p of data.items || []) {
    const fam = p.family || "other";
    if (!groups[fam]) {
      groups[fam] = {
        family: fam,
        zone: p.zone || "",
        label: familyLabel(fam),
        widths: [],
        byWidth: {},
        sample: p,
        opening: fam === "wall_lift" ? "lift" : "hinge",
      };
    }
    const w = Number(p.width_mm);
    if (!groups[fam].byWidth[w]) {
      groups[fam].byWidth[w] = p;
      groups[fam].widths.push(w);
    }
    if (w === 600) groups[fam].sample = p;
  }
  for (const g of Object.values(groups)) {
    g.widths.sort((a, b) => a - b);
  }

  // virtuální typ: horní výklop = stejné SKU jako wall_door
  if (groups.wall_door) {
    const src = groups.wall_door;
    groups.wall_lift = {
      family: "wall_lift",
      zone: "wall",
      label: familyLabel("wall_lift"),
      widths: [...src.widths],
      byWidth: { ...src.byWidth },
      sample: { ...src.sample, family: "wall_lift", opening: "lift" },
      opening: "lift",
      skuFamily: "wall_door",
    };
  }

  libraryTypes = groups;

  const ordered = FAMILY_ORDER.filter((f) => groups[f])
    .concat(Object.keys(groups).filter((f) => !FAMILY_ORDER.includes(f)))
    .filter((f) => !zoneFilter || groups[f].zone === zoneFilter);

  if (!ordered.length) {
    host.innerHTML = '<p class="muted">V této zóně nejsou skříňky.</p>';
    return;
  }

  host.innerHTML = ordered
    .map((fam) => {
      const g = groups[fam];
      const defaultW = g.byWidth[600] ? 600 : g.widths[Math.floor(g.widths.length / 2)] || g.widths[0];
      const opts = g.widths
        .map((w) => `<option value="${w}" ${w === defaultW ? "selected" : ""}>${w} mm</option>`)
        .join("");
      const canGlass = GLASSABLE.has(fam);
      const preview = {
        ...g.sample,
        family: fam,
        opening: g.opening,
        doors: fam.includes("drawer") ? 0 : 1,
        width_mm: 600,
      };
      const glassBlock = canGlass
        ? `<label class="lib-glass">
            <input type="checkbox" class="lib-glass-cb" /> Prosklené
          </label>
          <select class="lib-glass-sel" disabled title="Barva skla">${glassOptionsHtml(defaultGlassId())}</select>`
        : "";
      return `<div class="lib-card" data-family="${fam}">
        ${cabinetPreviewSvg(preview, 600)}
        <strong class="lib-title">${escapeXml(g.label)}</strong>
        <span class="lib-zone">${escapeXml(ZONE_LABELS[g.zone] || g.zone)}</span>
        <div class="lib-width">
          <label>Šířka
            <select class="lib-w-select">${opts}</select>
          </label>
        </div>
        ${glassBlock}
        <button type="button" class="btn tiny primary lib-add">Přidat do linky</button>
      </div>`;
    })
    .join("");

  host.querySelectorAll(".lib-card").forEach((card) => {
    const fam = card.getAttribute("data-family");
    const glassCb = card.querySelector(".lib-glass-cb");
    const glassSel = card.querySelector(".lib-glass-sel");
    if (glassCb && glassSel) {
      glassCb.addEventListener("change", () => {
        glassSel.disabled = !glassCb.checked;
        const prev = {
          family: fam,
          zone: libraryTypes[fam]?.zone,
          opening: libraryTypes[fam]?.opening,
          glass: glassCb.checked,
          doors: 1,
        };
        const svgHost = card.querySelector("svg");
        if (svgHost) {
          const wrap = document.createElement("div");
          wrap.innerHTML = cabinetPreviewSvg(prev, 600);
          svgHost.replaceWith(wrap.firstChild);
        }
      });
    }
    card.querySelector(".lib-add").addEventListener("click", () => {
      const w = Number(card.querySelector(".lib-w-select").value);
      const glass = !!card.querySelector(".lib-glass-cb")?.checked;
      const glassId = card.querySelector(".lib-glass-sel")?.value || defaultGlassId();
      addLineItemFromType(fam, w, {
        glass,
        glassId: glass ? glassId : null,
        opening: libraryTypes[fam]?.opening || (fam === "wall_lift" ? "lift" : "hinge"),
      });
    });
  });
  } catch (err) {
    console.error(err);
    host.innerHTML = `<p class="msg err">Katalog se nepodařilo načíst: ${escapeXml(err.message || err)}</p>`;
  }
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
      family: u.family === "wall_door" && u.options?.opening === "lift" ? "wall_lift" : u.family,
      label:
        u.options?.opening === "lift" && (u.band === "wall" || u.family === "wall_door")
          ? familyLabel("wall_lift")
          : familyLabel(u.family),
      opening: u.options?.opening || u.mesh?.opening || "hinge",
      glass: !!(u.options?.glass || u.mesh?.front === "glass"),
      glassId: u.options?.glassId || u.mesh?.glassId || null,
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
      units: lineItems.map((x) => ({
        sku: x.sku,
        glass: !!x.glass,
        glassId: x.glass ? x.glassId || defaultGlassId() : null,
        opening: x.opening || (x.family === "wall_lift" ? "lift" : "hinge"),
      })),
      plinth_height: Number(document.getElementById("design-plinth").value || 100),
      countertop_thickness: Number(document.getElementById("design-top").value || 40),
      corpusId: mats.corpusId,
      frontId: mats.frontId,
      countertopId: mats.countertopId,
      glassId: defaultGlassId(),
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
  const pick = (family, width, extras = {}) => {
    const p = resolveSkuForWidth(family, width);
    const opening = extras.opening || (family === "wall_lift" ? "lift" : "hinge");
    return {
      sku: p?.sku || `KA-?-${width}`,
      name: p?.name || familyLabel(family),
      width_mm: width,
      zone: libraryTypes[family]?.zone || "base",
      family,
      label: familyLabel(family),
      opening,
      glass: !!extras.glass,
      glassId: extras.glass ? extras.glassId || defaultGlassId() : null,
    };
  };
  lineItems = [
    pick("base_door", 600),
    pick("base_drawers", 600),
    pick("base_door", 600, { glass: true }),
    pick("base_door", 600),
    pick("base_door", 500),
    pick("base_door", 600),
    pick("wall_lift", 600),
    pick("wall_door", 600, { glass: true }),
    pick("wall_door", 600),
  ];
  renderLineStrip();
});

document.getElementById("lib-refresh").addEventListener("click", () => {
  loadLibraryGrid().catch((e) => alert(e.message));
});
document.getElementById("lib-zone").addEventListener("change", () => {
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
  loadMaterials().then(() => loadLibraryGrid()),
]).catch(console.error);
renderLineStrip();
