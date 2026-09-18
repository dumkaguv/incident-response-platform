const NON_DIGIT = /\D/g

export function checkJobId(monitorId: string, dueAt: string): string {
  return `${monitorId}-${dueAt.replace(NON_DIGIT, '')}`
}
