import {
  type FragmentDefinitionNode,
  type GraphQLResolveInfo,
  type SelectionSetNode,
  Kind
} from 'graphql'

type Fragments = Record<string, FragmentDefinitionNode>

function fieldNames(
  selectionSet: SelectionSetNode | undefined,
  fragments: Fragments,
  names: Set<string>
): void {
  if (!selectionSet) {
    return
  }

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      names.add(selection.name.value)
      continue
    }

    if (selection.kind === Kind.INLINE_FRAGMENT) {
      fieldNames(selection.selectionSet, fragments, names)
      continue
    }

    fieldNames(fragments[selection.name.value]?.selectionSet, fragments, names)
  }
}

function childSelectionSet(
  selectionSet: SelectionSetNode | undefined,
  fragments: Fragments,
  field: string
): SelectionSetNode | undefined {
  if (!selectionSet) {
    return undefined
  }

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD && selection.name.value === field) {
      return selection.selectionSet
    }

    if (selection.kind === Kind.INLINE_FRAGMENT) {
      const nested = childSelectionSet(selection.selectionSet, fragments, field)

      if (nested) {
        return nested
      }
    }

    if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const nested = childSelectionSet(
        fragments[selection.name.value]?.selectionSet,
        fragments,
        field
      )

      if (nested) {
        return nested
      }
    }
  }

  return undefined
}

export function connectionSelection(info: GraphQLResolveInfo): string[] {
  const fragments = info.fragments
  const root = info.fieldNodes[0]?.selectionSet
  const names = new Set<string>()
  const edges = childSelectionSet(root, fragments, 'edges')

  fieldNames(childSelectionSet(root, fragments, 'nodes'), fragments, names)
  fieldNames(childSelectionSet(edges, fragments, 'node'), fragments, names)

  return [...names]
}
