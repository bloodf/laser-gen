<script setup lang="ts">
/**
 * 3D vessel preview (TresJS).
 *
 * Scene: lathe-revolved vessel (`useVesselGeometry`) textured with the
 * artboard canvas (`useArtboardTexture`), orbit controls with optional
 * auto-turntable, procedural three-point lighting, soft contact shadows,
 * ACES tone mapping. Overlays: seam indicator, handle safe-zone arc (mugs),
 * and the laser sweep shader shell — all toggleable via the vessel store.
 *
 * WebGL never touches SSR paths (the app is an SPA; the canvas is still
 * wrapped in `<ClientOnly>` and guarded behind a feature check).
 */
import { ContactShadows, OrbitControls } from '@tresjs/cientos'
import { ACESFilmicToneMapping, BoxGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from 'three'
import { radiusAt } from '~/core/geometry'
import type { VesselPartMaterial } from '~/core/geometry'
import { useVesselStore } from '~/stores/vessel'
import type { VesselFinish } from '~/stores/vessel'

const { t } = useI18n()
const store = useVesselStore()

const profile = computed(() => store.profile)
const baseColor = computed(() => store.baseColor)

const { geometry } = useVesselGeometry(profile)
const artboardTexture = useArtboardTexture({ profile, baseColor })
const { texture } = artboardTexture

// M12: GLB-backed vessels (Sketchfab, CC-BY-4.0) replace the lathe visuals
// when the profile declares `model`; the lathe stays the fallback while
// loading and the source of truth for overlays, unwrap, and export.
const { model: glbModel } = useGlbVessel(profile, texture)

/** CC-BY credit of the active GLB model, if any. */
const modelCredit = computed(() => profile.value.model?.credit ?? null)

// M4: the editor's SvgDocument drives the texture (debounced live sync).
useDocumentTexture(artboardTexture, baseColor)

// --- Materials (stable instances; scalars mutate on finish change) ---------

/** Etched-look body: the artboard texture carries the finish's base color. */
const bodyMaterial = new MeshStandardMaterial({ map: texture, roughness: 0.6, metalness: 0.05 })
const handleMaterial = new MeshStandardMaterial({ color: baseColor.value, roughness: 0.6, metalness: 0.05 })

/** Shared materials for extra parts (`profile.parts`), keyed by material role. */
const partMaterials: Record<VesselPartMaterial, MeshStandardMaterial> = {
  coated: new MeshStandardMaterial({ color: baseColor.value, roughness: 0.6, metalness: 0.05, side: DoubleSide }),
  // No environment map in the scene, so metalness 1 would render black —
  // 0.75 keeps a bright brushed-steel read under the studio lights.
  steel: new MeshStandardMaterial({ color: '#d4d7dd', roughness: 0.3, metalness: 0.75, side: DoubleSide }),
  plastic: new MeshStandardMaterial({ color: '#1d1d22', roughness: 0.8, metalness: 0, side: DoubleSide }),
}

const FINISH_PROPS: Record<VesselFinish, { roughness: number, metalness: number }> = {
  cream: { roughness: 0.6, metalness: 0.05 },
  sage: { roughness: 0.6, metalness: 0.05 },
  black: { roughness: 0.55, metalness: 0.1 },
  pink: { roughness: 0.6, metalness: 0.05 },
  stainless: { roughness: 0.25, metalness: 1 },
  custom: { roughness: 0.6, metalness: 0.05 },
}

watch([() => store.finish, baseColor], () => {
  const props = FINISH_PROPS[store.finish]
  for (const mat of [bodyMaterial, handleMaterial, partMaterials.coated]) {
    mat.roughness = props.roughness
    mat.metalness = props.metalness
  }
  handleMaterial.color.set(baseColor.value)
  partMaterials.coated.color.set(baseColor.value)
  // GLB bodies carry the same artboard texture; only the finish scalars sync.
  const glbBody = glbModel.value?.bodyMaterial
  if (glbBody) {
    glbBody.roughness = props.roughness
    glbBody.metalness = props.metalness
  }
})

// --- Meshes (persistent; geometry swapped when the profile changes) --------

const bodyMesh = new Mesh(geometry.value.body, bodyMaterial)
const handleMesh = shallowRef<Mesh | null>(null)

function syncHandle(): void {
  const handleGeometry = geometry.value.handle
  if (!handleGeometry) {
    handleMesh.value = null
    return
  }
  if (!handleMesh.value) handleMesh.value = new Mesh(handleGeometry, handleMaterial)
  else handleMesh.value.geometry = handleGeometry
}
syncHandle()

/** Group of extra part meshes (rim bands, caps, carabiners); rebuilt on change. */
const partsGroup = new Group()

function syncParts(): void {
  partsGroup.clear()
  for (const part of geometry.value.parts) {
    partsGroup.add(new Mesh(part.geometry, partMaterials[part.material]))
  }
}
syncParts()

// --- Overlays ---------------------------------------------------------------

const seamMaterial = new MeshBasicMaterial({ color: '#ff5c28' })
const seamMesh = new Mesh(new BoxGeometry(1, 1, 1), seamMaterial)

const safeZoneMaterial = new MeshBasicMaterial({
  color: '#e03030',
  transparent: true,
  opacity: 0.22,
  side: DoubleSide,
  depthWrite: false,
})
const safeZoneMesh = shallowRef<Mesh | null>(null)

function syncOverlays(): void {
  const g = geometry.value
  const p = profile.value
  // Seam: thin vertical bar hugging the surface at seamAngleDeg.
  const seamR = radiusAt(p, (p.engraveBottom + p.engraveTop) / 2) + 1
  seamMesh.scale.set(1.2, g.zoneHeightMm, 1.2)
  seamMesh.position.set(Math.sin(g.seamAngleRad) * seamR, g.zoneMidY, Math.cos(g.seamAngleRad) * seamR)

  // Handle safe zone: red-tinted open cylinder segment over the exclusion arc.
  if (g.handleArc) {
    const { angleRad, widthRad } = g.handleArc
    const r = g.maxRadiusMm + 1.5
    const geo = new CylinderGeometry(r, r, g.zoneHeightMm, 64, 1, true, angleRad - widthRad / 2, widthRad)
    if (!safeZoneMesh.value) {
      safeZoneMesh.value = new Mesh(geo, safeZoneMaterial)
    }
    else {
      safeZoneMesh.value.geometry.dispose()
      safeZoneMesh.value.geometry = geo
    }
    safeZoneMesh.value.position.y = g.zoneMidY
  }
  else {
    safeZoneMesh.value = null
  }
}
syncOverlays()

watch(geometry, () => {
  bodyMesh.geometry = geometry.value.body
  syncHandle()
  syncParts()
  syncOverlays()
})

// Apply the current finish to a freshly loaded GLB body material.
watch(glbModel, (model) => {
  if (!model) return
  const props = FINISH_PROPS[store.finish]
  model.bodyMaterial.roughness = props.roughness
  model.bodyMaterial.metalness = props.metalness
})

onScopeDispose(() => {
  bodyMaterial.dispose()
  handleMaterial.dispose()
  for (const mat of Object.values(partMaterials)) mat.dispose()
  seamMaterial.dispose()
  seamMesh.geometry.dispose()
  safeZoneMaterial.dispose()
  safeZoneMesh.value?.geometry.dispose()
  // Body/handle/part geometry and the artboard texture are disposed by their
  // composables; the GLB model (group, body material) by useGlbVessel.
})

// --- WebGL availability guard ----------------------------------------------

const webglAvailable = ref(true)
onMounted(() => {
  const probe = document.createElement('canvas')
  webglAvailable.value = !!(probe.getContext('webgl2') ?? probe.getContext('webgl'))
})

const cameraPosition = new Vector3(220, 160, 300)
const keyLightPosition = new Vector3(250, 350, 200)
const fillLightPosition = new Vector3(-200, 120, -250)
</script>

<template>
  <div class="relative h-[420px] overflow-hidden rounded-lg border border-ink-800 bg-ink-900 lg:h-[60vh]" data-testid="vessel-viewer">
    <div v-if="!webglAvailable" class="grid h-full place-items-center p-6 text-center text-sm text-ink-400">
      {{ t('viewer.webglUnavailable') }}
    </div>
    <ClientOnly v-else>
      <TresCanvas :tone-mapping="ACESFilmicToneMapping" clear-color="#141419">
        <TresPerspectiveCamera :position="cameraPosition" :fov="35" />
        <OrbitControls
          :enable-damping="true"
          :auto-rotate="store.turntable"
          :auto-rotate-speed="1.5"
          :min-distance="150"
          :max-distance="900"
        />

        <TresAmbientLight :intensity="0.8" />
        <TresDirectionalLight :position="keyLightPosition" :intensity="1.6" />
        <TresDirectionalLight :position="fillLightPosition" :intensity="0.5" />

        <primitive v-if="glbModel" :object="glbModel.group" />
        <template v-else>
          <primitive :object="bodyMesh" />
          <primitive v-if="handleMesh" :object="handleMesh" />
        </template>
        <primitive :object="partsGroup" />
        <primitive v-if="store.showSeam" :object="seamMesh" />
        <primitive v-if="store.showSafeZone && safeZoneMesh" :object="safeZoneMesh" />

        <Viewer3dLaserSweep
          v-if="store.laserSweep"
          :radius-mm="geometry.maxRadiusMm + 2"
          :height-mm="geometry.zoneHeightMm"
          :y="geometry.zoneMidY"
        />

        <ContactShadows :position="[0, -geometry.heightMm / 2 - 1, 0]" :opacity="0.5" :blur="2.5" :scale="500" />
      </TresCanvas>
      <template #fallback>
        <div class="grid h-full place-items-center text-sm text-ink-500">
          {{ t('viewer.loading') }}
        </div>
      </template>
    </ClientOnly>

    <!-- CC-BY attribution for GLB-backed vessels (license-required) -->
    <p
      v-if="modelCredit"
      class="absolute bottom-1.5 left-2 z-10 text-[10px] leading-tight text-ink-500"
      data-testid="model-credit"
    >
      {{ t('viewer.modelCredit') }}
      <a :href="modelCredit.sourceUrl" target="_blank" rel="noopener noreferrer" class="underline hover:text-ink-300">{{ modelCredit.title }}</a>
      {{ t('viewer.modelCreditBy') }}
      <a :href="modelCredit.authorUrl" target="_blank" rel="noopener noreferrer" class="underline hover:text-ink-300">{{ modelCredit.author }}</a>
      ·
      <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" class="underline hover:text-ink-300">CC BY 4.0</a>
    </p>
  </div>
</template>
