# Exporting

The studio's **Export** button (toolbar, bottom) opens the export dialog with three
tabs: **SVG**, **Raster PNG**, and **Project**. Everything is generated client-side by
the framework-free core in `app/core/export/` — no server, no uploads.

## SVG

Physical-size SVG: `width`/`height` in real millimeters plus a viewBox, so laser
software imports at true scale. Pick a target program preset:

| Program | What changes |
| --- | --- |
| **LightBurn** | Layers preserved as named top-level groups — LightBurn maps these to assignable layers. |
| **xTool Creative Space** | Layers merged into a single group; XCS prefers a simple structure. |
| **LaserGRBL** | Merged, and every stroke/fill forced to black — GRBL treats all colors as one engrave. |
| **Generic** | Preserved as-is. |

Options: **flatten shapes** (rect/ellipse/polygon → `<path>`), **embed metadata**
(a `<!-- laser-gen … -->` comment with the rotary object diameter, circumference, and
a program-specific tip), and the **layer mode** override. The dialog shows live
warnings (e.g. live text needs the font installed in LightBurn; raster images are
embedded as data URIs) and a file-size estimate.

## Raster PNG

The flat artboard rendered at **254 / 300 / 600 DPI** (pixel dimensions are
`mmToPx(size, dpi)`, shown in the dialog) with a white background (laser raster
convention) or transparent. The DPI is embedded as a PNG **pHYs chunk**
(pixels-per-meter, CRC recomputed — see `setPngDpi` in `app/core/export/png.ts`), so
programs that honor PNG resolution import at the correct physical size.

## Project

Downloads the working document as `.lasergen.json` (the M6 library project format —
re-importable via the Library page), plus a "Save copy to library" shortcut.

## Filenames and the rotary reminder

Exports are named `lasergen_<vessel>_<project>_<yyyy-mm-dd>.<ext>` (slugified — see
`buildFilename`). After every export the dialog repeats the one number you must not
forget: the **object diameter** (mm) to enter in your laser software's rotary setup —
the same value embedded in the SVG metadata comment.
