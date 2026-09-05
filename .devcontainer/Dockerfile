FROM ghcr.io/astral-sh/uv:0.8.22 AS uv
FROM mcr.microsoft.com/devcontainers/typescript-node:5.1.2-24-bookworm
COPY --from=uv /uv /uvx /usr/local/bin/
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*
