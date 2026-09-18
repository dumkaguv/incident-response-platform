const TIMEOUT_MS_MAX = 60_000

const PROBE_LEASE_SLACK_MS = 30_000

export const MonitorLimit = {
  nameMin: 1,
  nameMax: 120,
  urlMax: 2048,
  intervalSecondsMin: 10,
  intervalSecondsMax: 86_400,
  timeoutMsMin: 100,
  timeoutMsMax: TIMEOUT_MS_MAX,
  statusCodeMin: 100,
  statusCodeMax: 599,
  probesInFlight: 16,
  probeLeaseMs: TIMEOUT_MS_MAX + PROBE_LEASE_SLACK_MS
} as const
