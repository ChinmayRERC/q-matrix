# ---------------------------------------------------------------------------
# Q-matrix · Quantum Space — single-image deployment
#
# Stage 1 builds the Vite/React client. Stage 2 installs the FastAPI service
# and copies the static build next to it, so the public site and /api share one
# origin (no CORS, and the NVIDIA key never reaches the browser).
# ---------------------------------------------------------------------------

FROM node:20-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000
WORKDIR /app

COPY apps/api/requirements.txt ./apps/api/requirements.txt
RUN pip install --no-cache-dir -r apps/api/requirements.txt

COPY apps ./apps
COPY --from=web /app/dist ./dist

EXPOSE 8000
CMD ["sh", "-c", "uvicorn apps.api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
