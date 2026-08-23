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
  const select = document.getElementById("design-survey");
  const data = await api("/api/v1/surveys");
  document.getElementById("stat-surveys").textContent = String(data.count ?? 0);
  const prev = select.value;
  select.innerHTML = '<option value="">— vyber nebo nahraj —</option>';
  if (!data.items?.length) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="muted">Zatím žádný survey — nahraj JSON nebo použij ukázku v Návrhu.</td></tr>';
    return;
  }
  tbody.innerHTML = data.items
    .map(
      (s) => `<tr>
        <td>${s.project?.customerName || "—"}</td>
        <td><code>${s.surveyId}</code></td>
        <td>${fmtDate(s.importedAt)}</td>
        <td><button type="button" class="btn tiny ghost" data-use="${s.surveyId}">Navrhnout</button></td>
      </tr>`
    )
    .join("");
  for (const s of data.items) {
    const opt = document.createElement("option");
    opt.value = s.surveyId;
    opt.textContent = `${s.project?.customerName || "Survey"} · ${s.surveyId.slice(0, 8)}…`;
    select.appendChild(opt);
  }
  if (prev && [...select.options].some((o) => o.value === prev)) {
    select.value = prev;
  }
  tbody.querySelectorAll("[data-use]").forEach((btn) => {
    btn.addEventListener("click", () => {
      select.value = btn.getAttribute("data-use");
      document.getElementById("design").scrollIntoView({ behavior: "smooth" });
    });
  });
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

function renderLayoutSvg(layout) {
  const svg = document.getElementById("layout-svg");
  const base = (layout.units || []).filter((u) => u.band === "base");
  const wall = (layout.units || []).filter((u) => u.band === "wall");
  const zones = layout.zones || [];
  const baseZones = zones.filter((z) => z.band === "base" || (!z.auto && z.band !== "wall"));
  const z0 = baseZones[0] || zones[0] || {};
  let total =
    (z0.filler_left_mm || 0) +
    (z0.packable_mm || base.reduce((s, u) => s + u.width_mm, 0)) +
    (z0.filler_right_mm || 0);
  if (!total) total = base.reduce((s, u) => s + u.width_mm, 0) || 3600;
  const pad = 40;
  const W = 1000;
  const scale = (W - pad * 2) / Math.max(total, 1);
  const yBase = 200;
  const hBase = 90;
  const yWall = 70;
  const hWall = 70;

  const parts = [];
  parts.push(
    `<text x="${pad}" y="28" fill="#a89a8c" font-size="13">${escapeXml(
      layout.project?.customerName || "Layout"
    )} · ${layout.stats?.unit_count || 0} modulů</text>`
  );

  const fl = z0.filler_left_mm || 0;
  const fr = z0.filler_right_mm || 0;
  if (fl > 0) {
    parts.push(
      `<rect x="${pad}" y="${yBase}" width="${fl * scale}" height="${hBase}" fill="rgba(212,162,76,0.25)" stroke="#d4a24c"/>
       <text x="${pad + (fl * scale) / 2}" y="${yBase + 50}" text-anchor="middle" fill="#e8c98a" font-size="11">F</text>`
    );
  }
  if (fr > 0) {
    const x = pad + (total - fr) * scale;
    parts.push(
      `<rect x="${x}" y="${yBase}" width="${fr * scale}" height="${hBase}" fill="rgba(212,162,76,0.25)" stroke="#d4a24c"/>
       <text x="${x + (fr * scale) / 2}" y="${yBase + 50}" text-anchor="middle" fill="#e8c98a" font-size="11">F</text>`
    );
  }

  for (const u of base) {
    const x = pad + (u.offset_mm || 0) * scale;
    const w = u.width_mm * scale;
    const fill = u.kind === "drawers" ? "rgba(212,120,58,0.55)" : "rgba(232,195,154,0.35)";
    parts.push(
      `<rect x="${x}" y="${yBase}" width="${w}" height="${hBase}" rx="4" fill="${fill}" stroke="#e8c39a"/>
       <text x="${x + w / 2}" y="${yBase + 38}" text-anchor="middle" fill="#f3ebe2" font-size="12" font-weight="600">${u.width_mm}</text>
       <text x="${x + w / 2}" y="${yBase + 58}" text-anchor="middle" fill="#a89a8c" font-size="10">${u.kind === "drawers" ? "šup." : "dveř."}</text>`
    );
  }
  for (const u of wall) {
    const x = pad + (u.offset_mm || 0) * scale;
    const w = u.width_mm * scale;
    parts.push(
      `<rect x="${x}" y="${yWall}" width="${w}" height="${hWall}" rx="4" fill="rgba(111,191,138,0.22)" stroke="#6fbf8a"/>
       <text x="${x + w / 2}" y="${yWall + 40}" text-anchor="middle" fill="#c5e6d0" font-size="11">${u.width_mm}</text>`
    );
  }

  parts.push(
    `<text x="${pad}" y="310" fill="#a89a8c" font-size="12">Celkem linka ≈ ${total} mm · korpus 730 · PD ${
      layout.params?.plinth_height ?? 100
    }+${layout.params?.countertop_thickness ?? 40}</text>`
  );
  svg.innerHTML = parts.join("");
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

function ensureViewer() {
  if (viewer) return viewer;
  const host = document.getElementById("view3d");
  viewer = new KitchenViewer(host);
  return viewer;
}

function showViewer(hasScene) {
  document.getElementById("view3d-empty").classList.toggle("hidden", !!hasScene);
}

function renderLayout(layout) {
  const v = layout.validation || {};
  const st = layout.stats || {};
  const styleId =
    document.getElementById("design-style")?.value || layout.styleId || "modern-matt-anthracite";

  document.getElementById("design-summary").innerHTML =
    `<strong>${escapeXml(layout.project?.customerName || "3D návrh")}</strong> · ` +
    `${st.base_count || 0} spodní · ${st.wall_count || 0} horní · ` +
    `validace ${v.ok ? "<span style='color:var(--ok)'>OK</span>" : "<span style='color:#e07a6a'>blokováno</span>"} · ` +
    `<code>${layout.layoutId.slice(0, 8)}…</code>`;

  try {
    ensureViewer().build(layout, styleId);
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

  renderLayoutSvg(layout);

  const bom = layout.bom || [];
  document.getElementById("bom-tbody").innerHTML = bom.length
    ? bom
        .map(
          (b) => `<tr>
            <td><code>${b.sku}</code></td>
            <td>${b.band}</td>
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

  const units = layout.units || [];
  document.getElementById("units-tbody").innerHTML = units.length
    ? units
        .map(
          (u) => `<tr>
            <td><code>${u.sku}</code> <span class="muted">${u.band}</span></td>
            <td>${u.offset_mm}</td>
            <td>${u.width_mm}</td>
            <td>${u.doors?.label || "—"}</td>
          </tr>`
        )
        .join("")
    : '<tr><td colspan="4" class="muted">—</td></tr>';
}

async function loadLayout(layoutId) {
  const layout = await api("/api/v1/layouts/" + layoutId);
  renderLayout(layout);
  document.getElementById("design").scrollIntoView({ behavior: "smooth" });
}

async function generateDesign() {
  const msg = document.getElementById("design-msg");
  const surveyId = document.getElementById("design-survey").value;
  if (!surveyId) {
    msg.hidden = false;
    msg.className = "msg err";
    msg.textContent = "Nejdřív vyber nebo nahraj survey.";
    return;
  }
  msg.hidden = false;
  msg.className = "msg";
  msg.textContent = "Generuji 3D návrh…";
  const styleId = document.getElementById("design-style").value;
  const layout = await api("/api/v1/layouts/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      surveyId,
      styleId,
      plinth_height: Number(document.getElementById("design-plinth").value || 100),
      countertop_thickness: Number(document.getElementById("design-top").value || 40),
      include_wall_above_base: document.getElementById("design-walls").checked,
    }),
  });
  msg.className = "msg ok";
  msg.textContent = `3D layout ${layout.layoutId.slice(0, 8)}… · ${layout.stats.unit_count} modulů`;
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

document.getElementById("design-style").addEventListener("change", () => {
  if (viewer?.layout) {
    viewer.setStyle(document.getElementById("design-style").value);
  }
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

async function loadDesignStyles() {
  try {
    const data = await api("/api/v1/styles");
    const sel = document.getElementById("design-style");
    if (!data.items?.length) return;
    const cur = sel.value;
    sel.innerHTML = data.items
      .map((s) => `<option value="${s.id}">${s.name}</option>`)
      .join("");
    if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
  } catch {
    /* keep hardcoded options */
  }
}

document.getElementById("design-sample").addEventListener("click", async () => {
  const msg = document.getElementById("design-msg");
  msg.hidden = false;
  try {
    const data = await api("/api/v1/surveys/sample", { method: "POST" });
    await refreshSurveys();
    document.getElementById("design-survey").value = data.surveyId;
    msg.className = "msg ok";
    msg.textContent = `Ukázkový survey: ${data.surveyId.slice(0, 8)}…`;
    await generateDesign();
  } catch (e) {
    msg.className = "msg err";
    msg.textContent = e.message;
  }
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
    document.getElementById("design-survey").value = data.surveyId;
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
  loadDesignStyles(),
]).catch(console.error);
