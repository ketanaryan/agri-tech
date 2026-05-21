import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { amount, customer_phone, customer_name, customer_email, receipt, notes } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const environment = process.env.CASHFREE_ENVIRONMENT || "SANDBOX";
    const baseUrl =
      environment === "PRODUCTION"
        ? "https://api.cashfree.com/pg/orders"
        : "https://sandbox.cashfree.com/pg/orders";

    if (!appId || !secretKey) {
      console.error("Cashfree credentials missing from .env.local");
      return NextResponse.json(
        {
          error:
            "Cashfree API keys are not configured. Please add CASHFREE_APP_ID and CASHFREE_SECRET_KEY to your .env.local file.",
        },
        { status: 500 }
      );
    }

    const orderId =
      receipt || `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const cashfreePayload = {
      order_id: orderId,
      order_amount: amount,
      order_currency: "INR",
      customer_details: {
        customer_id: user.id.replace(/-/g, "").slice(0, 50),
        customer_phone: customer_phone || "9999999999",
        customer_name: customer_name || "Guest",
        customer_email: customer_email || "guest@example.com",
      },
      order_meta: {
        return_url: `${
          process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
        }/payment-return?order_id={order_id}`,
      },
      order_note: JSON.stringify(notes || {}),
    };

    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "x-api-version": "2023-08-01",
        "x-client-id": appId,
        "x-client-secret": secretKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(cashfreePayload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Cashfree API Error:", responseData);
      // Cashfree returns { message, type, code } on errors
      const friendlyMsg =
        responseData.message ||
        responseData.error ||
        "Failed to create Cashfree order";

      // Authentication errors
      if (
        response.status === 401 ||
        (typeof friendlyMsg === "string" &&
          friendlyMsg.toLowerCase().includes("authentication"))
      ) {
        return NextResponse.json(
          {
            error:
              "Cashfree authentication failed. Your CASHFREE_APP_ID or CASHFREE_SECRET_KEY is invalid. Please update your .env.local with valid Cashfree sandbox credentials from https://merchant.cashfree.com/",
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: friendlyMsg },
        { status: response.status }
      );
    }

    return NextResponse.json({
      paymentSessionId: responseData.payment_session_id,
      orderId: responseData.order_id,
      amount: responseData.order_amount,
    });
  } catch (err: any) {
    console.error("[/api/cashfree/create-order]", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to create order" },
      { status: 500 }
    );
  }
}
