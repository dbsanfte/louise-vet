# Agent instructions

These instructions apply throughout this repository. Louise's Vet Office is a
browser game for Louise and players aged 7+. Read the
[master game design](docs/game-design.md) before changing gameplay, content, art,
or player-facing text. Read [README.md](README.md) for setup and verification,
and [asset credits](docs/assets.md) before adding or regenerating assets.

## Authority and repository etiquette

- Follow the user's current instructions and existing session authorization.
  This file governs repository workflow; the master game design governs the
  product. Code and tests show what is implemented. If these disagree, identify
  the discrepancy and reconcile it within the authorized task. Do not silently
  replace intended design with an implementation accident.
- Inspect the working tree before editing. Preserve unrelated user changes and
  keep patches focused. Do not reset, clean, rewrite history, or overwrite
  authored assets just to obtain a clean workspace.
- Make routine, reversible implementation decisions and continue authorized
  work. Ask only when a material product decision or missing authorization
  requires the user's input. Credentials alone do not authorize publication or
  messages to other people; follow the authorization in the conversation.
- Use existing TypeScript, Three.js, Vite, Blender, and container conventions.
  Prefer the smallest cohesive change. Add dependencies only for a concrete need.
- Keep private family references, credentials, `.env` files, local container
  overrides, and Codex state/transcripts out of Git and published assets. The
  generated Louise portrait is an approved game asset; the reference photograph
  is not. Preserve the host mounts that retain chats and login state through
  devcontainer rebuilds.
- Own the processes you start and stop temporary test servers afterwards. Do not
  stop the user's devcontainer or use Compose `--remove-orphans` here: the dev
  service may be part of a separate Compose configuration.
- Report what changed, verification, and remaining limitations. Do not claim a
  build, test, asset inspection, push, or deployment succeeded without evidence.
  Publishing a container image is distinct from deploying a live site.

## Master game design: mandatory maintenance

`docs/game-design.md` is the single authoritative game design document. Maintain
it as a cohesive description of the player's experience, with explicit boundaries
between today's game and its intended future. A contributor must be able to
understand the product without reading our chats.

1. **Read before changing.** Find the affected sections and feature IDs. Establish
   how new work joins the office → examination → care → reward → improvement loop.
2. **Update in the same change.** Changes to behavior, controls, cases, rewards,
   progression, saving, audience/tone, visual direction, or approved scope must
   update the relevant master sections and feature register. Documentation is
   part of completing the feature. A bug fix restoring documented behavior needs
   a consistency review, but no artificial edit if the contract and limitations
   remain accurate. The same applies to purely internal refactors.
3. **Preserve the structure.** Keep the numbered major sections and stable links:
   authority/status; vision; setting/cast; visit loop; examination/care;
   interface/accessibility; cases; economy/progression; art/audio; platform/save;
   feature register/milestones; acceptance criteria; open decisions/history;
   implementation map. Add subsections in the appropriate place. Update contents
   and incoming links if a heading must change. Do not append a competing spec.
4. **Use defined statuses.** Every feature-register row needs a stable ID, status,
   explicit scope/boundary, and evidence or completion target. Never mark planned
   work implemented because a design, placeholder, model, or test stub exists.
   A partial feature must state what works and what remains. Exploratory ideas
   are not commitments.
5. **Describe complete behavior.** Cover player purpose, entry/prerequisites,
   actions/feedback, success, retry/exit paths, rewards/save effects, desktop/touch
   access, and limitations. State how vaccination, Stop visit, and unhurried
   reading are affected. Use the [change checklist](.agents/design-change-checklist.md)
   as a prompt, not a second design document.
6. **Keep one answer per question.** Revise canonical sections instead of adding
   contradictory paragraphs. Reconcile the loop, case catalogue, economy, feature
   status, and acceptance criteria when a change crosses sections. Label current
   tuning values and update them alongside code. Keep formulas in the economy
   section, setup in README, and provenance/licenses in `docs/assets.md`; link
   instead of copying them.
7. **Record decisions, not transcripts.** Record substantial product decisions and
   rationale in the short decision history. Keep unresolved decisions explicit;
   supersede old decisions clearly when direction changes. Git holds edit history.
   The design must not become a changelog, backlog dump, CI log, or chat archive.
8. **Verify before marking complete.** Compare updated design to source and
   meaningful checks. Link source/tests for implemented scope. Check local links
   and formatting. State limitations; do not conceal them by weakening tests or
   lowering the documented experience.

## Implementation and validation

- Keep rules/data in `src/game.ts`, UI flow in `src/main.ts`, and scene/tool work
  in the existing rendering modules. See the design's implementation map.
- Preserve useful feedback for tools and anatomical targets, visible primary
  actions, keyboard/body-guide alternatives, touch support, and readable language.
  Do not add real veterinary dosages or procedures.
- Check graphics changes on the software-rendered browser path as well as normal
  graphics. Preserve responsive timing, camera/tool interaction, loading, and
  resource cleanup. Do not mask regressions with blanket timeout increases.
- Blender generators overwrite their generated `.blend` and GLB outputs. Inspect
  existing edits first; use a separate output directory when needed. Keep scripts,
  intended editable sources, and exports consistent. Preserve `Idle`/`Walk` clips;
  inspect appearance and animation when models change. Record origins and license
  notices in `docs/assets.md`.
- Run checks proportional to the change. Documentation changes need formatting,
  link, and factual consistency checks, not new gameplay tests or a container
  rebuild. Behavior changes need meaningful unit/browser coverage and the required
  build/check workflow as appropriate.
- `npm run check` checks formatting, typechecks/builds, and runs unit/browser tests.
  Browser tests need the built game; `PLAYWRIGHT_BASE_URL` can target a running
  production container. README owns full commands and CI details. Explain any
  unresolved failing required check rather than bypassing it.

The [`.agents` directory](.agents/README.md) contains supporting workflow material.
It does not replace this file or establish another product authority.

## Local preview and deployment

Keep the local game available as well as the public release. Before any push,
workflow dispatch, or rerun that starts CI/CD, stand up the local web container
with the latest runtime changes and verify it. After changing game code, styles,
dependencies, or generated assets, rebuild and start it from this checkout:

```sh
docker compose up --build --detach --wait web
```

- Confirm `http://localhost:8080/healthz` returns `ok` and check the changed game
  behavior in the browser before starting CI/CD. Inside the devcontainer, use
  `http://web:8080` to reach that same web container; the user opens
  `http://localhost:8080` on the host. Honor an existing `WEB_PORT` override.
- Run the relevant local checks against this fresh production container and fix
  failures before triggering delivery. A documentation-only update needs no
  rebuild when the running container already serves the unchanged game, but
  still confirm it is running before starting another pipeline.
- Leave the local web container running with the latest game when finishing a
  runtime-change task. A successful remote deployment does not replace this
  requirement. Preserve the user's devcontainer and other services; never use
  Compose `--remove-orphans`.

The delivery sequence is **local build and verification → GitHub Actions build
and tests → GHCR publication → server rollout → public HTTPS verification**.
Follow [the workflow](.github/workflows/ci.yml) and the
[production runbook](deploy/README.md) for current commands and recovery details:

- Pull requests run checks. Successful authorized `main` releases publish the
  exact tested image, tagged with its full commit SHA, and deploy that same image
  artifact through the dedicated `louise-vet-eqvm` runner, using the
  `louise-vet-deploy` label and `production` environment.
- The Ubuntu host `eqvm` (`192.168.50.100`) runs single-node **k3s**, Traefik and
  cert-manager. The root-owned `/usr/local/sbin/louise-deploy` helper imports the
  image, rolls out `louise-vet/web`, checks readiness, certificate and revision,
  and restores the preceding image on failure when one exists. Changes to this
  privileged helper need review and installation on the host; pushing its source
  does not update the installed helper. Preserve unrelated applications/runners.
- Follow the run through its final external check of `https://louise.vet/` and
  `/version.json`. Report the deployed revision and any remaining blocker. Image
  publication or healthy local pods alone do not establish a successful public
  release; do not bypass failing tests or certificate validation to claim one.
- DNS uses the apex ALIAS to `home.sanftenberg.net`, following the existing
  dynamic-DNS updater. Traefik/cert-manager provide HTTPS and certificate renewal.
  Diagnose DNS/ACME failures using the runbook; keep credentials out of Git and
  logs, and preserve the external SSH password file used during setup.
