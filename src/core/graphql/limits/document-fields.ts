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
