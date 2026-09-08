import { Test } from '@nestjs/testing'
import { beforeEach, describe, expect, it } from 'vitest'

import { I18N_CATALOGS, I18nService } from '@/core/i18n/i18n.service'
import type { AppLocale } from '@/core/i18n/locales.constant'

const catalogs = {
  en: {
    notFound: 'Incident was not found',
    titleTaken: 'An incident titled "{title}" already exists',
    openCount: '{count, plural, one {# open incident} other {# open incidents}}'
  },
  ro: {
    notFound: 'Incidentul nu a fost găsit',
    titleTaken: 'Un incident cu titlul "{title}" există deja',
    openCount:
      '{count, plural, one {# incident deschis} few {# incidente deschise} other {# de incidente deschise}}'
  },
  ru: {
    notFound: 'Инцидент не найден',
    titleTaken: 'Инцидент с названием «{title}» уже существует',
    openCount:
      '{count, plural, one {# открытый инцидент} few {# открытых инцидента} many {# открытых инцидентов} other {# открытого инцидента}}'
  }
}

const notFound = { id: 'notFound', message: 'Incident was not found' }

function titleTaken(title: string) {
  return {
    id: 'titleTaken',
    message: 'An incident titled "{title}" already exists',
    values: { title }
  }
}

function openCount(count: number) {
  return {
    id: 'openCount',
    message: '{count, plural, one {# open incident} other {# open incidents}}',
    values: { count }
  }
}

describe('I18nService', () => {
  let i18n: I18nService

  beforeEach(async () => {
    const testingModule = await Test.createTestingModule({
      providers: [{ provide: I18N_CATALOGS, useValue: catalogs }, I18nService]
    }).compile()

    await testingModule.init()

    i18n = testingModule.get(I18nService)
  })

  it('translates a message into the requested locale', () => {
    expect(i18n.translate(notFound, 'ru')).toBe('Инцидент не найден')
    expect(i18n.translate(notFound, 'ro')).toBe('Incidentul nu a fost găsit')
  })

  it('defaults to the source locale when no locale is given', () => {
    expect(i18n.translate(notFound)).toBe('Incident was not found')
  })

  it('falls back to the source locale for a locale it does not know', () => {
    expect(i18n.translate(notFound, 'de' as AppLocale)).toBe(
      'Incident was not found'
    )
  })

  it('falls back to the source text for an id missing from the catalog', () => {
    const unreleased = {
      id: 'notInAnyCatalogYet',
      message: 'Incident is still being triaged'
    }

    expect(i18n.translate(unreleased, 'ru')).toBe(
      'Incident is still being triaged'
    )
  })

  it('interpolates values carried by the descriptor', () => {
    expect(i18n.translate(titleTaken('Отказ БД'), 'ru')).toBe(
      'Инцидент с названием «Отказ БД» уже существует'
    )
  })

  it('picks the Russian plural form from the count', () => {
    expect(i18n.translate(openCount(1), 'ru')).toBe('1 открытый инцидент')
    expect(i18n.translate(openCount(2), 'ru')).toBe('2 открытых инцидента')
    expect(i18n.translate(openCount(5), 'ru')).toBe('5 открытых инцидентов')
  })

  it('still compiles raw ICU when NODE_ENV is production', async () => {
    const previousNodeEnv = process.env.NODE_ENV

    process.env.NODE_ENV = 'production'

    try {
      const testingModule = await Test.createTestingModule({
        providers: [{ provide: I18N_CATALOGS, useValue: catalogs }, I18nService]
      }).compile()

      await testingModule.init()

      expect(testingModule.get(I18nService).translate(openCount(5), 'ru')).toBe(
        '5 открытых инцидентов'
      )
    } finally {
      process.env.NODE_ENV = previousNodeEnv
    }
  })

  it('picks the Romanian plural form from the count', () => {
    expect(i18n.translate(openCount(1), 'ro')).toBe('1 incident deschis')
    expect(i18n.translate(openCount(2), 'ro')).toBe('2 incidente deschise')
    expect(i18n.translate(openCount(20), 'ro')).toBe('20 de incidente deschise')
  })
})
