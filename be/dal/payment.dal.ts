import { z } from 'zod';
import { CreatePaymentSchema, UpdatePaymentSchema } from '../models/Payments/payment.model';
import { getPostgresConnection } from '../utils/postgres-client';

export class PaymentDAL {
  private paymentTableName: string;

  constructor() {
    this.paymentTableName = `payment_${process.env.STAGE!}`;
  }

  public async createPayment(paymentData: z.infer<typeof CreatePaymentSchema>) {
    try {
      const postgresDB = await getPostgresConnection();
      const [createdPayment] = await postgresDB(this.paymentTableName)
        .insert(paymentData)
        .returning('*');

      return createdPayment;
    } catch (error) {
      console.error(`path: payment.dal, method: createPayment, error: ${error}`);
      throw error;
    }
  }

  async getPaymentByIdempotencyKey(idempotency_key: string) {
    try {
      const postgresDB = await getPostgresConnection();
      const result = await postgresDB(this.paymentTableName)
        .select('*')
        .where('idempotency_key', idempotency_key)
        .first();
      return result ?? null;
    } catch (error) {
      console.error(`path: payment.dal, method: getPaymentByIdempotencyKey, error: ${error}`);
      throw error;
    }
  }

  async updatePaymentByPaymentId(
    payment_id: string,
    patch: Partial<z.infer<typeof UpdatePaymentSchema>>
  ) {
    try {
      const postgresDB = await getPostgresConnection();
      const result = await postgresDB(this.paymentTableName)
        .where('payment_id', payment_id)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .returning('*');
      return result?.[0] ?? null;
    } catch (error) {
      console.error(`path: payment.dal, method: updatePaymentByPaymentId, error: ${error}`);
      throw error;
    }
  }

  async updatePaymentById(id: number, patch: Partial<z.infer<typeof UpdatePaymentSchema>>) {
    try {
      const postgresDB = await getPostgresConnection();
      const result = await postgresDB(this.paymentTableName)
        .where('id', id)
        .update({ ...patch })
        .returning('*');
      return result?.[0] ?? null;
    } catch (error) {
      console.error(`path: payment.dal, method: updatePaymentById, error: ${error}`);
      throw error;
    }
  }

  async getPaymentByPaymentId(payment_id: string) {
    try {
      const postgresDB = await getPostgresConnection();
      const result = await postgresDB(this.paymentTableName)
        .select('*')
        .where('payment_id', payment_id)
        .first();
      return result ?? null;
    } catch (error) {
      console.error(`path: payment.dal, method: getPaymentByPaymentId, error: ${error}`);
      throw error;
    }
  }

  async getPaymentByStripePaymentIntentId(stripe_payment_intent_id: string) {
    try {
      const postgresDB = await getPostgresConnection();
      const result = await postgresDB(this.paymentTableName)
        .select('*')
        .where('stripe_payment_intent_id', stripe_payment_intent_id)
        .first();
      return result ?? null;
    } catch (error) {
      console.error(
        `path: payment.dal, method: getPaymentByStripePaymentIntentId, error: ${error}`
      );
      throw error;
    }
  }

  async getPaymentByStripeCheckoutSessionId(stripe_checkout_session_id: string) {
    try {
      const postgresDB = await getPostgresConnection();
      const result = await postgresDB(this.paymentTableName)
        .select('*')
        .where('stripe_checkout_session_id', stripe_checkout_session_id)
        .first();
      return result ?? null;
    } catch (error) {
      console.error(
        `path: payment.dal, method: getPaymentByStripeCheckoutSessionId, error: ${error}`
      );
      throw error;
    }
  }

  async getAllPayments(filters?: Partial<z.infer<typeof UpdatePaymentSchema>>) {
    try {
      const postgresDB = await getPostgresConnection();
      const query = postgresDB(this.paymentTableName).select('*');

      // -------------------------
      // Common identifiers
      // -------------------------

      if (filters?.id) {
        Array.isArray(filters.id) ? query.whereIn('id', filters.id) : query.where('id', filters.id);
      }

      if (filters?.payment_id) {
        Array.isArray(filters.payment_id)
          ? query.whereIn('payment_id', filters.payment_id)
          : query.where('payment_id', filters.payment_id);
      }

      if (filters?.subject_type) {
        Array.isArray(filters.subject_type)
          ? query.whereIn('subject_type', filters.subject_type)
          : query.where('subject_type', filters.subject_type);
      }

      if (filters?.subject_id != null) {
        const subjectId = filters.subject_id as unknown;
        if (Array.isArray(subjectId)) query.whereIn('subject_id', subjectId as any[]);
        else query.where('subject_id', subjectId as any);
      }

      if (filters?.payer_user_id) {
        Array.isArray(filters.payer_user_id)
          ? query.whereIn('payer_user_id', filters.payer_user_id)
          : query.where('payer_user_id', filters.payer_user_id);
      }

      if (filters?.payee_user_id) {
        Array.isArray(filters.payee_user_id)
          ? query.whereIn('payee_user_id', filters.payee_user_id)
          : query.where('payee_user_id', filters.payee_user_id);
      }

      // -------------------------
      // Status / provider
      // -------------------------
      if (filters?.provider) {
        Array.isArray(filters.provider)
          ? query.whereIn('provider', filters.provider)
          : query.where('provider', filters.provider);
      }

      if (filters?.status) {
        Array.isArray(filters.status)
          ? query.whereIn('status', filters.status)
          : query.where('status', filters.status);
      }

      // -------------------------
      // Manual fields
      // -------------------------
      if (filters?.manual_method) {
        Array.isArray(filters.manual_method)
          ? query.whereIn('manual_method', filters.manual_method)
          : query.where('manual_method', filters.manual_method);
      }

      if (filters?.created_by_user_id) {
        Array.isArray(filters.created_by_user_id)
          ? query.whereIn('created_by_user_id', filters.created_by_user_id)
          : query.where('created_by_user_id', filters.created_by_user_id);
      }

      // -------------------------
      // Date filters (optional)
      // -------------------------
      if (filters?.created_at != null) {
        const createdAt = filters.created_at as unknown;
        if (Array.isArray(createdAt)) {
          query.whereBetween('created_at', [createdAt[0] as any, createdAt[1] as any]);
        } else {
          query.where('created_at', createdAt as any);
        }
      }

      if (filters?.updated_at != null) {
        const updatedAt = filters.updated_at as unknown;
        if (Array.isArray(updatedAt)) {
          query.whereBetween('updated_at', [updatedAt[0] as any, updatedAt[1] as any]);
        } else {
          query.where('updated_at', updatedAt as any);
        }
      }

      return await query.orderBy('updated_at', 'desc');
    } catch (error) {
      console.error(`path: payment.dal, method: getAllPayments, error: ${error}`);
      throw error;
    }
  }
}
