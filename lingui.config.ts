import { createBabelExtractor } from '@lingui/cli/api/extractors/babel'
import { defineConfig } from '@lingui/conf'
import { formatter } from '@lingui/format-po'

import { APP_LOCALES, SOURCE_LOCALE } from './src/i18n/locales.constant.js'

export default defineConfig({
  sourceLocale: SOURCE_LOCALE,
  locales: [...APP_LOCALES],

  fallbackLocales: { default: SOURCE_LOCALE },

  catalogs: [
    { path: '<rootDir>/src/i18n/catalogs/{locale}', include: ['src'] }
  ],
  catalogsMergePath: '<rootDir>/src/i18n/generated/{locale}',
  compileNamespace: 'ts',

  extractors: [
    createBabelExtractor({ parserOptions: { tsExperimentalDecorators: true } })
  ],

  format: formatter({
    lineNumbers: false,
    explicitIdAsDefault: false
  })
})
