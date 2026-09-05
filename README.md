# Louise's Vet Office

A cosy browser game made for Louise, ages 7 and up. Welcome neighbours into a
2.5D clinic, examine their pets in 3D, put clues together, and give gentle care.
Earn happy hearts and coins to grow the office.

The first playable slice includes six pet species, ten authored visits,
interactive 3D examination tools, diagnosis choices, a treatment timing challenge,
retail treats, six shop purchases, saved progress, and optional original sounds.
Louise has a personalised illustrated portrait and a Blender character.

TypeScript, Vite, and Three.js run the game. Original Blender models are exported
as GLB; Nginx serves the finished static build. There is no game server or account
requirement. See the [game design](docs/game-design.md) and
[asset credits](docs/assets.md).

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

The devcontainer includes Node 24, Git, Docker CLI, Codex CLI, Python, headless Blender, and `uvx` for Blender
MCP. It also starts the production web container on port 8080. Development uses a
separate `node_modules` volume to avoid mixing Windows and Linux dependencies.
File polling supports edits through Windows/WSL mounts.

VS Code installs the Codex, Prettier, and Playwright extensions in the container.
Press **F5** to launch the game in Chrome with debugging, or use **Tasks: Run Task**
for development, checks, a web-container rebuild, or resuming a saved Codex chat.
The host needs Node to run the devcontainer's initialization helper.

### Codex chat persistence

Before creating the container, `scripts/prepare-devcontainer.mjs` locates the host
Codex state folder and writes an ignored `.devcontainer/compose.local.yaml`. The
container mounts this folder at `/home/node/.codex` and sets `CODEX_HOME` to it.
Chats, login state, and configuration stay on the host through container rebuilds.
They are not copied into Git or the web image.

On Windows, if the native Codex folder has no sessions, the helper checks the
default WSL distro for existing sessions. For this machine it selects
`Ubuntu_24_04`'s `/home/dbsanfte/.codex`, where this project's existing chats live.
The container user matches that WSL user's IDs so private state remains readable
and writable without changing permissions on the host folder.
For another location, set `VET_GAME_CODEX_HOME` in the environment used to launch
VS Code. The path must be accessible to Docker. Linux hosts need Docker access to
their home directory; Docker Desktop handles the Windows/WSL mount here.

After reopening, select the existing conversation in Codex history. If the
extension filters it out because the workspace is now `/workspaces/vet-game`,
use **Codex: resume any saved chat** (runs `codex resume --all`) or reopen the old
workspace path from inside the container. The helper also mounts that old Linux
path so prior file references still resolve. Resume after the existing turn has
finished. Sharing transcripts preserves history; an active tool process does not
migrate into the new container.

See [Codex state locations](https://developers.openai.com/codex/config-advanced)
and [CODEX_HOME](https://learn.chatgpt.com/docs/config-file/environment-variables).

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
tests against the production build through Vite Preview. Tests cover the examination/diagnosis/treatment loop, rewards, returning patients
to the queue, persistent purchases, mobile overflow, and browser errors. Unit
tests check economy and saved-data handling.

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
load them with Three.js GLTFLoader from `/models/<name>.glb`. The original
clinic, people, examination table, and six pets are already included, so running
the game and CI does not require Blender. Blender creates the models; Three.js
provides rendering and camera controls in the browser.

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

A running Blender instance with its add-on enabled is needed before scene tools
can be used. On this machine, Blender MCP 1.9.1 is installed and enabled in Windows
Blender 5.2, and the connection from the devcontainer has been verified. Reopen
Codex in the devcontainer to load the configured MCP tools. Blender is an authoring
tool and is not part of the web container or CI build.

Configuration references: [Codex MCP](https://developers.openai.com/codex/mcp),
[Blender MCP](https://github.com/ahujasid/blender-mcp),
[Vite](https://vite.dev/guide/).

### Rebuild the original models

With the Windows Blender MCP server running, use the devcontainer terminal:

```sh
uv run --with mcp python scripts/blender-build.py
```

The script uses `scripts/create-blender-assets.py`, recreates its own asset scene,
exports all twelve GLBs, and saves `assets/blender/louises-vet-office.blend`.
It overwrites these generated project assets. On another machine, set
`BLENDER_PROJECT_ROOT` to this repository's absolute path **as seen by Blender**,
and `BLENDER_HOST` to the machine running Blender. For a local Blender install,
you can run the asset script directly in Blender with `PROJECT_ROOT` set first.

To use Blender inside the devcontainer without a desktop window or MCP server:

```sh
python3 scripts/blender-build.py --headless --all
```

The VS Code task **Game: rebuild Blender models (headless)** runs the same command.
It needs neither Windows Blender nor a running MCP server. Use `--examination`
instead of `--all` to rebuild only anatomy and instruments, or omit both flags
to rebuild only the clinic and animated characters. A full rebuild takes several
minutes. `BLENDER_PROJECT_ROOT` can direct output into a separate directory.
This builds from the Python authoring script, so it does not need to open a source
file made by a newer desktop Blender version. It replaces the generated GLBs and
the Blender source files; rebuild the web container afterwards to serve them.
All people and pets include looping `Idle` and `Walk` clips. The fish uses its
walk clip for swimming, with the bowl remaining still.

## Interactive examinations

Select a tool, then hold and drag it over the animal. Body guide buttons offer
a keyboard/touch alternative. **Look around** switches dragging to camera orbit;
rotation buttons remain available while holding a tool.

- The magnifier enlarges the actual textured coat, with individual fur fibres,
  fleas, tangles, sting swelling, and Scout's protruding wooden splinter.
- The X-ray scans the complete skeleton from any camera angle. Pip's front leg
  has separated, displaced bone ends. Use **Whole-body X-ray** for the overview
  and **+ / −** to inspect a smaller area.
- Ear and mouth tools show lit 3D interiors. Healthy ears differ from Milo's
  swollen red canal with wax; Cleo has yellow tartar, and Poppy has a tooth crater.
- The stethoscope shows a moving ECG and a species-specific story reading while
  touching the chest. Enable sound for the matching double heartbeat. Moving off
  the chest stops the reading; the sound preference is saved.

All fourteen diagnostic and care tools have original Blender models. Findings
from the magnifier and X-ray require the problem to be in view. These are
child-friendly fictional cases, not medical simulations or real treatment advice.
