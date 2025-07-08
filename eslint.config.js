import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

export default createConfigForNuxt({
  features: {
    stylistic: false,
  },
}).override('nuxt/vue/rules', {
  rules: {
    'vue/html-self-closing': 'off',
  },
})
