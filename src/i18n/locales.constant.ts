export const APP_LOCALES = ['en', 'ro', 'ru'] as const

export type AppLocale = (typeof APP_LOCALES)[number]

export const SOURCE_LOCALE = 'en' satisfies AppLocale
