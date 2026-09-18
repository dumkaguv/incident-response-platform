import { Kind } from 'graphql'
import type {
  DocumentNode,
  FragmentDefinitionNode,
  SelectionSetNode
} from 'graphql'

type Fragments = Record<string, FragmentDefinitionNode>

type DepthWalk = { fragments: Fragments; fragmentDepths: Map<string, number> }

export function queryDepth(
  document: DocumentNode,
  operationName?: string | null
): number {
  const walk: DepthWalk = { fragments: {}, fragmentDepths: new Map() }

  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      walk.fragments[definition.name.value] = definition
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
      depthOf(definition.selectionSet, walk, new Set())
    )
  }

  return deepest
}

function depthOf(
  selectionSet: SelectionSetNode,
  walk: DepthWalk,
  expanding: ReadonlySet<string>
): number {
  let deepest = 0

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      if (selection.name.value.startsWith('__')) {
        continue
      }

      const child = selection.selectionSet
        ? depthOf(selection.selectionSet, walk, expanding)
        : 0

      deepest = Math.max(deepest, child + 1)
      continue
    }

    if (selection.kind === Kind.INLINE_FRAGMENT) {
      deepest = Math.max(
        deepest,
        depthOf(selection.selectionSet, walk, expanding)
      )
      continue
    }

    deepest = Math.max(
      deepest,
      fragmentDepth(selection.name.value, walk, expanding)
    )
  }

  return deepest
}

function fragmentDepth(
  name: string,
  walk: DepthWalk,
  expanding: ReadonlySet<string>
): number {
  const known = walk.fragmentDepths.get(name)

  if (known !== undefined) {
    return known
  }

  const fragment = walk.fragments[name]

  if (!fragment || expanding.has(name)) {
    return 0
  }

  const depth = depthOf(
    fragment.selectionSet,
    walk,
    new Set([...expanding, name])
  )

  walk.fragmentDepths.set(name, depth)

  return depth
}
