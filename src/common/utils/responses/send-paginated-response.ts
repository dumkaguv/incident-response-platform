import { type ClassConstructor, plainToInstance } from 'class-transformer'

type Paginated<T> = {
  data: T[]
  total: number
}

export async function sendPaginatedResponse<T, R>(
  cls: ClassConstructor<R>,
  resultPromise: Promise<Paginated<T>>
): Promise<Paginated<R>> {
  const result = await resultPromise

  return {
    data: plainToInstance(cls, result.data),
    total: result.total
  }
}
