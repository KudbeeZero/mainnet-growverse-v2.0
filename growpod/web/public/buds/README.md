# Photoreal bud hero images

Drop strain bud photos/renders here to make them the **showcase bud** on the strain
catalog (and, once wired, the grow-pod "view bud"). When a strain has no photo, the
app automatically renders the procedural **3D bud** instead — so this folder is purely
additive and never required.

## How to add one

1. Add the image file here, named by the strain slug + stage:
   - `<strain-slug>-harvest.webp` — the mature, frosted "money shot" (preferred)
   - `<strain-slug>-flower.webp` — optional mid-flower variant
2. Register it in `src/lib/budPhotos.ts`:
   ```ts
   const BUD_PHOTOS = {
     "blue-dream": { harvest: "/buds/blue-dream-harvest.webp" },
   };
   ```
   That's it — the catalog hero switches from 3D to the photo for that strain.

## Recommended format

- **Square-ish, ~1024×1024** (the hero frame is square). Bud centered, dark/neutral
  background reads best against the app's dark UI.
- **`.webp`** (or `.jpg`) — keep each under ~250 KB so the page stays fast.

## ⚠️ Licensing — read before adding anything

GROWv2 is a **monetized** app. Only add images we **own** or are **commercially
licensed** to use:

- ✅ Our own photography or 3D renders.
- ✅ A stock/asset pack with a commercial license.
- ✅ AI renders from a service whose terms grant commercial rights to the output.
- ❌ **Never** seed-bank catalog photos, Google-image results, or any random web
  image. Those are someone else's copyright and will get the app pulled.

The shipped photoreal renders (Blue Dream, Gorilla Glue #4, Wedding Cake, and the
pod/cinematic assets) are owner-generated and covered by a Certificate of
Authorization — see `growpod/docs/licenses/` for the rights record.
