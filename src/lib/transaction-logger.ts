"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type TransactionAction =
  | "BOOKING_CREATED"
  | "ADVANCE_PAID"
  | "BALANCE_COLLECTED"
  | "BOOKING_COMPLETED"
  | "BOOKING_CANCELLED";

interface LogTransactionParams {
  bookingId: string;
  farmerId: string;
  action: TransactionAction;
  amount: number;
  paymentMethod?: string | null;
  performedBy: string;
  performerName?: string;
  performerRole?: string;
  metadata?: Record<string, any>;
}

/**
 * Centralized transaction logger.
 * Inserts an audit row into `transaction_logs` so Admin has a
 * full chronological record of every financial event.
 *
 * Uses the admin/service-role client so RLS doesn't block writes.
 * Failures are logged but never bubble up — we don't want a logging
 * issue to break the primary business flow.
 */
export async function logTransaction(params: LogTransactionParams): Promise<void> {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient.from("transaction_logs").insert({
      booking_id: params.bookingId,
      farmer_id: params.farmerId,
      action: params.action,
      amount: params.amount,
      payment_method: params.paymentMethod || null,
      performed_by: params.performedBy,
      performer_name: params.performerName || null,
      performer_role: params.performerRole || null,
      metadata: params.metadata || {},
    });

    if (error) {
      console.error("[logTransaction] Failed to insert transaction log:", error.message);
    }
  } catch (err: any) {
    // Never throw — audit logging must not break business flows
    console.error("[logTransaction] Unexpected error:", err?.message);
  }
}
