# kitchen-ai

Interní návrhář kuchyní na **Hetzner + Coolify**, data na **SSD** (`/data/kitchen-ai`).

**SmartMeasure 3D** = pozdější vstup (zatím chybí zařízení) — odloženo.

## Deploy

Viz [docs/DEPLOY_COOLIFY.md](docs/DEPLOY_COOLIFY.md).

```bash
# lokálně
docker compose up --build
curl -s http://localhost:8000/health
```

## Moduly

[docs/MODULES.md](docs/MODULES.md) · Integrace SM: [docs/SMARTMEASURE_INTEGRATION.md](docs/SMARTMEASURE_INTEGRATION.md)

## Stack

| Služba | Port | Úložiště SSD |
|---|---|---|
| `api` (FastAPI) | 8000 | `/data/kitchen-ai/{uploads,exports,surveys,references}` |
| `db` (Postgres 16) | 5432 | `/data/kitchen-ai/postgres` |

Coolify server (aktuálně): host Coolify, veřejné appky na `*.46.225.122.108.sslip.io` / vlastní domény.
