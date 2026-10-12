import { neon } from '@neondatabase/serverless'

export class SubscriptionConfigurationError extends Error {
  constructor() {
    super('Subscription database is not configured')
    this.name = 'SubscriptionConfigurationError'
  }
}

// Dependencies are injectable so the persistence contract can be checked offline.
// DATABASE_URL is read only when a valid subscription is ready to be stored.
export function createSubscriptionStore({
  getDatabaseUrl = () => process.env.DATABASE_URL,
  createSql = neon,
} = {}) {
  let sql

  return async function saveSubscription(email, consentVersion) {
    if (!sql) {
      const databaseUrl = getDatabaseUrl()
      if (!databaseUrl) throw new SubscriptionConfigurationError()
      sql = createSql(databaseUrl)
    }

    // The database's UNIQUE constraint resolves concurrent duplicate requests.
    // Tagged-template values are bound parameters, never SQL fragments.
    await sql`
      INSERT INTO public.email_subscriptions (email, consent_version)
      VALUES (${email}, ${consentVersion})
      ON CONFLICT (email) DO NOTHING
    `
  }
}

export const saveSubscription = createSubscriptionStore()
