<script setup lang="ts">
/**
 * Millimeter ruler for the artboard (top or left edge). Ticks every 1 mm
 * (when zoom permits), labeled major ticks every 10/50/100 mm depending on
 * zoom so labels never overlap.
 */
const props = defineProps<{
  orientation: 'horizontal' | 'vertical'
  /** Viewport origin in mm (viewBox x or y). */
  startMm: number
  /** Current scale in px per mm. */
  pxPerMm: number
  /** Ruler length in px (viewport width or height). */
  lengthPx: number
}>()

interface Tick {
  posPx: number
  major: boolean
  label?: string
}

/** Choose a label step (mm) that keeps labels ≥ 48 px apart. */
function labelStep(): number {
  for (const step of [10, 20, 50, 100, 200, 500]) {
    if (step * props.pxPerMm >= 48) return step
  }
  return 1000
}

const ticks = computed<Tick[]>(() => {
  const endMm = props.startMm + props.lengthPx / props.pxPerMm
  const minor = props.pxPerMm >= 3 ? 1 : props.pxPerMm >= 0.6 ? 5 : 10
  const major = labelStep()
  const out: Tick[] = []
  const first = Math.floor(props.startMm / minor) * minor
  for (let mm = first; mm <= endMm; mm += minor) {
    const isMajor = Math.abs(mm % major) < 1e-6
    if (!isMajor && minor >= major) continue
    out.push({
      posPx: (mm - props.startMm) * props.pxPerMm,
      major: isMajor,
      label: isMajor ? String(Math.round(mm)) : undefined,
    })
  }
  return out
})
</script>

<template>
  <svg
    v-if="orientation === 'horizontal'"
    class="block h-full w-full text-ink-500"
    :viewBox="`0 0 ${lengthPx} 24`"
    preserveAspectRatio="none"
  >
    <line
      v-for="t in ticks"
      :key="t.posPx"
      :x1="t.posPx"
      :x2="t.posPx"
      :y1="24"
      :y2="t.major ? 10 : 17"
      stroke="currentColor"
      :stroke-width="t.major ? 1 : 0.5"
    />
    <text
      v-for="t in ticks.filter(t => t.label !== undefined)"
      :key="`l${t.posPx}`"
      :x="t.posPx + 2"
      y="9"
      font-size="8"
      fill="currentColor"
    >{{ t.label }}</text>
  </svg>
  <svg
    v-else
    class="block h-full w-full text-ink-500"
    :viewBox="`0 0 24 ${lengthPx}`"
    preserveAspectRatio="none"
  >
    <line
      v-for="t in ticks"
      :key="t.posPx"
      :y1="t.posPx"
      :y2="t.posPx"
      :x1="24"
      :x2="t.major ? 10 : 17"
      stroke="currentColor"
      :stroke-width="t.major ? 1 : 0.5"
    />
    <text
      v-for="t in ticks.filter(t => t.label !== undefined)"
      :key="`l${t.posPx}`"
      x="2"
      :y="t.posPx + 3"
      font-size="8"
      fill="currentColor"
      writing-mode="vertical-rl"
    >{{ t.label }}</text>
  </svg>
</template>
