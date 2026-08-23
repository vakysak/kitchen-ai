FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    KITCHEN_AI_DATA=/data

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY apps/api/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY apps/api/main.py /app/main.py
COPY apps/web /app/web
COPY packages /app/packages

ENV KITCHEN_AI_WEB=/app/web
ENV PYTHONPATH=/app

RUN mkdir -p /data/uploads /data/exports /data/surveys /data/layouts /data/references \
    && mkdir -p /app/packages/catalog/cabinets /app/packages/catalog/products \
    && mkdir -p /app/packages/styles /app/packages/references \
    && mkdir -p /app/packages/layout_engine /app/packages/validator \
    && touch /app/packages/__init__.py \
    && touch /app/packages/catalog/__init__.py \
    && touch /app/packages/catalog/cabinets/__init__.py \
    && touch /app/packages/catalog/products/__init__.py \
    && touch /app/packages/styles/__init__.py \
    && touch /app/packages/references/__init__.py \
    && touch /app/packages/layout_engine/__init__.py \
    && touch /app/packages/validator/__init__.py

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD curl -fsS http://127.0.0.1:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
