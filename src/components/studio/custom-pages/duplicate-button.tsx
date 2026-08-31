"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { duplicateCustomPage } from "@/actions/custom-pages";
import { Button } from "@/components/ui/button";

/**
 * Copy a landing page, and go straight to the copy.
 *
 * The owner's next move after duplicating is always to edit — nobody
 * duplicates a page and then looks at a list — so this navigates rather than
 * refreshing in place and leaving them to find the new row.
 */
export function DuplicatePageButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function duplicate() {
    setBusy(true);
    const res = await duplicateCustomPage(id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Copied. This one is a draft until you publish it.");
    if (res.data) router.push(`/studio/custom-pages/${res.data.id}`);
  }

  return (
    <Button variant="ghost" size="sm" onClick={duplicate} disabled={busy}>
      {busy ? (
        <Loader2 aria-hidden className="size-4 animate-spin" />
      ) : (
        <Copy aria-hidden className="size-4" />
      )}
      <span className="sr-only">Duplicate {title}</span>
    </Button>
  );
}
