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

Most tumblers taper: diameter `d₁` at the rim and `d₂` at the base, over height `h`.
A cone frustum unwraps not to a rectangle but to an **annular sector** — a "Pac-Man"
slice of a ring:

- Slant height: `s = √(h² + ((d₁ − d₂)/2)²)`
- The frustum extends to a full cone with apex slant distance
  `L₁ = s · d₁ / (d₁ − d₂)` (rim side) and `L₂ = L₁ − s` (base side).
- Unwrapped, the rim becomes an arc of radius `L₁` and length `π·d₁`; the base becomes an
  arc of radius `L₂` and length `π·d₂`.
- Sector angle: `φ = π·d₁ / L₁` (radians) — equivalently `φ = (d₁ − d₂)/s · π`.

In the editor we present this sector **rectified to a rectangle** (width `π·d₁`, height `s`)
for usability, but every horizontal line of the design maps to an *arc*, not a straight
line. Features that care about true geometry (rotary export, 3D preview texture mapping)
use the sector coordinates; the rectified view is a presentation aid with visible
distortion guides near the narrow end.

## Why this matters for engraving

- **Rotary attachments** rotate the vessel under a fixed laser. The machine steps the
  rotary in degrees/steps-per-rotation; the design must be exactly `π·d` wide (cylinder)
  or the correct sector (cone) or the wrap will be stretched or compressed.
- **Seams**: the wrap's left and right edges meet. laser-gen shows seam guides and can
  duplicate edge content to help designs flow across the seam.
- **Distortion** on tapered vessels is real: a circle drawn on the rectified canvas prints
  as an ellipse-ish shape on the physical cup unless corrected. Correcting for this is a
  core feature of the M3 geometry work.

## Units

Everything is real **millimeters** end to end. Canvas, export, and machine coordinates all
share the same unit, so a 90 mm design is 90 mm on the cup.
