<script setup lang="ts">
/**
 * Laser sweep overlay: an open cylinder shell around the engrave zone with a
 * custom `ShaderMaterial` (`app/assets/shaders/laser-sweep.*.glsl`). The
 * fragment shader draws a hot band at the uniform angle `uAngle`, which
 * advances every frame — simulating the rotary burn path. Additive blending,
 * so it reads as glow on top of the vessel.
 */
import { AdditiveBlending, Color, CylinderGeometry, DoubleSide, Mesh, ShaderMaterial } from 'three'
import type { IUniform } from 'three'
import { useLoop } from '@tresjs/core'
import fragmentShader from '~/assets/shaders/laser-sweep.frag.glsl?raw'
import vertexShader from '~/assets/shaders/laser-sweep.vert.glsl?raw'

const props = defineProps<{
  /** Shell radius in mm (just above the vessel surface). */
  radiusMm: number
  /** Shell height in mm (engrave-zone height). */
  heightMm: number
  /** Shell center y in scene coordinates (mm). */
  y: number
}>()

/** Sweep speed, radians per second (~one revolution per 5 s). */
const SPEED = 1.2

const material = new ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    uAngle: { value: 0 },
    uColor: { value: new Color('#ff5c28') },
  },
  transparent: true,
  blending: AdditiveBlending,
  depthWrite: false,
  side: DoubleSide,
})

function buildGeometry(): CylinderGeometry {
  return new CylinderGeometry(props.radiusMm, props.radiusMm, props.heightMm, 96, 1, true)
}

const mesh = new Mesh(buildGeometry(), material)

watch(() => [props.radiusMm, props.heightMm], () => {
  const old = mesh.geometry
  mesh.geometry = buildGeometry()
  old.dispose()
})

watch(() => props.y, y => mesh.position.set(0, y, 0), { immediate: true })

const { onBeforeRender } = useLoop()
onBeforeRender(({ elapsed }) => {
  ;(material.uniforms.uAngle as IUniform<number>).value = elapsed * SPEED
})

onScopeDispose(() => {
  mesh.geometry.dispose()
  material.dispose()
})
</script>

<template>
  <primitive :object="mesh" />
</template>
