<script setup lang="ts">
/**
 * Landing feature grid (M9). Seven features, each with a small inline SVG
 * icon. The grid uses container queries (`@container` + `@md:`/`@xl:` variants)
 * so it responds to the space it is given rather than the viewport.
 */

/** Minimal SVG node descriptor for the inline icons. */
interface IconNode {
  tag: string
  attrs: Record<string, string>
}

const icons: Record<string, IconNode[]> = {
  wrap360: [
    { tag: 'ellipse', attrs: { cx: '12', cy: '5', rx: '8', ry: '2.5' } },
    { tag: 'path', attrs: { d: 'M4 5v14c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V5' } },
    { tag: 'path', attrs: { d: 'M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5' } },
  ],
  preview3d: [
    { tag: 'path', attrs: { d: 'M12 2 3 7v10l9 5 9-5V7l-9-5Z' } },
    { tag: 'path', attrs: { d: 'M3 7l9 5 9-5M12 12v10' } },
  ],
  photo: [
    { tag: 'rect', attrs: { x: '3', y: '4', width: '18', height: '16', rx: '2' } },
    { tag: 'circle', attrs: { cx: '9', cy: '10', r: '2' } },
    { tag: 'path', attrs: { d: 'm5 19 5-6 4 4 3-3 4 5' } },
  ],
  vectorize: [
    { tag: 'path', attrs: { d: 'M4 20c4-1 5-4 6-8s3-7 10-8c-1 7-4 9-8 10s-7 2-8 6Z' } },
    { tag: 'circle', attrs: { cx: '4', cy: '20', r: '1.4', fill: 'currentColor', stroke: 'none' } },
  ],
  ai: [
    { tag: 'path', attrs: { d: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18' } },
    { tag: 'circle', attrs: { cx: '12', cy: '12', r: '3' } },
  ],
  library: [
    { tag: 'path', attrs: { d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z' } },
    { tag: 'path', attrs: { d: 'M8 13h8M8 16h5' } },
  ],
  export: [
    { tag: 'path', attrs: { d: 'M12 3v11m0 0 4-4m-4 4-4-4' } },
    { tag: 'path', attrs: { d: 'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2' } },
  ],
}

const featureKeys = ['wrap360', 'preview3d', 'photo', 'vectorize', 'ai', 'library', 'export'] as const
</script>

<template>
  <section class="mx-auto max-w-6xl px-4" aria-labelledby="features-title">
    <div class="scroll-reveal max-w-2xl">
      <h2 id="features-title" class="text-3xl font-bold tracking-tight text-ink-100 sm:text-4xl">
        {{ $t('site.features.title') }}
      </h2>
      <p class="mt-3 text-lg text-ink-300">
        {{ $t('site.features.subtitle') }}
      </p>
    </div>

    <div class="mt-10 @container">
      <div class="grid gap-4 @md:grid-cols-2 @xl:grid-cols-3">
        <article
          v-for="(key, i) in featureKeys"
          :key="key"
          class="site-card scroll-reveal rounded-xl p-5"
          :class="i === featureKeys.length - 1 ? '@md:col-span-2 @xl:col-span-1' : ''"
        >
          <div class="flex size-10 items-center justify-center rounded-lg bg-ink-800 text-laser">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="size-5"
              aria-hidden="true"
            >
              <component :is="node.tag" v-for="node in icons[key]" :key="node.attrs.d ?? node.attrs.cx" v-bind="node.attrs" />
            </svg>
          </div>
          <h3 class="mt-4 font-semibold text-ink-100">
            {{ $t(`site.features.${key}.title`) }}
          </h3>
          <p class="mt-1.5 text-sm leading-relaxed text-ink-300">
            {{ $t(`site.features.${key}.body`) }}
          </p>
        </article>
      </div>
    </div>
  </section>
</template>
