import { encodeCursor } from '@/common/pagination/utils/query-cursor'
import type { QuerySpec } from '@/common/pagination/utils/query-spec'

export {
  decodeCursor,
  encodeCursor,
  InvalidCursorError
} from '@/common/pagination/utils/query-cursor'

export type PageInfo = {
  hasNextPage: boolean
  hasPreviousPage: boolean
  startCursor: string | null
  endCursor: string | null
}

export class Connection<T> {
  public readonly nodes: T[]

  private readonly hasNextPage: boolean
  private readonly hasPreviousPage: boolean
  private countPromise?: Promise<number>

  constructor(
    rows: T[],
    private readonly spec: QuerySpec,
    private readonly countFn: () => Promise<number>
  ) {
    const pagination = spec.pagination
    const hasMore = rows.length > pagination.limit
    const hasCursor = pagination.values !== undefined
    const backward = pagination.direction === 'backward'

    this.nodes = rows.slice(0, pagination.limit)
    if (backward) {
      this.nodes.reverse()
    }

    this.hasNextPage = backward ? hasCursor : hasMore
    this.hasPreviousPage = backward ? hasMore : hasCursor
  }

  public get edges(): { node: T; cursor: string }[] {
    return this.nodes.map((node) => ({
      node,
      cursor: encodeCursor(node, this.spec)
    }))
  }

  public get pageInfo(): PageInfo {
    const first = this.nodes[0]
    const last = this.nodes.at(-1)

    return {
      hasNextPage: this.hasNextPage,
      hasPreviousPage: this.hasPreviousPage,
      startCursor: first ? encodeCursor(first, this.spec) : null,
      endCursor: last ? encodeCursor(last, this.spec) : null
    }
  }

  public get totalCount(): Promise<number> {
    this.countPromise ??= this.countFn()

    return this.countPromise
  }
}
