# syntax=docker/dockerfile:1.7
# Scraper container. One-shot: runs scraper.py then exits.
# Deploy as ECS Scheduled Task, K8s CronJob, or `docker run` under systemd/cron.
FROM python:3.12-slim

# System deps (curl + ca-certs for JobSpy's underlying HTTP libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY scraper.py .

# The container reads config from env vars — no .env baked in.
CMD ["python", "-u", "scraper.py"]
