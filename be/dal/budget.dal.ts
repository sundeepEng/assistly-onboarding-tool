import { z } from 'zod';
import { getPostgresConnection } from '../utils/postgres-client';
import { CreateBudgetSchema, UpdateBudgetSchema } from '../models/Payments/budget.model';

export class BudgetDAL {
  private budgetTableName: string;

  constructor() {
    this.budgetTableName = `budget_${process.env.STAGE!}`;
  }

  private getStartAndEndTimestamps(params: { start_date: string; end_date: string }) {
    const startTs = `${params.start_date}T00:00:00.000Z`;
    const endTs = `${params.end_date}T23:59:59.999Z`;
    return { startTs, endTs };
  }

  private async getBudgetSumByTransactionTypeCents(
    postgresDB: any,
    params: {
      home_id: string;
      start_date: string;
      end_date: string;
      transaction_type: 'income' | 'expense';
    }
  ): Promise<number> {
    const row = await postgresDB(this.budgetTableName)
      .where('home_id', params.home_id)
      .andWhere('transaction_type', params.transaction_type)
      .whereBetween('transaction_date', [params.start_date, params.end_date])
      .sum({ total: 'amount_cents' })
      .first();

    return Number((row as any)?.total ?? 0);
  }

  public async createBudget(budgetData: z.infer<typeof CreateBudgetSchema>) {
    try {
      const postgresDB = await getPostgresConnection();
      const [created] = await postgresDB(this.budgetTableName).insert(budgetData).returning('*');
      return created;
    } catch (error) {
      console.error(`path: budget.dal, method: createBudget, error: ${error}`);
      throw error;
    }
  }

  public async getAllBudgets(filters?: Partial<z.infer<typeof UpdateBudgetSchema>>) {
    try {
      const postgresDB = await getPostgresConnection();
      const query = postgresDB(this.budgetTableName).select('*');

      if (filters?.id) {
        Array.isArray(filters.id) ? query.whereIn('id', filters.id) : query.where('id', filters.id);
      }

      if (filters?.home_id) {
        Array.isArray(filters.home_id)
          ? query.whereIn('home_id', filters.home_id)
          : query.where('home_id', filters.home_id);
      }

      if (filters?.transaction_type) {
        Array.isArray(filters.transaction_type)
          ? query.whereIn('transaction_type', filters.transaction_type)
          : query.where('transaction_type', filters.transaction_type);
      }

      if (filters?.category_type) {
        Array.isArray(filters.category_type)
          ? query.whereIn('category_type', filters.category_type)
          : query.where('category_type', filters.category_type);
      }

      if (filters?.entry_mode) {
        Array.isArray(filters.entry_mode)
          ? query.whereIn('entry_mode', filters.entry_mode)
          : query.where('entry_mode', filters.entry_mode);
      }

      if (filters?.created_by_user_id) {
        Array.isArray(filters.created_by_user_id)
          ? query.whereIn('created_by_user_id', filters.created_by_user_id)
          : query.where('created_by_user_id', filters.created_by_user_id);
      }

      if (filters?.transaction_date != null) {
        const td = filters.transaction_date as unknown;
        if (Array.isArray(td)) query.whereBetween('transaction_date', [td[0] as any, td[1] as any]);
        else query.where('transaction_date', td as any);
      }

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
      console.error(`path: budget.dal, method: getAllBudgets, error: ${error}`);
      throw error;
    }
  }

  public async updateBudgetById(id: number, patch: Partial<z.infer<typeof UpdateBudgetSchema>>) {
    try {
      const postgresDB = await getPostgresConnection();
      const result = await postgresDB(this.budgetTableName)
        .where('id', id)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .returning('*');
      return result?.[0] ?? null;
    } catch (error) {
      console.error(`path: budget.dal, method: updateBudgetById, error: ${error}`);
      throw error;
    }
  }

  public async getBudgetDashboardAggregates(params: {
    home_id: string;
    start_date: string;
    end_date: string;
  }): Promise<{
    budget_income_cents: number;
    budget_expense_cents: number;
    invoice_income_cents: number;
    payroll_expense_cents: number;
  }> {
    try {
      const postgresDB = await getPostgresConnection();

      const [budgetIncomeCents, budgetExpenseCents, invoiceIncomeCents, payrollExpenseCents] =
        await Promise.all([
          this.getBudgetSumByTransactionTypeCents(postgresDB, {
            ...params,
            transaction_type: 'income',
          }),
          this.getBudgetSumByTransactionTypeCents(postgresDB, {
            ...params,
            transaction_type: 'expense',
          }),
          this.getPaidInvoiceIncomeCents(params, postgresDB),
          this.getPaidPayrollExpenseCents(params, postgresDB),
        ]);

      return {
        budget_income_cents: budgetIncomeCents,
        budget_expense_cents: budgetExpenseCents,
        invoice_income_cents: invoiceIncomeCents,
        payroll_expense_cents: payrollExpenseCents,
      };
    } catch (error) {
      console.error(`path: budget.dal, method: getBudgetDashboardAggregates, error: ${error}`);
      throw error;
    }
  }

  public async getPaidInvoiceIncomeCents(
    params: {
      home_id: string;
      start_date: string;
      end_date: string;
    },
    postgresDBOverride?: any
  ): Promise<number> {
    try {
      const postgresDB = postgresDBOverride ?? (await getPostgresConnection());
      const paymentTableName = `payment_${process.env.STAGE!}`;
      const invoiceTableName = `invoice_${process.env.STAGE!}`;
      const { startTs, endTs } = this.getStartAndEndTimestamps(params);

      const row = await postgresDB(paymentTableName)
        .innerJoin(invoiceTableName, `${invoiceTableName}.id`, `${paymentTableName}.subject_id`)
        .where(`${paymentTableName}.subject_type`, 'INVOICE')
        .andWhere(`${paymentTableName}.status`, 'PAID')
        .andWhere(`${invoiceTableName}.home_id`, params.home_id)
        .whereRaw(
          `COALESCE(${paymentTableName}.manual_paid_at, ${paymentTableName}.updated_at, ${paymentTableName}.created_at) BETWEEN ? AND ?`,
          [startTs, endTs]
        )
        .sum({ total: `${paymentTableName}.amount_cents` })
        .first();

      return Number((row as any)?.total ?? 0);
    } catch (error) {
      console.error(`path: budget.dal, method: getPaidInvoiceIncomeCents, error: ${error}`);
      throw error;
    }
  }

  public async getPaidPayrollExpenseCents(
    params: {
      home_id: string;
      start_date: string;
      end_date: string;
    },
    postgresDBOverride?: any
  ): Promise<number> {
    try {
      const postgresDB = postgresDBOverride ?? (await getPostgresConnection());
      const paymentTableName = `payment_${process.env.STAGE!}`;
      const payoutTableName = `payout_${process.env.STAGE!}`;
      const { startTs, endTs } = this.getStartAndEndTimestamps(params);

      const row = await postgresDB(paymentTableName)
        .innerJoin(payoutTableName, `${payoutTableName}.id`, `${paymentTableName}.subject_id`)
        .where(`${paymentTableName}.subject_type`, 'PAYROLL_PAYOUT')
        .andWhere(`${paymentTableName}.status`, 'PAID')
        .andWhere(`${payoutTableName}.home_id`, params.home_id)
        .whereRaw(
          `COALESCE(${paymentTableName}.manual_paid_at, ${paymentTableName}.updated_at, ${paymentTableName}.created_at) BETWEEN ? AND ?`,
          [startTs, endTs]
        )
        .sum({ total: `${paymentTableName}.amount_cents` })
        .first();

      return Number((row as any)?.total ?? 0);
    } catch (error) {
      console.error(`path: budget.dal, method: getPaidPayrollExpenseCents, error: ${error}`);
      throw error;
    }
  }

  public async getBudgetSumsByTransactionTypeAndCategory(params: {
    home_id: string;
    start_date: string;
    end_date: string;
    transaction_type: 'income' | 'expense';
  }): Promise<Record<string, number>> {
    try {
      const postgresDB = await getPostgresConnection();

      const rows = await postgresDB(this.budgetTableName)
        .select('category_type')
        .sum({ total: 'amount_cents' })
        .where('home_id', params.home_id)
        .andWhere('transaction_type', params.transaction_type)
        .whereBetween('transaction_date', [params.start_date, params.end_date])
        .groupBy('category_type');

      const out: Record<string, number> = {};
      for (const r of rows as any[]) {
        out[String(r.category_type)] = Number(r.total ?? 0);
      }
      return out;
    } catch (error) {
      console.error(
        `path: budget.dal, method: getBudgetSumsByTransactionTypeAndCategory, error: ${error}`
      );
      throw error;
    }
  }

  public async getPaidInvoiceItemSumsByCategory(params: {
    home_id: string;
    start_date: string;
    end_date: string;
  }): Promise<Record<string, number>> {
    try {
      const postgresDB = await getPostgresConnection();

      const paymentTableName = `payment_${process.env.STAGE!}`;
      const invoiceTableName = `invoice_${process.env.STAGE!}`;
      const invoiceItemTableName = `invoice_item_${process.env.STAGE!}`;

      const startTs = `${params.start_date}T00:00:00.000Z`;
      const endTs = `${params.end_date}T23:59:59.999Z`;

      // invoice_item.amount appears to be stored as dollars (decimal). Convert to cents.
      const rows = await postgresDB(paymentTableName)
        .innerJoin(invoiceTableName, `${invoiceTableName}.id`, `${paymentTableName}.subject_id`)
        .innerJoin(
          invoiceItemTableName,
          `${invoiceItemTableName}.invoice_id`,
          `${invoiceTableName}.id`
        )
        .where(`${paymentTableName}.subject_type`, 'INVOICE')
        .andWhere(`${paymentTableName}.status`, 'PAID')
        .andWhere(`${invoiceTableName}.home_id`, params.home_id)
        .whereRaw(
          `COALESCE(${paymentTableName}.manual_paid_at, ${paymentTableName}.updated_at, ${paymentTableName}.created_at) BETWEEN ? AND ?`,
          [startTs, endTs]
        )
        .select(`${invoiceItemTableName}.item_category as item_category`)
        .sum({ total_dollars: `${invoiceItemTableName}.amount` })
        .groupBy(`${invoiceItemTableName}.item_category`);

      const out: Record<string, number> = {};
      for (const r of rows as any[]) {
        const cents = Math.round(Number(r.total_dollars ?? 0) * 100);
        out[String(r.item_category)] = cents;
      }

      return out;
    } catch (error) {
      console.error(`path: budget.dal, method: getPaidInvoiceItemSumsByCategory, error: ${error}`);
      throw error;
    }
  }
}
