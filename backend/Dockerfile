# ==========================================================================
#  Imagen de la API (FastAPI) con el controlador ODBC 18 de SQL Server.
#  Las dependencias de Python se instalan dentro de la imagen; el código,
#  los modelos entrenados (ml/modelos) y el .env se montan desde el equipo.
#  Autores: Marlon David Pérez Almachi, Víctor Manuel Lluilema Pisco (UNEMI, 2026)
# ==========================================================================
FROM python:3.13-slim-bookworm

ENV PYTHONUNBUFFERED=1 PYTHONUTF8=1 PYTHONIOENCODING=utf-8 ACCEPT_EULA=Y

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl gnupg ca-certificates unixodbc libgomp1 \
 && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft.gpg \
 && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" \
      > /etc/apt/sources.list.d/mssql-release.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends msodbcsql18 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
COPY requirements.txt .
RUN pip install --no-cache-dir --disable-pip-version-check -r requirements.txt

EXPOSE 8090
HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=12 \
  CMD curl -fsS http://localhost:8090/api/salud || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8090"]
