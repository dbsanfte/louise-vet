# Game assets

## Original Blender models

The twelve clinic and character models in `public/models/` are original assets created for this
project with Blender through Blender MCP. Their editable source is
`assets/blender/louises-vet-office.blend`; the reproducible authoring script is
`scripts/create-blender-assets.py`. They are not downloaded marketplace models.
Louise's model uses her long light-brown hair, pink headband, and a mint vet coat
as recognisable character details.

The three customer models include a man and two women with distinct hair,
clothes, and skin tones. Each authored owner keeps a consistent model. Louise,
customers, and all six pets have original transform-rig animations exported as
looping `Idle`, `Walk`, `Sit`, `Read`, and `Play` clips. Human seated poses use thigh/knee joints; reading and game play animate arms, and pet play animates front paws. The browser blends between these clips as
customers arrive and stop; fish animate their fins and tail. Idle clips include
breathing, head turns, blinking, and tail motion where appropriate. The human
models additionally have layered eyes, cheeks/chins, ears, brows, shaped hands,
thumbs and clothing details. Their original rigs include moving elbows, knees,
ankles and shoulder counter-rotation. Static details are joined by material and
rig parent to control draw calls; no external meshes or motion-capture data are used.

## Examination models and fur

The 33 additional GLBs in `public/models/examination/` are original models authored
with headless Blender by `scripts/create-examination-assets.py`. Editable source
is `assets/blender/examination.blend` (compressed native Blender format). They
include six complete species skeletons plus fractured rabbit, dog, and cat variants, two ear
canals, six healthy/tartar/cavity mouth variants, and sixteen instruments, including the v2 thermometer and cooling pad. The
fracture uses separate displaced bone geometry; tooth cavities use a boolean
crater with dark dentine, and tartar/wax/swelling are additional meshes. Anatomy
is simplified to fit the game's stylised animals and is not a clinical reference.

`src/fur.ts` creates original curved fibre colour and bump textures and short,
softly fading surface fuzz on the actual pet meshes, with a matte, warm sheen.
The textures are procedural canvas drawings; coat colours and markings come
from the original model materials. Skin findings (including splinters) are attached to those
surfaces. `src/examination.ts` renders live optical close-ups and the underlying
3D anatomy from the current camera angle. No external textures or stock medical
images are used.

`src/fishbowl.ts` supplies an original translucent water volume fitted to the
Blender bowl's base and rim, with clear/cloudy colours and tool-aware contact.
Optical tools continue to reach the fish through the water. No external water
textures or assets are used.

## Louise's portrait

`public/images/louise-portrait.png` was generated with Codex's built-in image
generation tool, using the family-provided photo as a reference. The reference
photograph is not included in the repository or shipped in the game.

Final prompt:

> Use case: stylized-concept. Asset type: square character portrait for a cosy
> browser game called Louise's Vet Office. The reference photo shows the user's
> daughter Louise; make the character recognisably resemble this same child,
> preserving her natural facial features, long straight light brown/dark blonde
> hair, blue-grey eyes, pink headband and fair skin. Render as a polished, soft,
> charming 3D storybook game character, rounded forms, gentle proportions, not
> photorealistic. Head and shoulders, facing slightly to the viewer's right with a
> small warm smile, wearing a mint green veterinarian coat over a pastel pink top,
> tiny paw badge and a stethoscope. No drink or objects from the original photo.
> Background is plain warm cream #f7f5ee; centered portrait with comfortable margin,
> complete head and headband visible. Soft warm light, matte clay-like materials.
> No text, no watermark, no border. This is a wholesome personalised game for the child.

## Fonts, icons, and sound

[Nunito](https://fontsource.org/fonts/nunito) is bundled locally through Fontsource
under the SIL Open Font License. Its notice ships at `/licenses/nunito.txt`. There are no external font requests.

The inline interface icons and pet silhouettes are original SVG code in
`src/icons.ts`. Optional sounds are original synthesised chimes and double heartbeats in `src/audio.ts`;
no music or third-party audio recordings are currently used.

Three.js is distributed under the MIT License; its copyright and license notice
ship at `/licenses/three.txt`.

## Hookville exteriors — v2

Twenty original Blender exports in `public/models/town/` provide the neighbourhood
(roads, pavements, crossings, gardens, fences, park, pond, trees and benches),
sixteen geometrically distinct houses/flats, clinic canopy/sign, kennel, and car. Their reproducible authoring script
is `scripts/create-town-assets.py`; the shared road/lot plan is
`src/town-layout.json`, authored by `scripts/design-town-layout.py`. Editable source is
`assets/blender/hookville.blend`. Static scenery is joined by material to reduce
draw calls. Pavements are continuous joined strips with shared corner vertices and rounded branch junctions, generated from the navigation graph. These are original project models, with no third-party asset license.

Kennels have open doorways and interior beds, with a separate instance for each
dog. Town residents reuse the existing animated customer/pet models. Garden roaming,
kennel rest poses, walking routes and traffic are driven by `src/town.ts` and
`src/town-simulation.ts`; the chat and sleeping-bubble textures are original canvas drawings.
The v2 thermometer and cooling pad are authored in the examination generator and
saved in `assets/blender/examination.blend` alongside the existing instruments.

## Modular clinic and waiting amusements

Twenty original Blender exports in `public/models/clinic/` provide the customer
lounge, playground, future-room door, extra seats, book trolley, held open book,
board-game table/chairs, scratching post, exercise wheel, carousel, toy corner, pet rollercoaster and Ferris wheel.
`scripts/create-clinic-leisure.py` reproduces them and the editable native source
`assets/blender/clinic-leisure.blend`; use the build driver's `--leisure` scope.
These are original project models with no third-party asset license.

The room/station layout is `src/clinic-layout.json`. The original clinic model
has a connecting doorway and cutaway partitions. Town landscaping leaves the
expanded footprint clear. The wheel and carousel export named rotor groups for
runtime motion, separate from their stationary bases. The coaster exports `CoasterCar`; the Ferris wheel exports `FerrisRotor` and four `FerrisCabin` groups. Runtime cabin/car poses and riding pets share `src/pet-rides.ts`; cabins remain level. The playground generator reads its enlarged dimensions and queue positions from the shared room plan. Customers hold a cloned
open-book prop while reading. The existing character source/exports include the
new seated, reading, and play clips alongside preserved walking and idle clips.

The clinic leisure source also includes the original play-garden extension, treat and water dispensers, bouncy toy box, yarn corner, bird aviary and spiral play tree. Static details are batched by parent and material; named moving groups animate flows, balls and the aviary swing. The three original bird breed exports additionally carry a looping `Fly` clip with spreading, flapping wings and tucked feet, authored in `scripts/create-pet-models.py`. No external assets were added.

## Connected examination room

`public/models/clinic/examination-room.glb` is an original Blender model authored
by `scripts/create-exam-room.py`, with editable source in
`assets/blender/examination-room.blend`. The build driver’s `--room` scope rebuilds
it independently. It includes a cutaway tiled room, sink, supply cabinet, towels,
care sign and the named `ExamDoorHinge` pivot for its opening door. Reception and
the close-up scene both reuse this room and the existing `table.glb`, including
its mat. The base clinic generator provides the connecting wall opening and door
frame. All geometry and materials are original, with no third-party asset license.

## Articulated dog, cat, and bird varieties

Eleven original exports in `public/models/pets/` provide golden retriever,
wire-haired terrier, chestnut spaniel, border collie, silver British shorthair, ginger Maine Coon,
tuxedo shorthair, Siamese, blue budgie, grey cockatiel, and golden canary models.
`scripts/create-pet-models.py` authors them using the base generator's rig/export
helpers, plus `public/models/examination/skeleton-bird.glb`. Editable source is
`assets/blender/pet-varieties.blend`; rebuild with
`python3 scripts/blender-build.py --headless --pets` (also included in `--all`).
The catalogue and named-pet mapping live in `src/pet-looks.json`. Existing base
species models remain available; the game selects the new variants by identity.

All geometry, coat markings, materials, looping clips, avian anatomy, and
the runtime bird perches are original project work, with no downloaded assets or
third-party asset license. Four-legged breeds have hip/knee chains, facial details,
shaped tails and breed-specific ears/markings; birds have articulated wings, feet,
head and tail. Static details are merged by material and rig parent to keep draw
calls manageable. Clinical body/paw meshes and anatomical markers remain separate.
The bird skeleton is a simplified storybook model, not a veterinary reference.

## Hookville Pet Park

`public/models/town/park.glb` and `duck.glb` are original project models from
`scripts/create-park-assets.py`, with editable source
`assets/blender/hookville-park.blend`. Rebuild with
`python3 scripts/blender-build.py --headless --park`; `--all` includes this scope.
`src/park-layout.json` supplies bench, activity and pond positions to both Blender
and the simulation. The neighbourhood source/export removes its older placeholder
pond and benches to leave the new park footprint clear.

The park includes slatted benches, a curved stone-edged pond with reeds and a
bubbler, paths, an agility hoop, scratching log, butterfly garden, small-pet
hoop tunnel/enclosure, bird toy perch and welcome arch. The original duck model
keeps separate wing parts for runtime strokes; adult and duckling instances swim
in the pond. Ripples, the animated tennis ball and butterfly are original Three.js
geometry in `src/park-scenery.ts`. No downloaded assets, textures or additional
third-party licenses are involved.

The illustrated care activities in `src/care-skill-view.ts` and `src/style.css` use original CSS shapes and the existing project SVG icons for patches, wraps, fur, teeth, guides and the practice bowl. No downloaded images, fonts or audio were added.

## Hookville emergency services

Six original Blender exports in `public/models/town/` add `fire-station.glb`,
`police-station.glb`, `fire-engine.glb`, `rescue-ladder.glb`, `firefighter-kit.glb`
and `police-kit.glb`. The source is `assets/blender/hookville-emergencies.blend`,
authored by `scripts/create-emergency-assets.py`; reproduce with
`python3 scripts/blender-build.py --headless --emergencies` (also in `--all`).
Stations include original signs, garage/window details and aprons. The engine
has cab glazing, wheels, equipment lockers, reflective stripes and beacons; its
ladder is a separate reusable export. Responder kits provide caps/helmets, badges,
reflective bands and breathing packs over the existing animated human models.

`src/emergency-scenery.ts` provides original instanced fire/smoke, water particles,
beacons, visible outer rescue branches, station-label canvas textures and runtime ladder/climbing poses. People
reuse the project’s walking, idle and play clips; birds use their authored flight
clips. `src/audio.ts` synthesizes the optional alternating siren. Everything is
original project work; no external textures, recordings or additional licenses.

## Hookville traffic variety

Four original Blender exports replace the repeated yellow car in ordinary
traffic: `public/models/town/car-compact.glb` (coral hatchback), `car-estate.glb`
(blue estate), `car-pickup.glb` (mint pickup), and `car-van.glb` (plum delivery van).
`scripts/create-vehicle-assets.py` reproduces them and the editable
`assets/blender/hookville-vehicles.blend`; run
`python3 scripts/blender-build.py --headless --vehicles`, also included in `--all`.
The older `car.glb` remains an unused legacy export of the town generator.

Geometry, paints and parcel marking are original project work with no external
assets, logos or licenses. Bodies have different roof/cabin/load-space shapes,
opaque stylized glazing, lamps, mirrors, bumpers and wheel details. Four named
wheel pivots per export preserve their radius in GLB extras; `src/traffic-vehicle.ts`
rolls these with actual travel. Static details are batched by parent and material.

## Hookville street details and dog walks

Four original Blender exports, `lamppost.glb`, `hydrant.glb`, `dog-poo.glb` and
`cleanup-bag.glb` under `public/models/town/`, are authored by
`scripts/create-street-assets.py`. Editable source is
`assets/blender/hookville-street-details.blend`; reproduce with
`python3 scripts/blender-build.py --headless --street`, also included in `--all`.
The shared authored placements in `src/street-details.json` locate seventeen
curved lamps and six red hydrants around the existing roads.

Warm bulb materials, rounded cleanup props, the brief wee arc in
`src/street-scenery.ts` and sniff/leg-lift/owner pickup poses in `src/town.ts` are
original project work. Poses extend the existing articulated character clips.
There are no downloaded assets, additional lights or new third-party licenses.

## Hookville surface finish, weather and courtyard

`src/town-surfaces.ts` creates original repeating asphalt aggregate, paving slabs,
grass blades, wood grain, roof tiles and plaster textures in small canvas maps.
World-scale projected UVs and subtle bump/roughness keep them consistent across
curved scenery. Existing Blender vehicle materials receive runtime clearcoat and
polished glazing, with Three.js environment reflections. `src/weather-scenery.ts`
provides bounded original rain streaks; weather also changes the existing light
and ground materials. No downloaded textures, HDRIs, recordings or new licenses.

`public/models/town/shade-tree.glb` is an original Blender shade tree, included in
`scripts/create-town-assets.py` and `assets/blender/hookville.blend`; authored
placements live in `src/shade-trees.json`. Rebuild with `--headless --town`.

Nine new clinic exports in `public/models/clinic/` are `sun-courtyard.glb`,
`puzzle-table.glb`, `bubbles.glb`, `cat-nook.glb`, `bird-chimes.glb`,
`flower-border.glb`, `bunting.glb`, `cosy-rug.glb` and `wall-art.glb`.
They are original Blender geometry from `scripts/create-clinic-leisure.py`, with
editable source `assets/blender/clinic-leisure.blend`; rebuild with
`--headless --leisure`. The playground has a connecting courtyard gate. Named
Bubble0–Bubble6 and Chimes groups retain runtime motion, with species poses shared
by `src/clinic-enrichment.ts` and the simulation. No third-party artwork or audio.
