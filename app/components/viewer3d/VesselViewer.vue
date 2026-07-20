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
import { ACESFilmicToneMapping, BoxGeometry, CylinderGeometry, DoubleSide, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from 'three'
import { radiusAt } from '~/core/geometry'
import { FINISH_COLORS, useVesselStore } from '~/stores/vessel'
import type { VesselFinish } from '~/stores/vessel'

const { t } = useI18n()
const store = useVesselStore()

const profile = computed(() => store.profile)
const baseColor = computed(() => FINISH_COLORS[store.finish])

const { geometry } = useVesselGeometry(profile)
const artboardTexture = useArtboardTexture({ profile, baseColor })
const { texture } = artboardTexture

// M4: the editor's SvgDocument drives the texture (debounced live sync).
useDocumentTexture(artboardTexture, baseColor)

// --- Materials (stable instances; scalars mutate on finish change) ---------

/** Etched-look body: the artboard texture carries the finish's base color. */
const bodyMaterial = new MeshStandardMaterial({ map: texture, roughness: 0.6, metalness: 0.05 })
const handleMaterial = new MeshStandardMaterial({ color: baseColor.value, roughness: 0.6, metalness: 0.05 })

const FINISH_PROPS: Record<VesselFinish, { roughness: number, metalness: number }> = {
  cream: { roughness: 0.6, metalness: 0.05 },
  sage: { roughness: 0.6, metalness: 0.05 },
  black: { roughness: 0.55, metalness: 0.1 },
  pink: { roughness: 0.6, metalness: 0.05 },
  stainless: { roughness: 0.25, metalness: 1 },
}

watch(() => store.finish, (finish) => {
  const props = FINISH_PROPS[finish]
  for (const mat of [bodyMaterial, handleMaterial]) {
    mat.roughness = props.roughness
    mat.metalness = props.metalness
  }
  handleMaterial.color.set(baseColor.value)
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
  syncOverlays()
})

onScopeDispose(() => {
  bodyMaterial.dispose()
  handleMaterial.dispose()
  seamMaterial.dispose()
  seamMesh.geometry.dispose()
  safeZoneMaterial.dispose()
  safeZoneMesh.value?.geometry.dispose()
  // Body/handle geometry and the artboard texture are disposed by their composables.
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
  <div class="relative h-[420px] overflow-hidden rounded-lg border border-ink-800 bg-ink-900 lg:h-[60vh]">
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

        <primitive :object="bodyMesh" />
        <primitive v-if="handleMesh" :object="handleMesh" />
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
  </div>
</template>
