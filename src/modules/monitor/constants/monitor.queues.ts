export const MonitorQueue = {
  scan: 'monitor-scan',
  check: 'monitor-check'
} as const

export const MonitorJob = {
  scanDue: 'scan-due',
  check: 'check'
} as const

export const MONITOR_SCAN_SCHEDULER = 'monitor-due-scan'

export const MONITOR_PROBE_GATE_KEY = 'monitor:probes-in-flight'
