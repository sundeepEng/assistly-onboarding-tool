import { z } from "zod";
import { getPostgresConnection } from "../utils/postgres-client";
import { getPayrollSchema } from "../models/HCM/user-payroll.model";

export class UserPayrollDAL {
  private tableName: string;

  constructor() {
    this.tableName = `user_payroll_${process.env.STAGE!}`;
  }

  async createUserPayroll(userPayrollData: Object) {
    try {
      const postgresDB = await getPostgresConnection();
      const result = await postgresDB(this.tableName)
        .insert(userPayrollData)
        .returning("*");

      return result;
    } catch (err) {
      console.error(
        `path: user-payroll.dal, method: createUserPayroll, error: ${err}`
      );
      throw err;
    }
  }

  async getPayrolls(filters?: z.infer<typeof getPayrollSchema>) {
    try {
      const postgresDB = await getPostgresConnection();
      const query = postgresDB(this.tableName).select("*");

      if (filters?.user_id) {
        if (Array.isArray(filters.user_id)) {
          query.whereIn("user_id", filters.user_id);
        } else {
          query.where("user_id", filters.user_id);
        }
      }

      if (filters?.pay_date) {
        query.where("pay_date", filters.pay_date);
      }

      if (filters?.payment_method) {
        if (Array.isArray(filters.payment_method)) {
          query.whereIn("payment_method", filters.payment_method);
        } else {
          query.where("payment_method", filters.payment_method);
        }
      }

      if (
        filters?.pay_period_start_date != null &&
        filters.pay_period_end_date != null
      ) {
        query.andWhere((builder) => {
          builder
            .where(
              "pay_period_start_date",
              "<",
              filters.pay_period_end_date as string
            )
            .andWhere(
              "pay_period_end_date",
              ">",
              filters.pay_period_start_date as string
            );
        });
      } else if (filters?.pay_period_start_date != null) {
        query.where(
          "pay_period_start_date",
          ">=",
          filters.pay_period_start_date
        );
      } else if (filters?.pay_period_end_date != null) {
        query.where("pay_period_end_date", "<=", filters.pay_period_end_date);
      }

      return await query.orderBy("created_at", "desc");
    } catch (err) {
      console.error(
        `path: user-payroll.dal, method: getPayrollByUserId, error: ${err}`
      );
      throw err;
    }
  }
}
