# Wrap math: unwrapping cylinders and cones

Laser engraving a tumbler on a rotary attachment means engraving on a **curved surface**.
The design tools, however, work on a **flat canvas**. Wrap math is the bidirectional
mapping between the two — and getting it right is what makes text come out un-stretched
and circles come out round.

## The core idea

Cut the vessel's lateral surface along a vertical seam and lay it flat. That flat shape is
the editor canvas. Every point on the canvas corresponds to exactly one point on the
vessel surface, and (for developable surfaces like cylinders and cones) **distances are
preserved** — the mapping is an isometry, so nothing distorts.

## Cylinder

For a cylinder of diameter `d` and height `h`:

- Unwrapped canvas is a rectangle of **width `π·d`** (the circumference) and **height `h`**.
- Horizontal canvas coordinate `x` maps to rotation angle `θ = x / r` (radians), where
  `r = d / 2`.
- Vertical coordinate maps 1:1 to height.

That's the whole story for straight-walled cups: a rectangle, `π·d × h` mm.

## Cone (tapered tumbler)

Most tumblers taper: the diameter at the rim differs from the diameter at the base.
Geometrically, a cone frustum unwraps to an **annular sector** — a "Pac-Man" slice of a
ring. laser-gen does **not** present that sector. Instead it uses the
**reference-radius rotary model**, the same model LightBurn's rotary setup uses
(`app/core/geometry/unwrap.ts`):

- The artboard stays a **rectangle**: width = circumference at the widest engraved row
  (2π·rRef), height = the engrave window.
- Horizontal position maps to rotation angle through a single **reference radius**:
  `θ = x / rRef`, where `rRef` defaults to the radius at the middle of the engrave
  zone (which minimizes the worst-case distortion at both ends of the taper).
- Vertical position maps 1:1, offset so artboard `y = 0` is the bottom of the engrave
  zone.

The consequence is real and physical: a row whose true radius `r(y)` differs from
`rRef` is engraved **stretched** (`r(y) < rRef`) or **compressed** (`r(y) > rRef`)
horizontally by the factor `rRef / r(y)` — see `angularDistortion` in the same module.
That is exactly what the rotary does on the machine, so what you see on the artboard is
what burns. The editor uses the factor for its taper distortion guides, and the 3D
preview maps the texture with true per-row radii.

## Why this matters for engraving

- **Rotary attachments** rotate the vessel under a fixed laser. The machine is told an
  **object diameter**; laser-gen's export dialog computes it (the diameter at the
  middle of the engrave zone) and embeds it in the SVG metadata and the rotary-setup
  printout, so the wrap comes out at the right width.
- **Seams**: the wrap's left and right edges meet. laser-gen shows seam guides, and
  elements crossing an edge wrap automatically so continuous patterns stay continuous.
- **Taper distortion** is not a display bug: on a tapered cup the same millimeters of
  artboard span more degrees of rotation near the narrow end. Designing on the
  rectified artboard with the reference-radius model matches the machine's behavior
  exactly.

## Units

Everything is real **millimeters** end to end. Canvas, export, and machine coordinates all
share the same unit, so a 90 mm design is 90 mm on the cup.
