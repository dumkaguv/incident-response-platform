import { type AppLocale, APP_LOCALES, SOURCE_LOCALE } from './locales.constant'

function baseTag(part: string): string {
  const [tag] = part.split(';')

  return tag.trim().toLowerCase().split('-')[0]
}

export function resolveLocale(header?: string): AppLocale {
  if (!header) {
    return SOURCE_LOCALE
  }

  for (const part of header.split(',')) {
    const locale = APP_LOCALES.find((supported) => supported === baseTag(part))

    if (locale) {
      return locale
    }
  }

  return SOURCE_LOCALE
}
