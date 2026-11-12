import { z } from 'zod';
import { getPostgresConnection } from '../utils/postgres-client';
import { StripeWebhookEventSchema } from '../models/ThirdPartyIntegrations/stripe.model';

export class StripeWebhookEventDAL {
  private tableName: string;

  constructor() {
    this.tableName = `stripe_webhook_event_${process.env.STAGE!}`;
  }

  async getByEventId(stripe_event_id: string) {
    const postgresDB = await getPostgresConnection();
    const row = await postgresDB(this.tableName)
      .select('*')
      .where('stripe_event_id', stripe_event_id)
      .first();
    return (row ?? null) as z.infer<typeof StripeWebhookEventSchema> | null;
  }

  async insertIfNotExists(params: {
    stripe_event_id: string;
    event_type: string;
    related_object_id?: string | null;
  }) {
    const postgresDB = await getPostgresConnection();

    // Insert + ignore on conflict for dedupe
    await postgresDB(this.tableName)
      .insert({
        stripe_event_id: params.stripe_event_id,
        event_type: params.event_type,
        related_object_id: params.related_object_id ?? null,
        processed: false,
        created_at: new Date().toISOString(),
      })
      .onConflict('stripe_event_id')
      .ignore();

    return this.getByEventId(params.stripe_event_id);
  }

  async markProcessed(stripe_event_id: string) {
    const postgresDB = await getPostgresConnection();
    await postgresDB(this.tableName).where('stripe_event_id', stripe_event_id).update({
      processed: true,
      processed_at: new Date().toISOString(),
    });
  }
}
