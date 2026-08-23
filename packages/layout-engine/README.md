# M8 Layout Engine — rozmístění do MountZone ze SmartMeasure

Importovatelný kód: `packages/layout_engine/`

```python
from packages.layout_engine import generate_layout
layout = generate_layout(survey, survey_id="…", plinth_height=100)
```

**Vstup:** RoomSurvey + parametry (sokl, deska, styl)  
**Výstup:** Layout JSON (mm) — units, zones, BOM, warnings  
**Pravidla:** korpus 730, šířky po 50 mm, filler při converging, volitelné horní auto
