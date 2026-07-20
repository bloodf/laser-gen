<script setup lang="ts">
/**
 * WebGL shader hero background (M9).
 *
 * A raw three.js `ShaderMaterial` on a fullscreen quad — intentionally not
 * TresJS, to keep the landing page dependency-light. three.js is imported
 * dynamically so it stays out of the landing entry chunk (it is shared with
 * the studio chunk instead).
 *
 * The shader (`assets/shaders/hero.frag.glsl`) traces glowing rosette curves
 * like a laser beam on dark metal. Quality tiers halve the render resolution
 * on coarse-pointer/small/high-DPR devices. The loop pauses when the tab is
 * hidden and when the hero scrolls out of view (IntersectionObserver); under
 * `prefers-reduced-motion` a single static frame is rendered. Without WebGL,
 * the component falls back to the layered CSS gradient rendered beneath the
 * canvas, which is styled to look intentional on its own.
 */
import fragmentShader from '~/assets/shaders/hero.frag.glsl?raw'
import vertexShader from '~/assets/shaders/hero.vert.glsl?raw'

const host = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
/** True when WebGL could not start — the CSS gradient fallback shows through. */
const unavailable = ref(false)

onMounted(async () => {
  if (!host.value || !canvas.value) {
    return
  }
  const hostEl = host.value
  const canvasEl = canvas.value

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  let three: typeof import('three')
  try {
    three = await import('three')
  }
  catch {
    unavailable.value = true
    return
  }

  let renderer: import('three').WebGLRenderer
  try {
    renderer = new three.WebGLRenderer({
      canvas: canvasEl,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
    })
  }
  catch {
    unavailable.value = true
    return
  }

  // --- Quality tier ---------------------------------------------------------
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const renderScale = coarsePointer || window.innerWidth < 768 || window.devicePixelRatio > 2
    ? 0.5
    : Math.min(window.devicePixelRatio, 1.5)

  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new three.Vector2(1, 1) },
    uPointer: { value: new three.Vector2(0, 0) },
    uStatic: { value: reducedMotion ? 1 : 0 },
  }

  const geometry = new three.PlaneGeometry(2, 2)
  const material = new three.ShaderMaterial({ vertexShader, fragmentShader, uniforms })
  const scene = new three.Scene()
  scene.add(new three.Mesh(geometry, material))
  const camera = new three.Camera()

  function resize(): void {
    const { clientWidth, clientHeight } = hostEl
    renderer.setSize(Math.max(1, clientWidth * renderScale), Math.max(1, clientHeight * renderScale), false)
    uniforms.uResolution.value.set(clientWidth, clientHeight)
  }
  resize()

  // --- Pointer (lerped toward the target in the render loop) ----------------
  const pointerTarget = new three.Vector2(0, 0)
  function onPointerMove(event: PointerEvent): void {
    const rect = hostEl.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
    pointerTarget.set(x * (rect.width / rect.height), y)
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true })

  // --- Render loop, paused when hidden / off-screen --------------------------
  let raf = 0
  let inView = true
  const clock = new three.Clock()

  function frame(): void {
    uniforms.uTime.value = clock.getElapsedTime()
    uniforms.uPointer.value.lerp(pointerTarget, 0.06)
    renderer.render(scene, camera)
    raf = requestAnimationFrame(frame)
  }

  function start(): void {
    if (!raf && inView && !document.hidden && !reducedMotion) {
      raf = requestAnimationFrame(frame)
    }
  }

  function stop(): void {
    if (raf) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }

  function onVisibilityChange(): void {
    if (document.hidden) {
      stop()
    }
    else {
      start()
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange)

  const intersectionObserver = new IntersectionObserver((entries) => {
    inView = entries[0]?.isIntersecting ?? true
    if (inView) {
      start()
    }
    else {
      stop()
    }
  })
  intersectionObserver.observe(hostEl)

  const resizeObserver = new ResizeObserver(() => {
    resize()
    if (reducedMotion) {
      renderer.render(scene, camera)
    }
  })
  resizeObserver.observe(hostEl)

  // Reduced motion: one static frame, no loop.
  if (reducedMotion) {
    uniforms.uTime.value = 8
    renderer.render(scene, camera)
  }
  else {
    start()
  }

  onUnmounted(() => {
    stop()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pointermove', onPointerMove)
    intersectionObserver.disconnect()
    resizeObserver.disconnect()
    scene.clear()
    geometry.dispose()
    material.dispose()
    renderer.dispose()
  })
})
</script>

<template>
  <div ref="host" class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <!-- CSS gradient fallback: always painted under the canvas, intentional on
         its own when WebGL is unavailable. -->
    <div
      class="absolute inset-0"
      :style="{
        background: [
          'radial-gradient(60% 55% at 62% 42%, color-mix(in oklch, var(--color-laser) 22%, transparent), transparent 70%)',
          'radial-gradient(45% 40% at 30% 65%, color-mix(in oklch, var(--color-laser-dim) 18%, transparent), transparent 70%)',
          'linear-gradient(180deg, var(--color-ink-950) 0%, oklch(0.18 0.02 265) 55%, var(--color-ink-950) 100%)',
        ].join(', '),
      }"
    />
    <canvas v-show="!unavailable" ref="canvas" class="absolute inset-0 size-full" />
  </div>
</template>
