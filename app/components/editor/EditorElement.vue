<script setup lang="ts">
/**
 * Renders one document element as SVG (all units mm, y down). Also draws an
 * invisible fat-stroke copy as a pointer hit area, since hairline strokes
 * (0.2 mm) are otherwise hard to click at fit zoom.
 */
import { transformToAttribute } from '~/core/svg'
import type { SvgElement } from '~/core/svg'

const props = defineProps<{
  el: SvgElement
  /** Hit-area stroke width in mm (screen-constant, set by the canvas). */
  hitWidthMm: number
  selected?: boolean
}>()

const emit = defineEmits<{
  select: [id: string, event: PointerEvent]
  editNodes: [id: string]
}>()

const transform = computed(() => transformToAttribute(props.el.transform))
const fill = computed(() => (props.el.fill && props.el.fill !== 'none' ? props.el.fill : 'none'))
const stroke = computed(() => props.el.stroke ?? 'none')
const strokeWidth = computed(() => props.el.strokeWidthMm ?? 0.2)
const polygonPoints = computed(() =>
  props.el.type === 'polygon' ? props.el.points.map(p => `${p.x},${p.y}`).join(' ') : '',
)

function onPointerDown(event: PointerEvent): void {
  emit('select', props.el.id, event)
}
</script>

<template>
  <g :transform="transform" :data-element-id="el.id" @pointerdown="onPointerDown" @dblclick.stop="emit('editNodes', el.id)">
    <!-- visible shape -->
    <path
      v-if="el.type === 'path'"
      :d="el.d"
      :fill="fill"
      :stroke="stroke"
      :stroke-width="strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <rect
      v-else-if="el.type === 'rect'"
      :width="el.widthMm"
      :height="el.heightMm"
      :fill="fill"
      :stroke="stroke"
      :stroke-width="strokeWidth"
    />
    <ellipse
      v-else-if="el.type === 'ellipse'"
      :rx="el.radiusXMm"
      :ry="el.radiusYMm"
      :fill="fill"
      :stroke="stroke"
      :stroke-width="strokeWidth"
    />
    <polygon
      v-else-if="el.type === 'polygon'"
      :points="polygonPoints"
      :fill="fill"
      :stroke="stroke"
      :stroke-width="strokeWidth"
      stroke-linejoin="round"
    />
    <text
      v-else-if="el.type === 'text'"
      x="0"
      y="0"
      :font-size="el.sizeMm"
      :font-family="el.fontFamily"
      :fill="el.fill && el.fill !== 'none' ? el.fill : (el.stroke ?? '#000000')"
      :stroke="el.fill && el.fill !== 'none' && el.stroke ? el.stroke : 'none'"
      :stroke-width="strokeWidth / 4"
    >{{ el.content }}</text>
    <image
      v-else-if="el.type === 'image'"
      :href="el.dataUrl"
      :width="el.widthMm"
      :height="el.heightMm"
      preserveAspectRatio="none"
    />

    <!-- fat invisible hit area (stroke geometry only) -->
    <path
      v-if="el.type === 'path'"
      :d="el.d"
      fill="none"
      stroke="transparent"
      :stroke-width="hitWidthMm"
      stroke-linecap="round"
    />
    <rect
      v-else-if="el.type === 'rect'"
      :width="el.widthMm"
      :height="el.heightMm"
      fill="none"
      stroke="transparent"
      :stroke-width="hitWidthMm"
    />
    <ellipse
      v-else-if="el.type === 'ellipse'"
      :rx="el.radiusXMm"
      :ry="el.radiusYMm"
      fill="none"
      stroke="transparent"
      :stroke-width="hitWidthMm"
    />
    <polygon
      v-else-if="el.type === 'polygon'"
      :points="polygonPoints"
      fill="none"
      stroke="transparent"
      :stroke-width="hitWidthMm"
    />

    <!-- selection outline -->
    <path
      v-if="selected && el.type === 'path'"
      :d="el.d"
      fill="none"
      class="stroke-laser"
      :stroke-width="hitWidthMm / 4"
      stroke-dasharray="1 1"
      pointer-events="none"
    />
  </g>
</template>
