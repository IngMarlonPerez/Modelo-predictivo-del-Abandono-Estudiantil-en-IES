# ==========================================================================
#  Imagen de la aplicación web (React + Vite). Las dependencias de Node se
#  instalan dentro de la imagen; /api se reenvía al contenedor de la API.
#  Autores: Marlon David Pérez Almachi, Víctor Manuel Lluilema Pisco (UNEMI, 2026)
# ==========================================================================
FROM node:25-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY . .

ENV VITE_BACKEND_URL=http://api:8090
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=12 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "3000", "--strictPort"]
