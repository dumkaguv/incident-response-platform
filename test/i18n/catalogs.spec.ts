import { readFile } from 'node:fs/promises'

import { msg } from '@lingui/core/macro'
import { formatter } from '@lingui/format-po'
import { Test } from '@nestjs/testing'
import { beforeAll, describe, expect, it } from 'vitest'
import type { CatalogType } from '@lingui/conf'

import { messages as enMessages } from '@/core/i18n/generated/en'
import { messages as roMessages } from '@/core/i18n/generated/ro'
import { messages as ruMessages } from '@/core/i18n/generated/ru'
import { I18nModule } from '@/core/i18n/i18n.module'
import { I18nService } from '@/core/i18n/i18n.service'
import { APP_LOCALES, SOURCE_LOCALE } from '@/core/i18n/locales.constant'

const CATALOG_DIR = 'src/core/i18n/catalogs'

const TRANSLATED_LOCALES = APP_LOCALES.filter(
  (locale) => locale !== SOURCE_LOCALE
)

const format = formatter({ lineNumbers: false, explicitIdAsDefault: false })

const compiled: Record<string, Record<string, unknown>> = {
  en: enMessages,
  ro: roMessages,
  ru: ruMessages
}

async function readCatalog(locale: string): Promise<CatalogType> {
  const filename = `${CATALOG_DIR}/${locale}.po`

  return format.parse(await readFile(filename, 'utf8'), {
    locale,
    sourceLocale: SOURCE_LOCALE,
    filename
  })
}

describe('i18n catalogs', () => {
  let sourceIds: string[]

  beforeAll(async () => {
    sourceIds = Object.keys(await readCatalog(SOURCE_LOCALE)).sort()
  })

  it('extracted at least one message', () => {
    expect(sourceIds.length).toBeGreaterThan(0)
  })

  it.for(TRANSLATED_LOCALES)(
    'translates every message in %s',
    async (locale) => {
      const catalog = await readCatalog(locale)
      const untranslated = sourceIds.filter((id) => !catalog[id]?.translation)

      expect(untranslated).toEqual([])
    }
  )

  it.for(TRANSLATED_LOCALES)('has no stale entries in %s', async (locale) => {
    const catalog = await readCatalog(locale)
    const stale = Object.keys(catalog).filter((id) => !sourceIds.includes(id))

    expect(stale).toEqual([])
  })

  it.for([...APP_LOCALES])(
    'has %s compiled into src/core/i18n/generated',
    (locale) => {
      const uncompiled = sourceIds.filter((id) => !(id in compiled[locale]))

      expect(uncompiled).toEqual([])
    }
  )
})

describe('I18nModule', () => {
  it('translates a macro message through the compiled catalogs', async () => {
    const testingModule = await Test.createTestingModule({
      imports: [I18nModule]
    }).compile()

    await testingModule.init()

    const i18n = testingModule.get(I18nService)
    const id = 'INC-42'
    const notFound = msg`Incident "${id}" was not found`

    expect(i18n.translate(notFound, 'ru')).toBe('Инцидент «INC-42» не найден')
    expect(i18n.translate(notFound, 'ro')).toBe(
      'Incidentul „INC-42” nu a fost găsit'
    )
    expect(i18n.translate(notFound)).toBe('Incident "INC-42" was not found')
  })
})

describe('the lingui swc plugin', () => {
  it('compiles msg`` into a descriptor with a hashed id and baked values', () => {
    const id = 'INC-7'

    expect(msg`Incident "${id}" is already resolved`).toEqual({
      id: expect.any(String),
      message: 'Incident "{id}" is already resolved',
      values: { id }
    })
  })
})
