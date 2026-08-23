# Catalog source PDFs (local)

Download originals into this folder, then extract text and rebuild:

```bash
# e.g. Modena
curl -L -o modena_2023.pdf "https://www.nabytekmorava.cz/user/related_files/katalog_kuchyne_modena_2023-4.pdf"

python3 - <<'PY'
import fitz
from pathlib import Path
for pdf in Path('.').glob('*.pdf'):
    doc = fitz.open(pdf)
    out = pdf.with_suffix('.txt')
    parts = []
    for i, page in enumerate(doc):
        parts.append(f"\n===== PAGE {i+1} =====\n")
        parts.append(page.get_text('text'))
    out.write_text(''.join(parts), encoding='utf-8')
    print(pdf, '→', out)
PY

python3 ../../scripts/build_catalog_from_pdfs.py
```

PDF binaries are gitignored; keep `*.txt` extracts for reproducible builds.

Also used for **design references** (not manufacturing):
- `extom_*.pdf`, `hanak_kitchens.pdf`, `oresi_livanza.pdf`, `nobilia_*.pdf`, BRW
- Styles → `packages/styles/`; Pegas sestavy → `packages/references/example_kitchens.json`
