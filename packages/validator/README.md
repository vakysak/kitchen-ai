# M9 Validator — tvrdá výrobní a ergonomická pravidla

```python
from packages.validator import validate_layout
result = validate_layout(layout, survey)
# result["ok"] == False → CRITICAL; blokuje M10 viz / M12 PDF
```

CRITICAL musí blokovat AI vizualizaci (M10) i PDF (M12).
