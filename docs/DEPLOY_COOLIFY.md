# Deploy kitchen-ai na Hetzner přes Coolify (SSD úložiště)

## Kontext

| | |
|---|---|
| Coolify server | `localhost` (host Coolify) — IP veřejná např. `46.225.122.108` |
| Coolify MCP | **read-only** → resource musíš vytvořit v UI |
| SmartMeasure | **zatím ne** (chybí zařízení) |
| Data | bind mount na **SSD hostu** `/data/kitchen-ai/` |

## 1) Připravit SSD adresáře na serveru

SSH na Hetzner (Coolify host) a spusť:

```bash
sudo mkdir -p /data/kitchen-ai/{uploads,exports,surveys,references,postgres}
sudo chown -R 999:999 /data/kitchen-ai/postgres   # postgres alpine UID
sudo chmod -R 755 /data/kitchen-ai
df -h /data   # ověř, že /data je na SSD (NVMe)
```

## 2) Repo na GitHub

Pushni `kitchen-ai` (např. `vakysak/kitchen-ai`), větev `main`.

## 3) Coolify UI

1. **Projects** → **+ Add** → název `kitchen-ai`
2. **+ New Resource** → **Docker Compose**
3. Napoj Git repo `kitchen-ai`, soubor `docker-compose.yml`
4. Environment:
   - `POSTGRES_PASSWORD=` (silné heslo)
   - `CORS_ORIGINS=https://tvoje-domena`
5. Doména: např. `https://kitchen.vakysak.cz` → mapuj na službu **`api`**, port **`8000`**
6. Deploy

## 4) Ověření

```bash
curl -s https://kitchen.vakysak.cz/health
curl -s https://kitchen.vakysak.cz/api/v1/modules
```

Upload ukázkového survey:

```bash
curl -s -F "file=@packages/survey-contract/examples/sample-room-survey.json" \
  https://kitchen.vakysak.cz/api/v1/surveys/import
```

Soubor musí přistát na serveru v `/data/kitchen-ai/surveys/`.

## 5) Co je na SSD

```
/data/kitchen-ai/
  postgres/      # DB
  surveys/       # RoomSurvey JSON (později ze SmartMeasure)
  uploads/       # obecné uploady
  exports/       # PDF / SVG výstupy
  references/    # inspirační fotky (M7)
```

## Poznámky

- Hlavní disk Hetzner Cloud = NVMe SSD; `/data` je standard Coolify cesta na stejném disku.
- Pokud máš **samostatný volume** přimountovaný jinde, změň v `docker-compose.yml` cesty (např. `/mnt/HC_Volume_xxx/kitchen-ai/...`).
- Postgres v compose je součástí stacku; alternativně Coolify standalone PostgreSQL (jako u `korpus-db`) a do API jen `DATABASE_URL`.
