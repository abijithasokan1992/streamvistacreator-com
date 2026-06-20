// UI-only helper to hide E2E test accounts from standard ops views.
// Does NOT modify DB. Demo/showcase tenants are NOT matched here.
export function isE2eEmail(email?: string | null): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  return (
    e.startsWith("e2e-") ||
    e.startsWith("e2e+") ||
    e.includes("+e2e@") ||
    e.endsWith("@e2e.test") ||
    e.endsWith(".e2e.local")
  );
}

const KEY = "admin.showE2eAccounts";
export function getShowE2e(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}
export function setShowE2e(v: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, v ? "1" : "0");
}
