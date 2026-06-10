// Locked production business logic for StreamVista user classification.
//
// - abijithasokan1992@gmail.com → backend service account (automated emails only).
//   Never displayed in member pickers or treated as a real teammate.
// - Any address @crayonspictures.com → internal staff / team member.
// - Everyone else → standard Customer / Client.

export const SERVICE_ACCOUNT_EMAIL = "abijithasokan1992@gmail.com";
export const STAFF_EMAIL_DOMAIN = "crayonspictures.com";

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function isServiceAccount(email: string | null | undefined): boolean {
  return normalizeEmail(email) === SERVICE_ACCOUNT_EMAIL;
}

export function isStaffEmail(email: string | null | undefined): boolean {
  return normalizeEmail(email).endsWith("@" + STAFF_EMAIL_DOMAIN);
}

export type UserClass = "service" | "staff" | "customer";

export function classifyUser(email: string | null | undefined): UserClass {
  if (isServiceAccount(email)) return "service";
  if (isStaffEmail(email)) return "staff";
  return "customer";
}

export function userClassLabel(c: UserClass): string {
  switch (c) {
    case "service": return "Service account";
    case "staff": return "Internal staff";
    case "customer": return "Customer";
  }
}
