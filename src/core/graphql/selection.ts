import {
  type FragmentDefinitionNode,
  type GraphQLResolveInfo,
  type SelectionSetNode,
  Kind
} from 'graphql'

import type { ConnectionSelection } from '@/core/pagination'

type Fragments = Record<string, FragmentDefinitionNode>

type SelectionSets = (SelectionSetNode | undefined)[]

type SelectionWalk = { fragments: Fragments; expanded: Set<string> }

function spreadSelectionSet(
  name: string,
  walk: SelectionWalk
): SelectionSetNode | undefined {
  if (walk.expanded.has(name)) {
    return undefined
  }

  walk.expanded.add(name)

  return walk.fragments[name]?.selectionSet
}

function fieldNames(
  selectionSet: SelectionSetNode | undefined,
  walk: SelectionWalk,
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
      fieldNames(selection.selectionSet, walk, names)
      continue
    }

    fieldNames(spreadSelectionSet(selection.name.value, walk), walk, names)
  }
}

function childSelectionSets(
  parents: SelectionSets,
  fragments: Fragments,
  field: string
): SelectionSets {
  const found: SelectionSets = []
  const walk: SelectionWalk = { fragments, expanded: new Set() }

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

      visit(spreadSelectionSet(selection.name.value, walk))
    }
  }

  for (const parent of parents) {
    visit(parent)
  }

  return found
}

export function connectionSelection(
  info: GraphQLResolveInfo
): ConnectionSelection {
  const fragments = info.fragments
  const roots = info.fieldNodes.map((node) => node.selectionSet)
  const names = new Set<string>()
  const nodes = childSelectionSets(roots, fragments, 'nodes')
  const edges = childSelectionSets(roots, fragments, 'edges')
  const pageInfo = childSelectionSets(roots, fragments, 'pageInfo')
  const walk: SelectionWalk = { fragments, expanded: new Set() }

  for (const selected of [
    ...nodes,
    ...childSelectionSets(edges, fragments, 'node')
  ]) {
    fieldNames(selected, walk, names)
  }

  return {
    fields: [...names],
    page: nodes.length > 0 || edges.length > 0 || pageInfo.length > 0
  }
}
