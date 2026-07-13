import { type ClassConstructor, plainToInstance } from 'class-transformer'

export async function sendResponse<T, R>(
  cls: ClassConstructor<R>,
  resultPromise: Promise<T>
): Promise<R> {
  const result = await resultPromise

  return plainToInstance(cls, result)
}
