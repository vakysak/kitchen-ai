# Moduly kitchen-ai

Každý modul = samostatně zpracovatelná jednotka (vlastní složka, API hranice, owner).  
SmartMeasure 3D je **externí modul M0**, ne součást tohoto repa.

> **Stav 2026-08:** M0 (SmartMeasure) **odloženo** — chybí LiDAR zařízení.  
> Deploy: **Hetzner + Coolify**, persistent data na SSD `/data/kitchen-ai/`.  
> Viz [DEPLOY_COOLIFY.md](DEPLOY_COOLIFY.md).

---

## M0 — SmartMeasure 3D (spolupracující app) — ODLOŽENO

| | |
|---|---|
| **Repo** | `/Users/josefhampl/SmartMeasure3D` |
| **Účel** | Zaměření prostoru pro výrobu a montáž |
| **Vstup** | LiDAR / RoomPlan, Leica DISTO BLE, ruční koty, fotky |
| **Výstup** | `RoomSurvey` JSON (viz survey-contract) → import do kitchen-ai |
| **Vlastní entity** | Project, Room, Wall, Opening, MountZone, WindowSill, Floor/CeilingPlane |
| **Nedělá** | Layout skříněk, katalog spotřebičů, AI vizualizace, cenová nabídka |
| **Stav** | Kód existuje; **neprodukční** dokud není zařízení. Survey lze nahrát ručně na API. |

---

## M1 — Project Hub

| | |
|---|---|
| **Složka** | `packages/project-hub`, `apps/api` routes `/projects` |
| **Účel** | Zakázky, zákazník, stav, vazba na importovaný survey |
| **Vstup** | Ruční vytvoření + import RoomSurvey |
| **Výstup** | Project ID, verze survey, odkazy na layout/export |
| **Závislosti** | M0 (data), DB |

**Deliverable:** CRUD projektů, historie importů SM.

---

## M2 — Catalog: Skříňky (modulový systém)

| | |
|---|---|
| **Složka** | `packages/catalog/cabinets` |
| **Účel** | Výrobní moduly korpusů |
| **Pravidla (závazná)** | Korpus spodní **730 mm**; sokl **100** (80–150); deska 20/30/40/60; mezera PD→horní 450–650; atyp šířka po 1 mm |
| **Výstup** | JSON/DB katalog + výpočet výšky PD |
| **Závislosti** | žádné |

**Deliverable:** `cabinet_system.py` + seed data.

---

## M3 — Catalog: Spotřebiče

| | |
|---|---|
| **Složka** | `packages/catalog/appliances` |
| **Účel** | Rozměry, výklenek, výřez, přípojky, fotka, cena |
| **Vstup** | Import (Icecat / výrobci / CSV) |
| **Výstup** | Appliance records pro layout + validátor |
| **Závislosti** | M2 (min. šířka skříňky) |

**Deliverable:** schéma + seed (myčka 45/60, indukce 60/80, trouba, lednice, digestoř, dřez).

---

## M4 — Catalog: Kování

| | |
|---|---|
| **Složka** | `packages/catalog/fittings` |
| **Účel** | Blum / Hettich — závěsy, výsuvy, AVENTOS, TIP-ON |
| **Vstup** | Import BXF / CSV / manuální |
| **Výstup** | Kompatibilita s šířkou/hloubkou/váhou fronty |
| **Závislosti** | M2 |

---

## M5 — Catalog: Osvětlení

| | |
|---|---|
| **Složka** | `packages/catalog/lighting` |
| **Účel** | LED pod horními, sokl, zásuvky, ambient |
| **Závislosti** | M2, M4 (napájení / spínače) |

---

## M6 — Style Library

| | |
|---|---|
| **Složka** | `packages/styles` |
| **Účel** | Pojmenované styly (JSON): barvy, dvířka, deska, zástěna |
| **Výstup** | Style ID → prompt + materiály |
| **Závislosti** | žádné |

**Start styly:** Scandinavian, Modern Organic, Japandi, Minimalist Dark, Industrial Warm, Classic Modern.

---

## M7 — Reference Images

| | |
|---|---|
| **Složka** | `packages/references` |
| **Účel** | Legální zásoba inspirací (Pexels/Unsplash/Pixabay), tagy |
| **Výstup** | Galerie + výběr 1–3 referencí pro vizualizaci |
| **Závislosti** | M6 (tagy stylů) |

**Netrénovat vlastní model** — IP-Adapter / reference image později v M10.

---

## M8 — Layout Engine

| | |
|---|---|
| **Složka** | `packages/layout-engine` |
| **Účel** | Rozmístění skříněk + spotřebičů do MountZone / stěn |
| **Vstup** | RoomSurvey + výběr spotřebičů + styl |
| **Výstup** | Layout JSON (pozice mm, typ korpusu, spotřebič) |
| **Závislosti** | M0/M1, M2, M3, M6 |
| **Respektuje** | pracovní trojúhelník, přípojky, deformaci zóny (svírání → atyp) |

---

## M9 — Validator

| | |
|---|---|
| **Složka** | `packages/validator` |
| **Účel** | Tvrdá pravidla — AI / layout nesmí navrhnout nesmysl |
| **Vstup** | Layout + RoomSurvey + katalogy |
| **Výstup** | CRITICAL / WARNING / INFO |
| **Závislosti** | M2–M5, M8 |

**Příklady CRITICAL:** myčka se nevejde; lednice u varné; horní přes okno; chybí ventilace lednice; výsuv delší než hloubka.

---

## M10 — Visualizer (AI)

| | |
|---|---|
| **Složka** | `packages/visualizer` |
| **Účel** | Fotorealistický náhled **až po úspěšné validaci** |
| **Vstup** | Layout + style + reference images |
| **Výstup** | Obrázky (více pohledů) |
| **Závislosti** | M8, M9 OK, M6, M7 |

---

## M11 — Pricing

| | |
|---|---|
| **Složka** | `packages/pricing` |
| **Účel** | Orientační / výrobní kalkulace |
| **Závislosti** | M2–M5, M8 |

---

## M12 — Export PDF

| | |
|---|---|
| **Složka** | `packages/export-pdf` |
| **Účel** | Tisk pro klienta: vizuál, půdorys, kusovník, cena |
| **Závislosti** | M8–M11 |

---

## M13 — API (backend)

| | |
|---|---|
| **Složka** | `apps/api` |
| **Účel** | REST: projekty, import survey, layout, validate, visualize, export |
| **Endpoint importu** | `POST /api/v1/surveys/import` (tělo = RoomSurvey) |

---

## M14 — Web (frontend designér)

| | |
|---|---|
| **Složka** | `apps/web` |
| **Účel** | PC UI: projekt, canvas místnosti, katalog, layout, validace, PDF |
| **Uživatel** | Firma / designér (ne self-service zákazník) |

---

## M15 — Sync Bridge

| | |
|---|---|
| **Složka** | `packages/sync-bridge` |
| **Účel** | Přijmout export ze SmartMeasure (soubor / Drive / HTTPS) |
| **Vstup** | `.smartmeasure.json` / RoomSurvey |
| **Výstup** | Záznam v M1 + raw archive |

---

## Pořadí implementace (sprinty)

| Sprint | Moduly | Výsledek |
|---|---|---|
| S0 | M0 kontrakt + M15 skeleton | SM umí exportovat, AI umí přijmout |
| S1 | M1 + M2 + M9 (základ) | Projekt + skříňky + validace fit |
| S2 | M3 + M8 | Spotřebiče + layout L/linka |
| S3 | M4 + M5 | Kování + světla |
| S4 | M14 canvas + M12 | Web + PDF |
| S5 | M6 + M7 + M10 | Styly + reference + vizualizace |
| S6 | M11 polish | Ceník |

---

## Co nepatří kam

| Nesmí | Kde to řešit |
|---|---|
| Layout v SmartMeasure | M8 |
| LiDAR v kitchen-ai | M0 |
| „Hezký obrázek“ bez validace | M9 před M10 |
| Scraping proti TOS (Houzz/Pinterest jako bulk) | jen M7 legální API |
