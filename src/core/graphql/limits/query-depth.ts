import { Kind } from 'graphql'
import type {
  DocumentNode,
  FragmentDefinitionNode,
  SelectionSetNode
} from 'graphql'

type Fragments = Record<string, FragmentDefinitionNode>

export function queryDepth(
  document: DocumentNode,
  operationName?: string | null
): number {
  const fragments: Fragments = {}

  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments[definition.name.value] = definition
    }
  }

  let deepest = 0

  for (const definition of document.definitions) {
    if (definition.kind !== Kind.OPERATION_DEFINITION) {
      continue
    }

    if (operationName && definition.name?.value !== operationName) {
      continue
    }

    deepest = Math.max(
      deepest,
      depthOf(definition.selectionSet, fragments, new Set())
    )
  }

  return deepest
}

function depthOf(
  selectionSet: SelectionSetNode,
  fragments: Fragments,
  visited: ReadonlySet<string>
): number {
  let deepest = 0

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      if (selection.name.value.startsWith('__')) {
        continue
      }

      const child = selection.selectionSet
        ? depthOf(selection.selectionSet, fragments, visited)
        : 0

      deepest = Math.max(deepest, child + 1)
      continue
    }

    if (selection.kind === Kind.INLINE_FRAGMENT) {
      deepest = Math.max(
        deepest,
        depthOf(selection.selectionSet, fragments, visited)
      )
      continue
    }

    const name = selection.name.value
    const fragment = fragments[name]

    if (!fragment || visited.has(name)) {
      continue
    }

    deepest = Math.max(
      deepest,
      depthOf(fragment.selectionSet, fragments, new Set([...visited, name]))
    )
  }

  return deepest
}
