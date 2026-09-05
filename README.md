# Vet Game

A browser game starting with an interactive Hello World. TypeScript + Vite build
static files, Nginx serves them, and Playwright checks the running game on desktop
and mobile Chromium.

## Run the web container

Start Docker Desktop (Linux containers), then run from this folder:

```sh
docker compose up --build --detach --wait
```

Open **http://localhost:8080**. `GET /healthz` returns `ok`.

```sh
docker compose logs -f web
docker compose down
```

Rebuild after source changes with the same `up --build` command. To change the
port, copy `.env.example` to `.env` and set `WEB_PORT`.

On Windows, these commands work in PowerShell. For WSL, enable your distro under
Docker Desktop → Settings → Resources → WSL Integration. Node is not required to
build or run the production container.

## Develop in the devcontainer

1. Open this folder in VS Code with the Dev Containers extension installed.
2. Run **Dev Containers: Reopen in Container**.
3. Wait for dependencies and the Chromium test browser to install.
4. Run `npm run dev` in its terminal, then open **http://localhost:5173**.

The devcontainer includes Node 24, Git, Docker CLI, Python, and `uvx` for Blender
MCP. It also starts the production web container on port 8080. Development uses a
separate `node_modules` volume to avoid mixing Windows and Linux dependencies.
File polling supports edits through Windows/WSL mounts.

To develop without a container, install Node 24 and run:

```sh
npm ci
npm run dev
```

## Verify

```sh
npx playwright install --with-deps chromium
npm run check
```

`check` verifies formatting, typechecks and builds the game, then runs browser
tests against the production build through Vite Preview. Tests check the initial
screen, keyboard interaction, mobile overflow, and browser errors.

To test the actual Nginx container, start it and set `PLAYWRIGHT_BASE_URL`:

```sh
PLAYWRIGHT_BASE_URL=http://localhost:8080 npm test
```

In PowerShell:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:8080'
npm test
Remove-Item Env:PLAYWRIGHT_BASE_URL
```

Use `npm run format` to apply formatting.

## CI and delivery

[The GitHub Actions workflow](.github/workflows/ci.yml) runs on pull requests,
pushes to `main`, and manual dispatch. It installs locked dependencies, checks
formatting, typechecks, builds, launches the production container, and runs the
browser and HTTP smoke tests against it. Failed browser runs upload diagnostics.

After a successful `main` run, it publishes that exact tested image to:

```text
ghcr.io/<owner>/<repository>:<full-commit-sha>
ghcr.io/<owner>/<repository>:latest
```

Publishing uses the repository's `GITHUB_TOKEN` with `packages: write`; no separate
registry secret is needed. The repository is
[dbsanfte/vet-game](https://github.com/dbsanfte/vet-game).

This first delivery stage publishes a runnable image. Automatic deployment to an
external server is not configured because there is no deployment destination yet.
On a Docker host, deploy a published version using this repository's Compose file:

```sh
export WEB_IMAGE='ghcr.io/dbsanfte/vet-game:<full-commit-sha>'
docker compose pull web
docker compose up --detach --no-build --wait web
```

Private packages require `docker login ghcr.io`. Pin a commit tag for repeatable
deployments and use a previous tag to roll back. Compose binds to loopback by
default; configure an ingress/reverse proxy when choosing a public host.

## Blender assets and MCP

Keep Blender source files in `assets/blender/` and export runtime `.glb` files into
`public/models/`. Vite copies the latter into the web image, where the game can
load them from `/models/<name>.glb`. No renderer or asset loader is selected yet.

The project [Codex MCP configuration](.codex/config.toml) launches
`uvx blender-mcp==1.9.1`. Codex loads project configuration for trusted projects;
reopen the project/client after setup. `uvx` is installed in the devcontainer. If
Codex runs on the host instead, install [uv](https://docs.astral.sh/uv/getting-started/installation/)
there too.

1. Install and enable the add-on following the
   [Blender MCP instructions](https://github.com/ahujasid/blender-mcp#installing-the-blender-addon)
   on the machine running Blender.
2. In Blender's 3D viewport, open the sidebar with **N**, select the Blender MCP
   panel, and start its server (default port `9876`).
3. Run Codex in this project. The MCP process defaults to `localhost`; the
   devcontainer provides `BLENDER_HOST=host.docker.internal` to reach host Blender.
   WSL clients connecting to Windows Blender may need `BLENDER_HOST` set to the
   Windows host address, depending on WSL networking.
4. Confirm the connection by asking the client to inspect the current Blender
   scene. If unreachable, check the host address, firewall, and add-on bind address;
   do not expose the Blender socket to the public internet.

Only the MCP configuration and asset folders are supplied here. A running Blender
instance with its add-on enabled is needed before scene tools can be used. Blender
is an authoring tool and is not part of the web container or CI build.

Configuration references: [Codex MCP](https://developers.openai.com/codex/mcp),
[Blender MCP](https://github.com/ahujasid/blender-mcp),
[Vite](https://vite.dev/guide/).
