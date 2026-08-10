// Canonical mapping from Supabase/GoTrue error surfaces to safe, specific
// user-facing copy. Keep this table narrow — every unknown code collapses
// to a generic "please try again" so we never leak internal states.
//
// Return shape:
//   { code, message, action } where `action` is a one-word hint for the UI
//   (retry | reset | contact_support | verify_email | sign_in) so pages
//   can render a matching CTA.

export type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "session_expired"
  | "invalid_link"
  | "user_suspended"
  | "user_deleted"
  | "missing_role"
  | "rate_limited"
  | "network_error"
  | "generic";

export type MappedAuthError = {
  code: AuthErrorCode;
  message: string;
  action: "retry" | "reset" | "contact_support" | "verify_email" | "sign_in";
};

const COPY: Record<AuthErrorCode, MappedAuthError> = {
  invalid_credentials: {
    code: "invalid_credentials",
    message: "That email and password don't match. Try again, or reset your password.",
    action: "reset",
  },
  email_not_confirmed: {
    code: "email_not_confirmed",
    message: "Your email isn't confirmed yet. Check your inbox for the confirmation link.",
    action: "verify_email",
  },
  session_expired: {
    code: "session_expired",
    message: "Your session expired. Please sign in again to continue.",
    action: "sign_in",
  },
  invalid_link: {
    code: "invalid_link",
    message: "This link has expired or was already used. Request a fresh one to continue.",
    action: "retry",
  },
  user_suspended: {
    code: "user_suspended",
    message: "This account is on hold. Contact support if you believe this is a mistake.",
    action: "contact_support",
  },
  user_deleted: {
    code: "user_deleted",
    message: "This account no longer exists. Create a new account to continue.",
    action: "sign_in",
  },
  missing_role: {
    code: "missing_role",
    message: "Your account isn't linked to a workspace role yet. Contact support to finish setup.",
    action: "contact_support",
  },
  rate_limited: {
    code: "rate_limited",
    message: "Too many attempts. Please wait a minute and try again.",
    action: "retry",
  },
  network_error: {
    code: "network_error",
    message: "Network issue. Check your connection and try again.",
    action: "retry",
  },
  generic: {
    code: "generic",
    message: "We couldn't complete that sign-in. Please try again.",
    action: "retry",
  },
};

/** Map a raw error/response into a safe, specific message. */
export function mapAuthError(err: unknown): MappedAuthError {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && typeof (err as { message?: unknown }).message === "string"
        ? String((err as { message: string }).message)
        : String(err ?? "");
  const raw = msg.toLowerCase();
  const status = (err as { status?: number } | null)?.status;

  if (status === 429 || raw.includes("rate limit") || raw.includes("over_email_send_rate_limit")) {
    return COPY.rate_limited;
  }
  if (raw.includes("invalid login credentials") || raw.includes("invalid_grant") || raw.includes("invalid_credentials")) {
    return COPY.invalid_credentials;
  }
  if (raw.includes("email not confirmed") || raw.includes("email_not_confirmed")) {
    return COPY.email_not_confirmed;
  }
  if (raw.includes("jwt expired") || raw.includes("session_not_found") || raw.includes("session expired") || raw.includes("token has expired")) {
    return COPY.session_expired;
  }
  if (
    raw.includes("otp_expired") ||
    raw.includes("otp expired") ||
    raw.includes("invalid otp") ||
    raw.includes("token is invalid") ||
    raw.includes("token has been used") ||
    raw.includes("recovery link") ||
    raw.includes("link is invalid") ||
    raw.includes("link expired") ||
    raw.includes("invalid_link")
  ) {
    return COPY.invalid_link;
  }
  if (raw.includes("user is suspended") || raw.includes("user_banned") || raw.includes("is_suspended") || raw.includes("banned")) {
    return COPY.user_suspended;
  }
  if (raw.includes("user_not_found") || raw.includes("user not found") || raw.includes("user was deleted")) {
    return COPY.user_deleted;
  }
  if (raw.includes("missing role") || raw.includes("missing_role") || raw.includes("no role assigned")) {
    return COPY.missing_role;
  }
  if (raw.includes("oauth provider unavailable") || raw.includes("missing oauth secret")) {
    return {
      code: "generic",
      message: "Google sign-in is temporarily unavailable. Use the email magic link above.",
      action: "sign_in",
    };
  }
  if (raw.includes("failed to fetch") || raw.includes("networkerror") || raw.includes("network request failed")) {
    return COPY.network_error;
  }
  return COPY.generic;
}

/** True when the error implies the user can click Retry productively. */
export function isRetryableAuthError(err: unknown): boolean {
  const m = mapAuthError(err);
  return m.action === "retry";
}
