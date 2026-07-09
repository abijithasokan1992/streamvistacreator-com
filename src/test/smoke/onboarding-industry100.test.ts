import { describe, it, expect } from "vitest";
import {
  computeFinalPricePaise,
  PROMO_CODES,
  PLAN_BASE_INR,
  GST_RATE,
} from "../../../supabase/functions/_shared/pricing";

/**
 * Integration test for the onboarding payload flow with the INDUSTRY100 promo.
 *
 * Two stages, matching production:
 *   1. `OnboardingForm` inserts a row into `onboarding_requests` with
 *      base_price = final_price = plan.price (₹650 for the creator PAYG plan)
 *      and onboarding_status = "pending".
 *   2. `create-razorpay-order` re-reads that row, computes the authoritative
 *      price using the server-side `computeFinalPricePaise`, and updates the
 *      row's `final_price` (in rupees) to reflect the INDUSTRY100 10% discount
 *      plus 18% GST.
 *
 * We replay both stages against an in-memory fake of `supabase.from(...)` so
 * we can assert exactly which fields land on the created record.
 */

type OnboardingRow = {
  id: string;
  client_name: string;
  professional_role: string;
  business_email: string;
  selected_cycle: "free" | "creator" | "topup";
  base_price: number;
  final_price: number;
  promo_code: string | null;
  onboarding_status: string;
  payment_status: string;
  plan_type: string;
  razorpay_order_id: string | null;
  amount_paid_paise: number | null;
};

function makeFakeSupabase(store: Map<string, OnboardingRow>) {
  return {
    from(table: string) {
      if (table !== "onboarding_requests") {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        insert(row: OnboardingRow) {
          store.set(row.id, { ...row });
          return Promise.resolve({ data: null, error: null });
        },
        select() {
          return {
            eq: (_col: string, id: string) => ({
              single: () => {
                const row = store.get(id);
                return Promise.resolve(
                  row
                    ? { data: row, error: null }
                    : { data: null, error: { message: "not found" } },
                );
              },
            }),
          };
        },
        update(patch: Partial<OnboardingRow>) {
          return {
            eq: (_col: string, id: string) => {
              const existing = store.get(id);
              if (existing) store.set(id, { ...existing, ...patch });
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      };
    },
  };
}

async function submitOnboardingPayload(
  supabase: ReturnType<typeof makeFakeSupabase>,
  payload: {
    id: string;
    clientName: string;
    professionalRole: string;
    businessEmail: string;
    selectedCycle: "creator" | "topup" | "free";
    promoCode: string | null;
  },
) {
  // Mirror OnboardingForm's insert shape.
  const basePrice = PLAN_BASE_INR[
    payload.selectedCycle === "free" ? "creator" : payload.selectedCycle
  ];
  await supabase.from("onboarding_requests").insert({
    id: payload.id,
    client_name: payload.clientName,
    professional_role: payload.professionalRole,
    business_email: payload.businessEmail,
    selected_cycle: payload.selectedCycle,
    base_price: basePrice,
    final_price: basePrice,
    promo_code: payload.promoCode,
    onboarding_status: "pending",
    payment_status: "pending",
    plan_type: "paid",
    razorpay_order_id: null,
    amount_paid_paise: null,
  });
}

async function runServerAuthoritativePricing(
  supabase: ReturnType<typeof makeFakeSupabase>,
  onboardingId: string,
) {
  // Mirror create-razorpay-order: read row, compute price, patch row.
  const { data: row } = await supabase
    .from("onboarding_requests")
    .select()
    .eq("id", onboardingId)
    .single();
  if (!row) throw new Error("row missing");
  const priced = computeFinalPricePaise(
    row.selected_cycle as "creator" | "topup",
    row.promo_code,
  );
  await supabase
    .from("onboarding_requests")
    .update({
      final_price: priced.finalPaise / 100,
      amount_paid_paise: priced.finalPaise,
    })
    .eq("id", onboardingId);
  return priced;
}

describe("onboarding payload with INDUSTRY100 promo", () => {
  it("registers the promo code in the price table", () => {
    expect(PROMO_CODES.INDUSTRY100).toBe(0.1);
  });

  it("creates a pending onboarding row and applies the discounted final price", async () => {
    const store = new Map<string, OnboardingRow>();
    const supabase = makeFakeSupabase(store);
    const onboardingId = "11111111-1111-1111-1111-111111111111";

    await submitOnboardingPayload(supabase, {
      id: onboardingId,
      clientName: "Crayons Pictures",
      professionalRole: "Production Studio",
      businessEmail: "hello@crayons.test",
      selectedCycle: "creator",
      promoCode: "INDUSTRY100",
    });

    // Stage 1 — row inserted from the form.
    const inserted = store.get(onboardingId)!;
    expect(inserted).toBeDefined();
    expect(inserted.base_price).toBe(650);
    expect(inserted.final_price).toBe(650);
    expect(inserted.promo_code).toBe("INDUSTRY100");
    expect(inserted.onboarding_status).toBe("pending");

    // Stage 2 — server-authoritative pricing applies the INDUSTRY100 discount.
    const priced = await runServerAuthoritativePricing(supabase, onboardingId);
    const expectedSubtotal = Math.round(650 * (1 - 0.1)); // 585
    const expectedGst = Math.round(expectedSubtotal * GST_RATE); // 105
    const expectedFinal = expectedSubtotal + expectedGst; // 690
    expect(priced.promoValid).toBe(true);
    expect(priced.finalPaise).toBe(expectedFinal * 100);

    const updated = store.get(onboardingId)!;
    expect(updated.base_price).toBe(650); // untouched
    expect(updated.final_price).toBe(expectedFinal);
    expect(updated.promo_code).toBe("INDUSTRY100");
    expect(updated.onboarding_status).toBe("pending"); // stays pending until payment
    expect(updated.amount_paid_paise).toBe(expectedFinal * 100);
  });

  it("leaves final_price at base_price when no promo code is submitted", async () => {
    const store = new Map<string, OnboardingRow>();
    const supabase = makeFakeSupabase(store);
    const onboardingId = "22222222-2222-2222-2222-222222222222";

    await submitOnboardingPayload(supabase, {
      id: onboardingId,
      clientName: "Solo Editor",
      professionalRole: "Editor",
      businessEmail: "solo@editor.test",
      selectedCycle: "creator",
      promoCode: null,
    });
    const priced = await runServerAuthoritativePricing(supabase, onboardingId);

    const expectedFinal = 650 + Math.round(650 * GST_RATE); // 650 + 117 = 767
    expect(priced.promoValid).toBe(false);
    const row = store.get(onboardingId)!;
    expect(row.base_price).toBe(650);
    expect(row.final_price).toBe(expectedFinal);
    expect(row.promo_code).toBeNull();
    expect(row.onboarding_status).toBe("pending");
  });

  it("rejects an unknown promo code without discounting", async () => {
    const store = new Map<string, OnboardingRow>();
    const supabase = makeFakeSupabase(store);
    const onboardingId = "33333333-3333-3333-3333-333333333333";

    await submitOnboardingPayload(supabase, {
      id: onboardingId,
      clientName: "Bogus Buyer",
      professionalRole: "Other",
      businessEmail: "bogus@test.test",
      selectedCycle: "creator",
      promoCode: "NOT_A_REAL_CODE",
    });
    const priced = await runServerAuthoritativePricing(supabase, onboardingId);
    expect(priced.promoValid).toBe(false);
    const row = store.get(onboardingId)!;
    expect(row.final_price).toBe(650 + Math.round(650 * GST_RATE));
    expect(row.promo_code).toBe("NOT_A_REAL_CODE");
    expect(row.onboarding_status).toBe("pending");
  });
});
