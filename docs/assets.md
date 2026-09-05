# Game assets

## Original Blender models

All twelve runtime models in `public/models/` are original assets created for this
project with Blender through Blender MCP. Their editable source is
`assets/blender/louises-vet-office.blend`; the reproducible authoring script is
`scripts/create-blender-assets.py`. They are not downloaded marketplace models.
Louise's model uses her long light-brown hair, pink headband, and a mint vet coat
as recognisable character details.

The three customer models include a man and two women with distinct hair,
clothes, and skin tones. Each authored owner keeps a consistent model. Louise,
customers, and all six pets have original transform-rig animations exported as
looping `Idle` and `Walk` clips. The browser blends between these clips as
customers arrive and stop; fish animate their fins and tail. Idle clips include
breathing, head turns, blinking, and tail motion where appropriate.

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
`src/icons.ts`. Optional sounds are original synthesised chimes in `src/audio.ts`;
no music or third-party audio recordings are currently used.

Three.js is distributed under the MIT License; its copyright and license notice
ship at `/licenses/three.txt`.
