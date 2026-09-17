import {
  type FragmentDefinitionNode,
  type GraphQLResolveInfo,
  type SelectionSetNode,
  Kind
} from 'graphql'

type Fragments = Record<string, FragmentDefinitionNode>

type SelectionSets = (SelectionSetNode | undefined)[]

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

function childSelectionSets(
  parents: SelectionSets,
  fragments: Fragments,
  field: string
): SelectionSets {
  const found: SelectionSets = []

  function visit(selectionSet: SelectionSetNode | undefined): void {
    if (!selectionSet) {
      return
    }

    for (const selection of selectionSet.selections) {
      if (selection.kind === Kind.FIELD) {
        if (selection.name.value === field) {
          found.push(selection.selectionSet)
        }

        continue
      }

      if (selection.kind === Kind.INLINE_FRAGMENT) {
        visit(selection.selectionSet)
        continue
      }

      visit(fragments[selection.name.value]?.selectionSet)
    }
  }

  for (const parent of parents) {
    visit(parent)
  }

  return found
}

export function connectionSelection(info: GraphQLResolveInfo): string[] {
  const fragments = info.fragments
  const roots = info.fieldNodes.map((node) => node.selectionSet)
  const names = new Set<string>()
  const edges = childSelectionSets(roots, fragments, 'edges')

  for (const nodes of [
    ...childSelectionSets(roots, fragments, 'nodes'),
    ...childSelectionSets(edges, fragments, 'node')
  ]) {
    fieldNames(nodes, fragments, names)
  }

  return [...names]
}
