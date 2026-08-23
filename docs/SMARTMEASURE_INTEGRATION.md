# Integrace SmartMeasure 3D ↔ kitchen-ai

## Princip

```
┌─────────────────────┐         RoomSurvey v1          ┌─────────────────────┐
│  SmartMeasure 3D    │  ───────────────────────────►  │     kitchen-ai       │
│  (měření, deformace)│     soubor / Drive / HTTPS     │  (návrh, výroba UI)  │
└─────────────────────┘                                └─────────────────────┘
```

- SmartMeasure je **zdroj pravdy pro geometrii prostoru**.
- kitchen-ai je **zdroj pravdy pro návrh skříněk / spotřebičů / ceny**.
- Obě appky sdílí jen **kontrakt** `packages/survey-contract` (JSON Schema).
- Změna rozměrů skříněk se **nevrací** do SmartMeasure (jednosměrný tok survey → design).  
  (Volitelně později: annotation layer „navrženo“ zpět jako overlay — není MVP.)

## Tok dat

1. Designér zaměří v SmartMeasure (stěny, MountZone, parapet, podlaha/strop).
2. SM vyexportuje `RoomSurvey` (`Export → kitchen-ai` / Drive složka projektu).
3. kitchen-ai **M15 Sync** importuje soubor → **M1 Project**.
4. Designér v **M14** spustí layout (M8) → validace (M9) → PDF (M12).

## Verzování

- Pole `schemaVersion`: `"1.0.0"`
- kitchen-ai odmítne major verzi, kterou nezná
- SmartMeasure může přidávat volitelná pole (`extensions`) — AI je ignoruje, dokud je nepodporuje

## Mapování entit

| SmartMeasure | RoomSurvey | kitchen-ai použití |
|---|---|---|
| Project | `project` | M1 zákazník / adresa |
| Room | `rooms[]` | editor místnosti |
| Wall | `walls[]` | délky 3 výšky, svislost, rovinnost |
| Opening | `openings[]` | okna/dveře — zákaz horních skříněk přes okno |
| MountZone | `mountZones[]` | **hlavní vstup layoutu** (šířky dole/střed/nahoře, hloubky, plumb, Δ podlahy/stropu) |
| WindowSill | `windowSills[]` | kolize s deskou / atyp |
| FloorPlane / CeilingPlane | `floor` / `ceiling` | sokl, výška sloupců, lišty |
| WallElement | `utilities[]` | voda, odpad, el., plyn — kotvy layoutu |

## Deformace → výroba (povinné)

MountZone musí nést:

- `widthBottom` / `widthMid` / `widthTop`
- `depthLeft` / `depthMid` / `depthRight`
- `wallsConvergeDivergeType` + odchylky svislosti
- `floorLevelDelta` / `ceilingLevelDelta`
- flagy: `requiresScribing`, `requiresAtypicalSide`, …

Layout engine (M8) při `converging` / `diverging` **nesmí** nabídnout jen rovný korpus bez atyp / seříznutí — Validator (M9) to hlídá.

## Soubor

- Název: `{customer}-{room}-survey-v{schemaVersion}.json`
- MIME: `application/json`
- Schema: [`../packages/survey-contract/room-survey.schema.json`](../packages/survey-contract/room-survey.schema.json)

## API (kitchen-ai)

```
POST /api/v1/surveys/import
Authorization: Bearer …
Content-Type: application/json

→ { "projectId": "…", "surveyId": "…", "warnings": [] }
```

## Povinnosti SmartMeasure (checklist)

- [ ] Export RoomSurvey v1 (všechny MountZone s 3 šířkami)
- [ ] Stabilní UUID entit mezi re-exporty stejné zakázky
- [ ] Jednotky vždy **mm**
- [ ] `measuredAt` + `appVersion`
- [ ] (Volitelně) upload na kitchen-ai endpoint / Google Drive `kitchen-ai-inbox/`

## Povinnosti kitchen-ai (checklist)

- [ ] Validace proti JSON Schema při importu
- [ ] Uchovat raw JSON (audit)
- [ ] UI: „Zaměřeno ve SmartMeasure“ + odkaz na rizika montáže
- [ ] Layout nesmí zahodit converge/diverge informace
