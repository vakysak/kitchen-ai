# M2–M5 Catalog packages

- `cabinets/` — výrobní pravidla (korpus 730, šířky 50 mm, dvířka, **čela 142/286**)
- `products/` — ucelený katalog (`unified_catalog.json`)
  - šablony `KA-*` (kitchen-ai)
  - referenční produkty **Modena 2023** z PDF
  - typologie modulů **BRW** (Family/Semi/Junona)
- `library.py` — knihovna skříněk pro 3D návrh (`mesh` podle family, SKU z katalogu)
- `materials/finishes.json` — barvy a vzory korpusů, frontů, pracovní desky
- `appliances/` / `fittings/` / `lighting/` — zatím plánováno

API: `/api/v1/catalog/library`, `/api/v1/catalog/materials`, `/api/v1/catalog/products`

## Regenerace z PDF

```bash
# PDF → text (PyMuPDF), pak:
python3 scripts/build_catalog_from_pdfs.py
```

Zdroje: `data/catalog-source/modena_2023.pdf`, `brw_2022.pdf`, `brw_2025.pdf`.

Čela šuplíků z Modeny (~140/284) se **nepoužívají** — závazné zůstávají 142 a 286 mm.
