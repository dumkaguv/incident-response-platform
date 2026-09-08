import {
  IncidentSeverity,
  IncidentStatus
} from '@/modules/incident/types/incident.types'

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

export const incidentSeeds = [
  {
    title: 'API gateway latency spike',
    description: 'p99 latency above 3s on the public API gateway',
    status: IncidentStatus.OPEN,
    severity: IncidentSeverity.CRITICAL,
    createdAt: daysAgo(0)
  },
  {
    title: 'Database connection pool exhausted',
    description: 'Primary Postgres pool hits max connections under load',
    status: IncidentStatus.INVESTIGATING,
    severity: IncidentSeverity.HIGH,
    createdAt: daysAgo(1)
  },
  {
    title: 'Payment webhook retries failing',
    description: 'Stripe webhooks time out and enter the retry loop',
    status: IncidentStatus.OPEN,
    severity: IncidentSeverity.HIGH,
    createdAt: daysAgo(1)
  },
  {
    title: 'Double charge on subscription renewal',
    description: 'A race condition creates duplicate invoices',
    status: IncidentStatus.RESOLVED,
    severity: IncidentSeverity.CRITICAL,
    createdAt: daysAgo(7),
    resolvedAt: daysAgo(6)
  },
  {
    title: 'ETL pipeline stuck on backfill',
    description: 'Nightly warehouse sync did not finish before 9am',
    status: IncidentStatus.INVESTIGATING,
    severity: IncidentSeverity.MEDIUM,
    createdAt: daysAgo(2)
  },
  {
    title: 'Stale dashboards in analytics',
    description: 'Materialized views were not refreshed',
    status: IncidentStatus.RESOLVED,
    severity: IncidentSeverity.LOW,
    createdAt: daysAgo(10),
    resolvedAt: daysAgo(9)
  },
  {
    title: 'Push notifications delayed on Android',
    description: 'FCM queue backlog grows during peak hours',
    status: IncidentStatus.OPEN,
    severity: IncidentSeverity.MEDIUM,
    createdAt: daysAgo(3)
  },
  {
    title: 'Crash on checkout screen (iOS 19)',
    description: 'NullPointer in the payment sheet after OS update',
    status: IncidentStatus.INVESTIGATING,
    severity: IncidentSeverity.CRITICAL,
    createdAt: daysAgo(0)
  },
  {
    title: 'SSL certificate expiring soon',
    description: 'Internal admin domain certificate expires in 5 days',
    status: IncidentStatus.CLOSED,
    severity: IncidentSeverity.LOW,
    createdAt: daysAgo(20),
    resolvedAt: daysAgo(18)
  },
  {
    title: 'Search indexing lag',
    description: 'Elasticsearch reindex queue is 40 minutes behind',
    status: IncidentStatus.OPEN,
    severity: IncidentSeverity.LOW,
    createdAt: daysAgo(4)
  }
]
