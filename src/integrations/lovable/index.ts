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

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
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
