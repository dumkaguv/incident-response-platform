import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FastifyReply } from 'fastify'

import {
  HealthController,
  READINESS_TIMEOUT_MS
} from '@/core/health/health.controller'
import type { PrismaService } from '@/core/prisma/prisma.service'

function replyRecorder() {
  const reply = { status: vi.fn(), send: vi.fn() }

  reply.status.mockReturnValue(reply)

  return reply
}

function controllerWith(ping: () => Promise<void>): HealthController {
  return new HealthController({ ping } as unknown as PrismaService)
}

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /health/ready', () => {
  it('answers 200 once the database answered', async () => {
    const reply = replyRecorder()

    await controllerWith(() => Promise.resolve()).ready(
      reply as unknown as FastifyReply
    )

    expect(reply.status).toHaveBeenCalledWith(200)
    expect(reply.send).toHaveBeenCalledWith({ status: 'ok', database: 'ok' })
  })

  it('answers 503 when the database fails', async () => {
    const reply = replyRecorder()

    await controllerWith(() => Promise.reject(new Error('down'))).ready(
      reply as unknown as FastifyReply
    )

    expect(reply.status).toHaveBeenCalledWith(503)
    expect(reply.send).toHaveBeenCalledWith({
      status: 'error',
      database: 'unreachable'
    })
  })

  it('answers 503 instead of hanging when the database never answers', async () => {
    vi.useFakeTimers()

    const reply = replyRecorder()
    const pending = controllerWith(
      () => new Promise<void>(() => undefined)
    ).ready(reply as unknown as FastifyReply)

    await vi.advanceTimersByTimeAsync(READINESS_TIMEOUT_MS)
    await pending

    expect(reply.status).toHaveBeenCalledWith(503)
    expect(reply.send).toHaveBeenCalledWith({
      status: 'error',
      database: 'unreachable'
    })
  })
})
