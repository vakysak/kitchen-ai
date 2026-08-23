# kitchen-ai

Interní návrhář kuchyní na **Hetzner + Coolify**, data na **SSD** (`/data/kitchen-ai`).

**Návrh (M8/M9):** import RoomSurvey → generování layoutu skříněk do MountZone → validace.  
**SmartMeasure 3D** = pozdější hardwarový vstup (zatím JSON upload / ukázkový survey).

## Deploy

Viz [docs/DEPLOY_COOLIFY.md](docs/DEPLOY_COOLIFY.md).

```bash
# lokálně
docker compose up --build
curl -s http://localhost:8000/health
# UI: otevři / → sekce Návrh → „Ukázkový survey“
```

## Moduly

[docs/MODULES.md](docs/MODULES.md) · Integrace SM: [docs/SMARTMEASURE_INTEGRATION.md](docs/SMARTMEASURE_INTEGRATION.md)

## Stack

| Služba | Port | Úložiště SSD |
|---|---|---|
| `api` (FastAPI) | 8000 | `/data/kitchen-ai/{uploads,exports,surveys,layouts,references}` |
| `db` (Postgres 16) | 5432 | `/data/kitchen-ai/postgres` |

Coolify server (aktuálně): host Coolify, veřejné appky na `*.46.225.122.108.sslip.io` / vlastní domény.
