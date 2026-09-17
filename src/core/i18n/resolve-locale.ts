import { type AppLocale, APP_LOCALES, SOURCE_LOCALE } from './locales.constant'

type Preference = { language: string; quality: number; position: number }

function quality(parameters: string[]): number {
  const weight = parameters.find((parameter) =>
    parameter.toLowerCase().startsWith('q=')
  )

  if (weight === undefined) {
    return 1
  }

  const parsed = Number(weight.slice(2))

  return Number.isFinite(parsed) ? parsed : 0
}

function preferences(header: string): Preference[] {
  return header
    .split(',')
    .map((part, position) => {
      const [tag = '', ...parameters] = part
        .split(';')
        .map((piece) => piece.trim())

      return {
        language: tag.toLowerCase().split('-')[0],
        quality: quality(parameters),
        position
      }
    })
    .filter((preference) => preference.quality > 0)
    .sort(
      (left, right) =>
        right.quality - left.quality || left.position - right.position
    )
}

export function resolveLocale(header?: string): AppLocale {
  if (!header) {
    return SOURCE_LOCALE
  }

  for (const { language } of preferences(header)) {
    const locale = APP_LOCALES.find((supported) => supported === language)

    if (locale) {
      return locale
    }
  }

  return SOURCE_LOCALE
}
