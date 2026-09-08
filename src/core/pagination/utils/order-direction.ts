export type SortDirectionValue = 'ASC' | 'DESC'

export type OrderDirection =
  | SortDirectionValue
  | 'AscNullsFirst'
  | 'AscNullsLast'
  | 'DescNullsFirst'
  | 'DescNullsLast'

export const ORDER_DIRECTIONS: Record<OrderDirection, OrderDirection> = {
  ASC: 'ASC',
  DESC: 'DESC',
  AscNullsFirst: 'AscNullsFirst',
  AscNullsLast: 'AscNullsLast',
  DescNullsFirst: 'DescNullsFirst',
  DescNullsLast: 'DescNullsLast'
}
