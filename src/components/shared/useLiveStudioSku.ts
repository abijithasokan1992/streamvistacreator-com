import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { VaultProduct } from "@/lib/studioVault";

/**
 * Single live self-serve storage SKU (1 TB Studio Storage).
 * Shared between Studio and Creator surfaces so there is exactly one
 * commercial entry point and one purchase flow.
 */
export function useLiveStudioSku() {
  const [product, setProduct] = useState<VaultProduct | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("studio_vault_products_public" as any)
        .select("*")
        .eq("visible", true)
        .eq("self_serve_enabled", true)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) {
        const p = data as unknown as VaultProduct;
        setProduct({
          ...p,
          default_tb_options: Array.isArray(p.default_tb_options) ? p.default_tb_options : [1],
          billing_modes: Array.isArray(p.billing_modes) ? p.billing_modes : ["monthly"],
          features: Array.isArray(p.features) ? p.features : [],
        });
      }
    })();
  }, []);
  return product;
}
