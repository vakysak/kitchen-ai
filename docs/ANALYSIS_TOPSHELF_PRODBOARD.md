# Analýza: TOP-SHELF nobilia 3D kitchen planner mobile

Datum: 2026-08-23  
URL: https://top-shelf.de/en/products/nobilia-3d-kitchen-planner-mobile

## Verdikt (stručně)

Nejde o nativní Shopify appku, ale o **embed cloudového CPQ/3D konfigurátoru ProdBoard**.  
Shopify stránka je jen obal (e-shop + košík). Katalog nábytku, 3D assety a pravidla žijí na `*.prodboard.com` a jsou **proprietární** (Nobilia + ProdBoard) — kompletní scrap knihovny (modely, textury, ceník, rule engine) není legálně/technicky „volně ke zkopírování“.

| Co | Hodnota |
|---|---|
| Embed | `iframe` → `https://planner.prodboard.com/top-shelf-mvp/demo_uk` |
| Tenant | `company: top-shelf-mvp`, `instance: demo_uk` |
| Frontend | Angular SPA `prodboard-v2-constructor-web` (build `v2-20260822-3+e509552`) |
| API | `https://api-v2.prodboard.com/` (health = Healthy; katalog bez auth/session vrací 404) |
| Assety | `https://blobs.prodboard.com/` (Azure Blob storage) |
| Hosting | Azure (West Europe), Application Insights |
| E-shop most | Shopify + `postMessage` + custom `/apps/create-variant-coolify` |

## 1. Architektura

```
┌──────────────────────────── Shopify (top-shelf.de) ────────────────────────────┐
│  Product page + CartMiddleware + windowboard() embed helper                       │
│  postMessage bridge (origin lock: planner.prodboard.com)                       │
│  Add-to-cart → create Shopify variants (price/SKU/configId) → /cart            │
└───────────────────────────────┬────────────────────────────────────────────────┘
                                │ iframe
                                ▼
┌──────────────────────────── ProdBoard planner ─────────────────────────────────┐
│  Angular constructor UI + WebGL/Three.js (+ GLTF pipeline / workers)           │
│  Routes: catalogs, products, materials, projects, configurator, AR, CRM…       │
│  Rules/CPQ + 3D scene + pricing                                                │
└───────────────┬───────────────────────────────┬────────────────────────────────┘
                │ REST                          │ blobs
                ▼                               ▼
        api-v2.prodboard.com              blobs.prodboard.com
```

### Embed API (Shopify → iframe)

Inicializace na product page:

```js
prodboard(document.getElementById("canvas-frame"), {
  company: "top-shelf-mvp",
  instance: "demo_uk",
  host: "top-shelf.de",
  environment: "https://planner.prodboard.com"
});
```

URL iframe = `{environment}/{company}/{instance}` (+ volitelný `#state` / `?prodboard=`).

**postMessage příkazy (parent ↔ iframe):**
- iframe → parent: `init-completed`, `set_state`, `redirect`, `open`, (+ cart/planner payload přes custom handler `PLANNER`)
- parent → iframe: `sign-in`, `sign-out`, `load {guid, clone}`, libovolný `send(command, payload)`

CSP planneru: `frame-ancestors https://top-shelf.de` (embed jen z domény dealera).

## 2. Co je „knihovna nábytku“ uvnitř

ProdBoard modeluje katalog jako firemní content pack, ne jako veřejný dump:

- **Catalogs** (`catalog/:catalogId`, import/export, reset-base, bake AO, compress model/texture, generate icon)
- **Products / modules** (produkty, links, profiles import/export)
- **Folders** v katalogu: `decors`, `models`, `modules`, `textures`
- **Materials / settings/assets**
- **Classificators / categories / collections**
- **Projects** (uložené návrhy, GUID state v URL)

### Pokrytí katalogu Nobilia (ProdBoard prototype 2025 — veřejné claimy)

| Skupina | Typ | Pokrytí (prototype) |
|---|---|---|
| M 3.0–3.91 | Base units | 1487 / 1548 |
| M 4.0–4.37 | Worktops | 97 / 222 |
| M 5.0–5.42 | Uprights, top/wall shelves, pilasters | 729 / 738 |
| M 6.0–6.149 | Highboards / tall | 1385 / 1443 |
| M 7.0–7.76 | Wall units | 858 / 912 |
| M 8.0–8.154 | Line N (handleless) | 1643 / 1647 |

Další: spotřebiče (částečně), nBOX zásuvky, osvětlení Line N, Placement Assistant (fillery), Presentation Mode, animace výsuvů/výklopů, IDM + EDI.

TOP-SHELF marketing k dekorům:
- **81+ front dekorů** (LASER, RIVA, STRUCTURA, TOUCH, EASYTOUCH, SENSO, NOVALUX, CASCADA, NORDIC, …)
- **LINE N**, **Sakura / Japandi**
- **67+ dekory PD** (laminát, compact, Xtra keramika, kámen, kvarc) — příklady: 078, 149, 235, 373, 781, 806
- kategorie: **base / wall / tall / sink base**, sety se spotřebiči, filler strips, worktop, appliances

## 3. UX / funkce plánovače (z dealera + help)

Levý panel (dle TOP-SHELF guide):
1. **Kitchen options** — globální dekory (fronty, PD, niches…)
2. **Add item** — kategorie skříněk; v půdorysu „+“ mezi skříňkami
3. **Opening side / Width** — u vybraných modulů
4. **Filling strips**
5. **Options** na skříňce — spotřebiče / accessories
6. realtime **cena** → odeslání / košík

Dva produkty plánovače na shopu: desktop „professional“ vs **mobile** (tento URL).

## 4. Technický stack (evidence z bundle)

| Vrstva | Technologie |
|---|---|
| SPA | Angular (`ng-version` / lazy chunks), Material icons, Roboto |
| 3D | WebGL, Three.js stopy, GLTFLoader, decode/transcode **workers** |
| Backend | `api-v2.prodboard.com` (Azure App), health endpoint |
| Storage | Azure Blobs `blobs.prodboard.com` |
| Telemetry | Application Insights (West Europe) |
| Abuse | reCAPTCHA sitekey v configu |
| Version | `v2-20260822-3+e509552` |

## 5. Shopify commerce most

`CartMiddleware`:
1. Planner pošle konfiguraci (položky, price, sku, configurationId, metafields)
2. Parent volá `POST /apps/create-variant-coolify` (Coolify custom app)
3. Vzniknou Shopify varianty „Küchenplanung“
4. Add to cart → checkout

To je dealer pattern: **konfigurátor = lead + BOM + cena**, shop = platba/doprava.

## 6. CanvasLogic vs ProdBoard

- **CanvasLogic** = oficiální Nobilia dealer configurator case study (iframe embed do e-shopů).
- **TOP-SHELF mobile product page aktuálně embeduje ProdBoard**, ne CanvasLogic runtime.
- ProdBoard má vlastní „Nobilia 2025 prototype catalog“ — TOP-SHELF instance `top-shelf-mvp/demo_uk` je dealer tenant nad ProdBoardem (MVP pojmenování).

Pro kitchen-ai: ber ProdBoard/CanvasLogic jako **referenci UX + datového modelu**, ne jako zdroj ke zkopírování.

## 7. Co nešlo / omezení scrapu

1. **Cross-origin iframe** — z parent stránky nejdou číst DOM ani network callsy uvnitř planneru.
2. **API katalogu** bez session/auth vrací 404 (ne otevřený public catalog dump).
3. Blobs bez SAS tokenu → `InvalidQueryParameterValue` / `ResourceNotFound`.
4. Kompletní stažení 3D knihovny = stažení proprietárních CAD/GLTF + textur + ceníku + rule engine → **IP Nobilia/ProdBoard**, pro kitchen-ai nevhodné a rizikové.

## 8. Doporučení pro kitchen-ai (co převzít jako vzor)

1. **Oddělit** web shop/UI od **catalog+rules+3D** služby (jako Shopify ↔ ProdBoard).
2. Katalog struktura: `catalog → folders(modules/decors/materials/textures/models) → products` + classificators.
3. **Rule engine** před vizualizací (validní sestavy) — máme M9.
4. Embed/API kontrakt: `company/instance` + project GUID + postMessage/cart bridge.
5. Prezentace řad (front programs, PD dekory, LINE N) = UI pattern z Top Shelf marketingu — u nás mapovat na M6 styly, rozměry držet **730 / 142 / 286**.
6. Nesnažit se zrcadlit Nobilia SKU 1:1; budovat **vlastní KA katalog** + volitelně IDM-like export později.

## 9. Zdroje

- https://top-shelf.de/en/products/nobilia-3d-kitchen-planner-mobile
- https://top-shelf.de/en/pages/online-kuechenplaner
- https://planner.prodboard.com/top-shelf-mvp/demo_uk
- https://api-v2.prodboard.com/health
- https://prodboard.com/nobilia_prototype_catalog
- https://canvaslogic.com/case-studies/3d-kitchen-configurator-drives-nobilias-growth-in-a-digital-market/
