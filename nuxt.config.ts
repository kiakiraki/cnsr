// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: true },
  app: {
    head: {
      title: 'CNSR - 画像モザイク処理',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          hid: 'description',
          name: 'description',
          content:
            '画像をアップロードして選択した領域にモザイク処理を適用できるWebアプリケーション',
        },
      ],
      link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }],
    },
  },
  compatibilityDate: '2025-05-15',
  nitro: {
    preset: 'cloudflare-pages',
  },
})
