import {
  type I18n,
  type Messages,
  type MessageDescriptor,
  setupI18n
} from '@lingui/core'
import { compileMessage } from '@lingui/message-utils/compileMessage'
import { type OnModuleInit, Inject, Injectable } from '@nestjs/common'

import { type AppLocale, SOURCE_LOCALE } from './locales.constant'

export const I18N_CATALOGS = 'I18N_CATALOGS'

export type LocaleCatalogs = Record<AppLocale, Messages>

@Injectable()
export class I18nService implements OnModuleInit {
  private readonly instances = new Map<AppLocale, I18n>()

  constructor(
    @Inject(I18N_CATALOGS) private readonly catalogs: LocaleCatalogs
  ) {}

  public onModuleInit(): void {
    for (const [locale, messages] of Object.entries(this.catalogs)) {
      const instance = setupI18n()

      instance.setMessagesCompiler(compileMessage)
      instance.load(locale, messages)
      instance.activate(locale)

      this.instances.set(locale as AppLocale, instance)
    }
  }

  public translate(
    descriptor: MessageDescriptor,
    locale: AppLocale = SOURCE_LOCALE
  ): string {
    const instance = this.instances.get(locale) ?? this.sourceInstance()

    return instance._(descriptor)
  }

  private sourceInstance(): I18n {
    const instance = this.instances.get(SOURCE_LOCALE)

    if (!instance) {
      throw new Error(
        `i18n catalog for the source locale "${SOURCE_LOCALE}" was not loaded`
      )
    }

    return instance
  }
}
