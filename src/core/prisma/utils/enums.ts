import contractJson from '../contract.json' with { type: 'json' }
import type { Contract } from '../contract'

type DomainEnums = Contract['domain']['namespaces']['public']['enum']

type EnumName = keyof DomainEnums

type MemberName<Name extends EnumName> =
  DomainEnums[Name]['members'][number]['name']

type ValueMap<Name extends EnumName> = { readonly [K in MemberName<Name>]: K }

export function contractEnum<Name extends EnumName>(
  name: Name
): ValueMap<Name> {
  const { members } = contractJson.domain.namespaces.public.enum[name]
  const values: Record<string, string> = {}

  for (const member of members) {
    values[member.name] = member.value
  }

  return values as ValueMap<Name>
}
