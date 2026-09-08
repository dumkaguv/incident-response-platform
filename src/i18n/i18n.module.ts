import { Global, Module } from '@nestjs/common'

import { messages as enMessages } from './generated/en'
import { messages as roMessages } from './generated/ro'
import { messages as ruMessages } from './generated/ru'
import { type LocaleCatalogs, I18N_CATALOGS, I18nService } from './i18n.service'

const catalogs: LocaleCatalogs = {
  en: enMessages,
  ro: roMessages,
  ru: ruMessages
}

@Global()
@Module({
  providers: [{ provide: I18N_CATALOGS, useValue: catalogs }, I18nService],
  exports: [I18nService]
})
export class I18nModule {}
