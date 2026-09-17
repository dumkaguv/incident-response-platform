export const MonitorLimit = {
  nameMin: 1,
  nameMax: 120,
  urlMax: 2048,
  intervalSecondsMin: 10,
  intervalSecondsMax: 86_400,
  timeoutMsMin: 100,
  timeoutMsMax: 60_000,
  statusCodeMin: 100,
  statusCodeMax: 599,
  probesInFlight: 16
} as const
