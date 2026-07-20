<script setup lang="ts">
/**
 * "How it works" — three-step strip on the landing page (M9).
 */
const steps = ['pick', 'design', 'export'] as const
</script>

<template>
  <section id="how-it-works" class="scroll-mt-20 border-y border-ink-800 bg-ink-900/40" aria-labelledby="how-title">
    <div class="mx-auto max-w-6xl px-4 py-20">
      <h2 id="how-title" class="scroll-reveal text-3xl font-bold tracking-tight text-ink-100 sm:text-4xl">
        {{ $t('site.howItWorks.title') }}
      </h2>

      <ol class="mt-10 grid gap-8 sm:grid-cols-3">
        <li v-for="(step, i) in steps" :key="step" class="scroll-reveal relative">
          <span
            class="flex size-9 items-center justify-center rounded-full border border-laser-dim text-sm font-bold text-laser"
            aria-hidden="true"
          >
            {{ i + 1 }}
          </span>
          <h3 class="mt-4 font-semibold text-ink-100">
            {{ $t(`site.howItWorks.${step}.title`) }}
          </h3>
          <p class="mt-1.5 text-sm leading-relaxed text-ink-300">
            {{ $t(`site.howItWorks.${step}.body`) }}
          </p>
        </li>
      </ol>
    </div>
  </section>
</template>
