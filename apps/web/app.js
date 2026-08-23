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

async function refreshSurveys() {
  const tbody = document.getElementById("survey-tbody");
  const data = await api("/api/v1/surveys");
  document.getElementById("stat-surveys").textContent = String(data.count ?? 0);
  if (!data.items?.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="muted">Zatím žádný survey — nahraj JSON.</td></tr>';
    return;
  }
  tbody.innerHTML = data.items
    .map(
      (s) => `<tr>
        <td>${s.project?.customerName || "—"}</td>
        <td><code>${s.surveyId}</code></td>
        <td>${fmtDate(s.importedAt)}</td>
      </tr>`
    )
    .join("");
}

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
  refreshModules(),
  calcWorktop(),
  frontPlan(),
  loadWidthChips(),
]).catch(console.error);
