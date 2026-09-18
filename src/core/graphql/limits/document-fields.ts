import { Kind } from 'graphql'
import type {
  DocumentNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
  SelectionSetNode
} from 'graphql'

export type Fragments = Record<string, FragmentDefinitionNode>

export function fragmentsOf(document: DocumentNode): Fragments {
  const fragments: Fragments = {}

  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments[definition.name.value] = definition
    }
  }

  return fragments
}

export type RepeatedField = { field: string; count: number }

export type DocumentShape = { selections: number; repeated: RepeatedField }

export function documentShape(document: DocumentNode): DocumentShape {
  const pending: SelectionSetNode[] = []

  for (const definition of document.definitions) {
    if ('selectionSet' in definition) {
      pending.push(definition.selectionSet)
    }
  }

  let selections = 0
  let repeated: RepeatedField = { field: '', count: 0 }

  while (pending.length) {
    const selectionSet = pending.pop() as SelectionSetNode
    const keys = new Map<string, number>()

    for (const selection of selectionSet.selections) {
      selections += 1

      if (selection.kind === Kind.FRAGMENT_SPREAD) {
        continue
      }

      if (selection.selectionSet) {
        pending.push(selection.selectionSet)
      }

      if (selection.kind !== Kind.FIELD) {
        continue
      }

      const field = (selection.alias ?? selection.name).value
      const count = (keys.get(field) ?? 0) + 1

      keys.set(field, count)

      if (count > repeated.count) {
        repeated = { field, count }
      }
    }
  }

  return { selections, repeated }
}

export function selectsField(
  selectionSet: SelectionSetNode | undefined,
  name: string,
  fragments: Fragments
): boolean {
  const expanded = new Set<string>()

  function visit(current: SelectionSetNode | undefined): boolean {
    if (!current) {
      return false
    }

    return current.selections.some((selection) => {
      if (selection.kind === Kind.FIELD) {
        return selection.name.value === name
      }

      if (selection.kind === Kind.INLINE_FRAGMENT) {
        return visit(selection.selectionSet)
      }

      const spread = selection.name.value

      if (expanded.has(spread)) {
        return false
      }

      expanded.add(spread)

      return visit(fragments[spread]?.selectionSet)
    })
  }

  return visit(selectionSet)
}

export function rootFieldCount(
  operation: OperationDefinitionNode,
  fragments: Fragments
): number {
  const counted = new Map<string, number>()

  function visit(
    selectionSet: SelectionSetNode,
    expanding: ReadonlySet<string>
  ): number {
    let total = 0

    for (const selection of selectionSet.selections) {
      if (selection.kind === Kind.FIELD) {
        if (!selection.name.value.startsWith('__')) {
          total += 1
        }

        continue
      }

      if (selection.kind === Kind.INLINE_FRAGMENT) {
        total += visit(selection.selectionSet, expanding)
        continue
      }

      total += fragmentFields(selection.name.value, expanding)
    }

    return total
  }

  function fragmentFields(
    name: string,
    expanding: ReadonlySet<string>
  ): number {
    const known = counted.get(name)

    if (known !== undefined) {
      return known
    }

    const fragment = fragments[name]

    if (!fragment || expanding.has(name)) {
      return 0
    }

    const total = visit(fragment.selectionSet, new Set([...expanding, name]))

    counted.set(name, total)

    return total
  }

  return visit(operation.selectionSet, new Set())
}
