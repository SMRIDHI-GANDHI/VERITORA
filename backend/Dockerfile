FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN pip install --no-cache-dir --upgrade pip

# Install dependencies first for better layer caching
COPY pyproject.toml ./
RUN pip install --no-cache-dir .

# Copy application source (app, alembic, alembic.ini, config, etc.)
COPY . .

# Render provides $PORT at runtime; default 8000 for local runs
EXPOSE 8000

# Run migrations, then start the API. ${PORT:-8000} supports Render ($PORT) and local default.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
