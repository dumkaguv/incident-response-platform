import { InputType, PartialType } from '@nestjs/graphql'

import { CreateMonitorInput } from './create-monitor.input'

@InputType()
export class UpdateMonitorInput extends PartialType(CreateMonitorInput, {
  skipNullProperties: false
}) {}

export type MonitorUpdateData = UpdateMonitorInput & {
  nextCheckAt?: string | null
}
