"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { clientFetch } from "@/lib/api/client-fetch";

interface RefreshResult {
  processed: number;
  status: string;
  errors: string[];
  portfolios: number;
}

export function RefreshPricesButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRefresh() {
    setLoading(true);
    try {
      const res = await clientFetch<RefreshResult>("/api/prices/refresh", {
        method: "POST",
      });
      if (res.errors?.length) {
        toast.warning(
          `${res.processed} fiyat güncellendi, ${res.errors.length} varlıkta sorun oldu.`
        );
      } else {
        toast.success(`${res.processed} varlık fiyatı güncellendi.`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Güncelleme başarısız.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={loading}
      className="gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Güncelleniyor…" : "Fiyatları Güncelle"}
    </Button>
  );
}
