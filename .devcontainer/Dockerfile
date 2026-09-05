FROM ghcr.io/astral-sh/uv:0.8.22 AS uv
FROM mcr.microsoft.com/devcontainers/typescript-node:5.1.2-24-bookworm
ARG DEV_UID=1000
ARG DEV_GID=1000
RUN if [ "$(id -g node)" != "$DEV_GID" ]; then groupmod --gid "$DEV_GID" node; fi \
    && if [ "$(id -u node)" != "$DEV_UID" ]; then usermod --uid "$DEV_UID" node; fi \
    && chown -R node:node /home/node
COPY --from=uv /uv /uvx /usr/local/bin/
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global @openai/codex@0.153.4
