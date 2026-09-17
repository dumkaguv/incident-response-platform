import { ValidateIf } from 'class-validator'

export function Omittable(): PropertyDecorator {
  return ValidateIf((_, value: unknown) => value !== undefined)
}
