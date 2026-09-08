import { registerEnumType } from '@nestjs/graphql'

const enumRegistry = new WeakMap<object, string>()

export function registerQueryEnum(
  enumObject: Record<string, string>,
  name: string,
  options: { description?: string } = {}
): void {
  const previous = enumRegistry.get(enumObject)

  if (previous && previous !== name) {
    throw new Error(`Enum already registered as "${previous}"`)
  }

  if (previous) {
    return
  }

  registerEnumType(enumObject, { name, ...options })
  enumRegistry.set(enumObject, name)
}
