# Game assets

## Original Blender models

All ten runtime models in `public/models/` are original assets created for this
project with Blender through Blender MCP. Their editable source is
`assets/blender/louises-vet-office.blend`; the reproducible authoring script is
`scripts/create-blender-assets.py`. They are not downloaded marketplace models.
Louise's model uses her long light-brown hair, pink headband, and a mint vet coat
as recognisable character details.

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

DM Sans and Fraunces are bundled locally through Fontsource under the SIL Open
Font License. Their notices ship at `/licenses/dm-sans.txt` and
`/licenses/fraunces.txt`. There are no external font requests.

The inline interface icons and pet silhouettes are original SVG code in
`src/icons.ts`. Optional sounds are original synthesised chimes in `src/audio.ts`;
no music or third-party audio recordings are currently used.

Three.js is distributed under the MIT License; its copyright and license notice
ship at `/licenses/three.txt`.
