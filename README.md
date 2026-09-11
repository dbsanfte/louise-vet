# Louise's Vet Office

**[Play Louise's Vet Office at louise.vet](https://louise.vet/)**

A cosy browser game made for Louise and designed for animal lovers aged **7 and
up**. Step into Louise's shoes as the neighbourhood vet in Hookville: meet the
families, help their pets feel better, and turn a little clinic into a welcoming
place for the whole town. Play straight in your browser, with no installation or
account needed.

## A little clinic, a whole town of adventures

- **Meet pets with personality.** Care for dogs, cats, birds, rabbits, hamsters,
  gerbils and goldfish, with named owners and a variety of breeds and colours.
- **Be a pet detective.** Rotate around animals in 3D, listen to heartbeats,
  examine ears, look at X-rays and piece together clues. Routine checkups and
  vaccinations have their own guided visits, and fish get special water checks.
- **Practise a gentle touch.** Wrap bandages, spread cream, brush fur and try
  other hands-on care activities, each suited to its tool. Friendly prompts help
  players try again when something doesn't go to plan.
- **Watch Hookville come alive.** Follow families from their homes to the clinic
  and back, explore a park with ducks and pet activities, and watch police and
  firefighters reunite lost pets with their owners. Sunshine, brief showers and
  rescue stories bring variety to town life.
- **Build a clinic to be proud of.** Earn happy hearts and in-game coins through
  caring for animals. Spend those coins on rooms, equipment, decorations and
  waiting-room comforts, or create a pet playground with climbing trees, an
  aviary, a tiny rollercoaster and a Ferris wheel.

## For parents

The game invites children to notice clues, make caring choices and plan how to
spend their rewards. Large, rounded text and clear prompts support reading;
sound is optional, and care activities allow retries without hurting the pet.
Younger players may enjoy reading the visit stories with an adult.

The tone is gentle and cartoon-like. Some stories include lost pets, non-graphic
road accidents or house fires with rescue scenes; every pet recovers, with no
blood or animal deaths. The care is simplified storybook play, rather than
instructions for treating real animals.

Progress saves automatically in the current browser. Use the same browser and
device to continue your clinic; clearing site data removes that saved progress.
There is no account or cloud save.

## About the project

TypeScript, Vite, and Three.js run the game. Original Blender models are exported
as GLB; Nginx serves the finished static build. There is no game server or account
requirement. The [master game design](docs/game-design.md) is authoritative for
the game loop, current features, and future direction. See [asset credits](docs/assets.md)
for provenance and licenses. Agents and contributors should start with
[AGENTS.md](AGENTS.md) and the [design change checklist](.agents/design-change-checklist.md).

## Hookville — v2

Hookville’s police and fire crews automatically help lost pets, perform ladder
rescues, and extinguish occasional house fires safely. Choose **Town news** for
station cameras and **Watch rescue**; rescued pets become real clinic patients.
Enable sound to hear the engine’s siren.

Choose **Hookville** in the clinic navigation to browse the town. Drag to orbit,
right-drag, use the keyboard arrow keys or the arrow buttons to pan, and
pinch/scroll or use +/− to zoom. Hover or tap people and animals to see their
names, or a home to identify its family; the household directory also focuses the
camera. **Visit Louise’s office** returns to the waiting room.

Hookville has **16 distinct houses/flats and 18 named customers**, with gardens,
kennels, walks/chats, park visits, and traffic with coral hatchbacks, blue estates,
mint pickups and plum delivery vans. High Street connects winding
Willow Crescent and Orchard Lane. Lampposts and occasional hydrants give dogs
places to sniff; male dogs sometimes lift a leg. On outdoor walks, dogs may also
stop for a poo and their owners pick it up before continuing. These routines
never happen in the clinic and resume safely after a reload.
Shared flats show both families on hover/tap.
Reception is the actual town clinic viewed close up: the same families walk
through its doorway, wait inside, leave after care and return home. Pets along
for company follow their owner inside and wait nearby, including when the
patient is a smaller pet and the accompanying animal is a dog. Use
**Follow [owner]** in a home's panel to find someone on their journey.
If the clinic is full, families waiting outside eventually say they will come
back later and continue their day. Their care needs stay saved; they retry later
when there is room. Families already inside keep their places, with no penalty
for taking your time over care.
Families travel to the clinic for scheduled care, fevers, and occasional
recoverable road accidents, then head home after treatment. **Around Hookville**
shows recent happenings; **Find [owner]** locates the family. Healthy checkups
finish without unnecessary treatment. Town journeys, doorway movement, queue, and incident state
save with your clinic progress; reloading restarts an unfinished examination
without repeating rewards. The thermometer, cooling pad, and fixed care notebook
support the expanded visits. The notebook switches between **Care notes** and
**Key clues**; new notes appear first and older observations scroll within the
notebook without moving the page. See the
[authoritative v2 plan](docs/game-design.md#version-2--hookville-delivery-plan).

## Expand the clinic

In **Clinic shop**, buy **Room for more paws** to add a customer lounge, then
**Pet playground** for an adjoining playroom. Capacity grows from 4 to 6 to 8.
The room buttons beneath the scene show each area or the whole clinic.

Hookville also fits the window: **Homes** pages through the household directory, **Home info** shows the selected family, and **Town news** pages through updates. **Back to the clinic** stays beside the map.

The office fits the browser window: bottom navigation stays visible, with two patients per page and a **While you wait** tab for paged activities. The larger playground stays inside the clinic grounds and offers a purchasable **Pet rollercoaster** and **Pet Ferris wheel**. Pets queue and ride in moving cars/cabins; a called rider finishes its lap before getting out.

Hover or tap people, pets and attractions in the clinic for a little bubble
above their head, following them as they move. It disappears after five seconds
and leaves the patient menu visible. Names are bold and messages easy to read.
People speak in bubbles pointing to their mouths; pets think in fluffy clouds
and only make animal noises when replying. Pets and owners also share reactions
while playing, eating, walking and taking part in Hookville's rescue stories.
Every named pet and owner has at least five individual message variants for
each action or feeling.

Owners check in once on arrival, then stay at their waiting seat or game table until called. Buy books for seated reading and a
board-game table for the lounge. The playground includes a toy corner; add a
scratching post, exercise wheel, or merry-go-round to watch suitable pets queue
and take turns. Fever and broken-bone patients rest beside their owners. Calling
a pet brings it back, then its owner walks it to the desk. Louise leads them
through the door into the furnished examination room before close-up care begins; **Cancel call** lets it resume waiting.
The included examination room has the same table, mat and furnishings in both
views; **Exam room** focuses it from reception. Purchases and ordinary activity/queue
state save with clinic progress. Cancelled or stopped visits return through the
room’s door, and Louise walks back to reception.

After buying **Pet playground**, the shop offers a **Play garden extension** with six reserved spaces for a treat dispenser, water dispenser, bouncy toy box, yarn corner, bird aviary and friendly play tree. Purchase each activity separately; **Play garden** focuses the new wing. Healthy birds fly, cats climb, and both share the tree peacefully. Dispenser refills are included.

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
ghcr.io/dbsanfte/vet-game:<full-commit-sha>
ghcr.io/dbsanfte/vet-game:latest
```

Publishing uses the repository's `GITHUB_TOKEN` with `packages: write`; no separate
registry secret is needed. The repository is
[dbsanfte/louise-vet](https://github.com/dbsanfte/louise-vet). The container package
keeps its existing `vet-game` name across repository renames, matching the build,
browser-test image and installed server deployment helper.

Successful main runs also deploy to **https://louise.vet/** using the dedicated
`louise-vet-eqvm` runner on the Ubuntu server. Four browser-test shards check the
same built image before publication and rollout. The server imports that tested
artifact into its single-node k3s cluster, and Traefik serves it with an automatically
renewed Let's Encrypt certificate. A final GitHub-hosted check verifies public HTTPS
and the exact deployed revision. Pull requests do not deploy.

See [production hosting](deploy/README.md) for DNS, runner setup, health checks,
rollback and recovery. `/version.json` identifies the deployed commit. The game
keeps browser-local saves; localhost progress does not transfer to the new domain.

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
instead of `--all` to rebuild only anatomy and instruments, `--pets` for the eleven dog/cat/bird varieties and bird skeleton, `--town` for Hookville scenery, `--vehicles` for its four ordinary traffic models, `--street` for lampposts, hydrants and dog-walk cleanup props, `--park` for its pet park and ducks, `--emergencies` for police/fire stations, engine, ladder and responder kits, `--leisure` for modular clinic rooms and amusements, `--room` for the connected examination room, or omit scope flags
to rebuild only the clinic and animated characters. A full rebuild takes several
minutes. `BLENDER_PROJECT_ROOT` can direct output into a separate directory.
This builds from the Python authoring script, so it does not need to open a source
file made by a newer desktop Blender version. It replaces the generated GLBs and
the Blender source files; rebuild the web container afterwards to serve them.
All people and pets include looping `Idle` and `Walk` clips. The fish uses its
walk clip for swimming, with the bowl remaining still.

## Interactive examinations

The master design describes [examination and care](docs/game-design.md#5-examination-and-care-mechanics),
[controls](docs/game-design.md#6-interface-controls-and-accessibility), and the
[current patients](docs/game-design.md#7-current-case-catalogue). Keep gameplay
rules there so setup instructions and product design do not drift apart.

After placing the correct care tool, read its activity card and choose **Start when ready**. Spread cream, follow bandage arrows, make comb/brush strokes, aim drops, ease a splinter out, steady a cooling pad, control vaccine pressure or pour water. **Finish care** confirms a successful activity. **Cancel care activity** returns to placement; **Stop visit** returns to the office without a reward. Sliders support touch and keyboard arrows, and cream/wrap steps have individual buttons.
