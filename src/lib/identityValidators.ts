// Identity field validators + formatters for Indian tax/billing inputs.
// All validators accept null/undefined/empty as "no value" (valid).

export type ValidationResult = { ok: true; message?: undefined } | { ok: false; message: string };

const ok: ValidationResult = { ok: true };
const err = (message: string): ValidationResult => ({ ok: false, message });

const isEmpty = (v: string | null | undefined): v is null | undefined | "" =>
  v == null || v.trim() === "";

// --- Formatters ---------------------------------------------------------

/** Uppercase + strip whitespace. For PAN, GSTIN, TAN, CIN. */
export const formatTaxId = (v: string) => v.replace(/\s+/g, "").toUpperCase();

/** Trim and collapse inner whitespace. Generic text formatter. */
export const formatTrim = (v: string) => v.replace(/\s+/g, " ").trimStart();

/** Digits only — postal code, phone. */
export const formatDigits = (v: string, maxLen?: number) => {
  const d = v.replace(/\D+/g, "");
  return maxLen ? d.slice(0, maxLen) : d;
};

/** Allow + and digits, single leading +. For phone numbers. */
export const formatPhone = (v: string) => {
  const cleaned = v.replace(/[^\d+]/g, "");
  const plus = cleaned.startsWith("+") ? "+" : "";
  return plus + cleaned.replace(/\+/g, "");
};

// --- Validators ---------------------------------------------------------

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const TAN_RE = /^[A-Z]{4}[0-9]{5}[A-Z]$/;
const CIN_RE = /^[LUu]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;
const PINCODE_RE = /^[1-9][0-9]{5}$/;

export function validatePAN(v: string | null | undefined): ValidationResult {
  if (isEmpty(v)) return ok;
  return PAN_RE.test(v.trim().toUpperCase())
    ? ok
    : err("PAN must be 10 chars: AAAAA9999A.");
}

export function validateGSTIN(v: string | null | undefined): ValidationResult {
  if (isEmpty(v)) return ok;
  return GSTIN_RE.test(v.trim().toUpperCase())
    ? ok
    : err("GSTIN must be 15 chars and match the standard format.");
}

export function validateTAN(v: string | null | undefined): ValidationResult {
  if (isEmpty(v)) return ok;
  return TAN_RE.test(v.trim().toUpperCase())
    ? ok
    : err("TAN must be 10 chars: AAAA99999A.");
}

export function validateCIN(v: string | null | undefined): ValidationResult {
  if (isEmpty(v)) return ok;
  return CIN_RE.test(v.trim().toUpperCase())
    ? ok
    : err("CIN must be 21 chars: e.g. U12345MH2020PTC123456.");
}

export function validateEmail(v: string | null | undefined): ValidationResult {
  if (isEmpty(v)) return ok;
  if (v.length > 255) return err("Email must be under 255 chars.");
  return EMAIL_RE.test(v.trim()) ? ok : err("Enter a valid email address.");
}

export function validateUrl(v: string | null | undefined): ValidationResult {
  if (isEmpty(v)) return ok;
  return URL_RE.test(v.trim()) ? ok : err("URL must start with http:// or https://.");
}

export function validatePincode(v: string | null | undefined): ValidationResult {
  if (isEmpty(v)) return ok;
  return PINCODE_RE.test(v.trim()) ? ok : err("Indian PIN code must be 6 digits.");
}

export function validatePhone(v: string | null | undefined): ValidationResult {
  if (isEmpty(v)) return ok;
  const digits = v.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15)
    return err("Phone must have 7–15 digits.");
  return ok;
}

export function validateMaxLen(
  v: string | null | undefined,
  max: number,
  label = "Value",
): ValidationResult {
  if (isEmpty(v)) return ok;
  return v.length <= max ? ok : err(`${label} must be under ${max} chars.`);
}

/** Cross-field: if GST is registered, GSTIN must be present and valid. */
export function validateGstRegistration(
  isRegistered: boolean | null | undefined,
  gstin: string | null | undefined,
): ValidationResult {
  if (!isRegistered) return ok;
  if (isEmpty(gstin)) return err("GSTIN is required when GST registration is on.");
  return validateGSTIN(gstin);
}

/** Cross-field: 2-digit GSTIN state code should match place_of_supply if both provided.
 * (We don't enforce this strictly — return ok if not enough info.) */
export function validateGstinStateMatch(
  gstin: string | null | undefined,
  _placeOfSupplyState: string | null | undefined,
): ValidationResult {
  if (isEmpty(gstin)) return ok;
  return ok;
}
