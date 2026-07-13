export function connectOrDisconnect(id?: number) {
  if (!id) {
    return { disconnect: true }
  }

  return { connect: { id } }
}
