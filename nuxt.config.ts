// https://nuxt.com/docs/api/configuration/nuxt-config
import { version } from './package.json'

export default defineNuxtConfig({
  ssr: false,

  compatibilityDate: '2026-07-01',

  // Subtle View Transitions between routes (progressive enhancement — browsers
  // without the API simply navigate without animation).
  experimental: {
    viewTransition: true,
  },

  runtimeConfig: {
    public: {
      appVersion: version,
      siteUrl: 'https://github.com/bloodf/laser-gen',
    },
  },

  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/i18n',
    '@pinia/nuxt',
    'pinia-plugin-persistedstate/nuxt',
    '@vite-pwa/nuxt',
    '@nuxt/eslint',
    '@tresjs/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'laser-gen',
      titleTemplate: '%s · laser-gen',
      meta: [
        { name: 'description', content: 'Design 360° wrap art for laser engraving — fully in your browser.' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },

  i18n: {
    strategy: 'prefix_except_default',
    defaultLocale: 'en',
    langDir: 'locales',
    locales: [
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'pt', language: 'pt-BR', name: 'Português', file: 'pt.json' },
      { code: 'es', language: 'es-ES', name: 'Español', file: 'es.json' },
      { code: 'de', language: 'de-DE', name: 'Deutsch', file: 'de.json' },
      { code: 'ja', language: 'ja-JP', name: '日本語', file: 'ja.json' },
      { code: 'zh', language: 'zh-CN', name: '中文', file: 'zh.json' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
      fallbackLocale: 'en',
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'laser-gen',
      short_name: 'laser-gen',
      description: 'Design 360° wrap art for laser engraving — fully in your browser.',
      theme_color: '#0a0a0f',
      background_color: '#0a0a0f',
      display: 'standalone',
      start_url: '/',
      icons: [
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico,json,woff2}'],
    },
    devOptions: {
      enabled: false,
    },
  },
})
