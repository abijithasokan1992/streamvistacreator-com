import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

type SupportedOAuthProvider = "google" | "apple" | "microsoft";

/**
 * Compatibility wrapper retained so existing callers do not need to change.
 * OAuth is initiated directly through Supabase Auth instead of Lovable's
 * deprecated /~oauth/initiate route, which returns a 404 on custom domains.
 */
export const lovable = {
  auth: {
    signInWithOAuth: async (
      provider: SupportedOAuthProvider | "lovable",
      opts?: SignInOptions,
    ) => {
      if (provider === "lovable") {
        return {
          error: new Error("Lovable OAuth is not supported on this deployment."),
        };
      }

      // Production safety guard: the current Supabase Google provider is enabled
      // without a valid OAuth client secret. Calling /authorize in this state
      // navigates users to a raw 400 JSON response. Keep passwordless email auth
      // available and fail Google locally until the provider credentials are restored.
      if (provider === "google") {
        return {
          error: new Error("OAuth provider unavailable: missing OAuth secret for Google."),
          redirected: false,
        };
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as Parameters<typeof supabase.auth.signInWithOAuth>[0]["provider"],
        options: {
          redirectTo: opts?.redirect_uri,
          queryParams: opts?.extraParams,
          skipBrowserRedirect: false,
        },
      });

      return {
        data,
        error,
        redirected: Boolean(data?.url) && !error,
      };
    },
  },
};
