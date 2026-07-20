/**
 * GLB-backed vessel models for the 3D preview.
 *
 * Loads a GLB (CC-BY Sketchfab models in `public/models/`), finds the
 * engravable **body mesh** (`model.bodyMeshName`, else a heuristic: the
 * largest roughly-cylindrical mesh by vertex count), normalizes the model so
 * the body matches the vessel's `VesselProfile` in mm — per-axis scale maps
 * body height → profile height and body radius → profile max radius, and the
 * body axis is centered on x/z with the base at the profile's first y — then
 * bakes `cylindricalUVs` onto the body mesh so the shared artboard
 * CanvasTexture maps exactly like it does on the lathe geometry.
 *
 * Only the body mesh gets a new material (artboard texture); handle/lid
 * meshes keep their original GLB materials and textures. The parametric
 * lathe profile stays the source of truth for unwrap, artboard, and export —
 * the GLB is a preview-only skin, and the viewer falls back to the lathe
 * while the model loads or when loading fails.
 *
 * Lifetime: the previous model (geometries, materials, textures) is disposed
 * on profile change and on scope dispose.
 */

import { Box3, BufferAttribute, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import type { BufferGeometry, Material, Object3D, Texture } from 'three'
import { cylindricalUVs } from '~/core/geometry'
import type { VesselProfile } from '~/core/geometry'

export interface GlbVesselModel {
  /** Normalized model, in the same recentered frame as the lathe (y = 0 at mid-height). */
  group: Group
  /** Artboard-textured body material created by the loader (finish-adjustable). */
  bodyMaterial: MeshStandardMaterial
}

/** Texture slots disposed when unloading a model. */
const TEXTURE_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'] as const

/** Collect all meshes under a root object. */
function collectMeshes(root: Object3D): Mesh[] {
  const meshes: Mesh[] = []
  root.traverse((obj) => {
    if (obj instanceof Mesh) meshes.push(obj)
  })
  return meshes
}

/** World-space bounding box of a mesh (root must have updated world matrices). */
function meshBox(mesh: Mesh): Box3 {
  mesh.geometry.computeBoundingBox()
  const box = mesh.geometry.boundingBox?.clone() ?? new Box3()
  return box.applyMatrix4(mesh.matrixWorld)
}

/**
 * Heuristic body-mesh pick: the largest (by vertex count) mesh whose world
 * bounding box is roughly cylindrical — horizontal extents within 25% of
 * each other and a height of at least 40% of the larger one. Falls back to
 * the largest mesh overall (single-mesh models like the plain mug).
 */
function pickBodyMesh(meshes: Mesh[], preferredName?: string): Mesh | null {
  if (preferredName) {
    const named = meshes.find(m => m.name === preferredName)
    if (named) return named
  }
  const size = new Vector3()
  const scored = meshes.map((mesh) => {
    meshBox(mesh).getSize(size)
    const horizontal = Math.max(size.x, size.z)
    const cylindrical = horizontal > 0
      && Math.abs(size.x - size.z) / horizontal <= 0.25
      && size.y >= 0.4 * horizontal
    return { mesh, verts: mesh.geometry.attributes.position?.count ?? 0, cylindrical }
  })
  const pool = scored.filter(s => s.cylindrical)
  const best = (pool.length > 0 ? pool : scored).sort((a, b) => b.verts - a.verts)[0]
  return best?.mesh ?? null
}

/**
 * Axis center for a model range that may be skewed by a protrusion (e.g. a
 * handle baked into the body mesh): when the range is clearly one-sided, the
 * shorter side is mirrored to find the vessel axis.
 */
function symmetricCenter(min: number, max: number): number {
  const extent = max - min
  if (extent <= 0 || Math.abs(min + max) <= 0.1 * extent) return (min + max) / 2
  const half = Math.min(Math.abs(min), Math.abs(max))
  return min + max > 0 ? min + half : max - half
}

/** Dispose every geometry, material, and texture under a root object. */
function disposeObject(root: Object3D, extraMaterials: Material[] = []): void {
  const materials = new Set<Material>(extraMaterials)
  root.traverse((obj) => {
    if (obj instanceof Mesh) {
      ;(obj.geometry as BufferGeometry).dispose()
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const mat of mats) materials.add(mat)
    }
  })
  for (const mat of materials) {
    for (const slot of TEXTURE_SLOTS) {
      const tex = (mat as unknown as Record<string, Texture | null>)[slot]
      tex?.dispose()
    }
    mat.dispose()
  }
}

/**
 * Reactive GLB model for a vessel profile: (re)loads when `profile.model.url`
 * changes, `null` for purely parametric vessels or while loading.
 *
 * @param profile - Reactive vessel profile (e.g. from the vessel store).
 * @param texture - Shared artboard CanvasTexture applied to the body mesh.
 */
export function useGlbVessel(profile: Readonly<Ref<VesselProfile>>, texture: Texture) {
  const model = shallowRef<GlbVesselModel | null>(null)
  let loadToken = 0

  function unload(next: GlbVesselModel | null): void {
    const previous = model.value
    model.value = next
    if (previous) disposeObject(previous.group, [previous.bodyMaterial])
  }

  async function load(vessel: VesselProfile): Promise<void> {
    const ref = vessel.model
    const token = ++loadToken
    if (!ref) {
      unload(null)
      return
    }
    try {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
      const gltf = await new GLTFLoader().loadAsync(ref.url)
      if (token !== loadToken) {
        // A newer load superseded this one — drop the stale scene.
        disposeObject(gltf.scene)
        return
      }

      const wrapper = new Group()
      wrapper.add(gltf.scene)
      wrapper.updateWorldMatrix(true, true)

      const meshes = collectMeshes(gltf.scene)
      const bodyMesh = pickBodyMesh(meshes, ref.bodyMeshName)
      if (!bodyMesh) throw new Error(`no body mesh found in ${ref.url}`)

      // glTF is Y-up per spec (the loader already converts Z-up source data),
      // so no axis guessing here — just measure the body in world space.
      //
      // Normalize per axis so the body matches the profile's mm dimensions:
      // y scales body height → profile height; x/z scale the *smaller*
      // horizontal extent (the body radius without handle/lid protrusions) →
      // the profile's max radius. The non-uniform scale keeps the body
      // circular while making the engrave surface line up with the
      // lathe-driven overlays (seam bar, safe zone, laser sweep). Raw model
      // units are arbitrary (plain-mug: 0.150 tall; stanley: 3.52 tall as
      // loaded) — see the `model` comments in presets.ts.
      const bodyBox = meshBox(bodyMesh)
      const firstY = vessel.points[0]?.y ?? 0
      const lastY = vessel.points[vessel.points.length - 1]?.y ?? 0
      const midY = (firstY + lastY) / 2
      const modelHeight = Math.max(bodyBox.max.y - bodyBox.min.y, 1e-9)
      const modelRadius = Math.max(
        Math.min(bodyBox.max.x - bodyBox.min.x, bodyBox.max.z - bodyBox.min.z) / 2,
        1e-9,
      )
      let maxRadiusMm = 0
      for (const p of vessel.points) maxRadiusMm = Math.max(maxRadiusMm, p.r)
      const scaleY = (lastY - firstY) / modelHeight
      const scaleXZ = maxRadiusMm / modelRadius

      // Center the body axis on x/z (mirroring the shorter side when a
      // protrusion skews the range) and put the body base at y = firstY.
      wrapper.scale.set(scaleXZ, scaleY, scaleXZ)
      wrapper.position.set(
        -symmetricCenter(bodyBox.min.x, bodyBox.max.x) * scaleXZ,
        firstY - bodyBox.min.y * scaleY,
        -symmetricCenter(bodyBox.min.z, bodyBox.max.z) * scaleXZ,
      )
      wrapper.updateWorldMatrix(true, true)

      // Bake cylindrical UVs from world positions (y = mm above the base),
      // matching the lathe convention so the artboard texture aligns.
      const geometry = bodyMesh.geometry
      const positions = geometry.attributes.position
      if (!positions) throw new Error(`body mesh in ${ref.url} has no position attribute`)
      const world = new Float32Array(positions.count * 3)
      const v = new Vector3()
      for (let i = 0; i < positions.count; i++) {
        v.fromBufferAttribute(positions, i).applyMatrix4(bodyMesh.matrixWorld)
        world[i * 3] = v.x
        world[i * 3 + 1] = v.y
        world[i * 3 + 2] = v.z
      }
      geometry.setAttribute('uv', new BufferAttribute(cylindricalUVs(world, {
        seamAngleDeg: vessel.seamAngleDeg,
        engraveBottom: vessel.engraveBottom,
        engraveTop: vessel.engraveTop,
      }), 2))

      // Body gets the shared artboard texture; all other meshes (handle, lid)
      // keep their original GLB materials and textures.
      const bodyMaterial = new MeshStandardMaterial({ map: texture, roughness: 0.6, metalness: 0.05 })
      bodyMesh.material = bodyMaterial

      // Recenter around mid-height — the same frame the lathe geometry uses.
      wrapper.position.y -= midY
      unload({ group: wrapper, bodyMaterial })
    }
    catch (error) {
      if (token === loadToken) unload(null)
      console.warn(`[useGlbVessel] failed to load ${ref.url} — falling back to the lathe preview`, error)
    }
  }

  watch(() => profile.value, vessel => void load(vessel), { immediate: true, deep: false })

  onScopeDispose(() => {
    loadToken++
    unload(null)
  })

  return { model }
}
