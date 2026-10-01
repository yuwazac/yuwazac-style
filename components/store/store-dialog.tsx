"use client";

import type { ComponentPropsWithRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StoreDialogProps = ComponentPropsWithRef<"dialog"> & {
  title: string;
  titleId?: string;
  closeLabel: string;
  drawer?: boolean;
};

// Native showModal supplies focus trapping, Escape, and return to the opener.
// Keep the toolbar outside the scroll area so closing never requires scrolling.
export function StoreDialog({
  title,
  titleId,
  closeLabel,
  drawer = false,
  children,
  className,
  ...props
}: StoreDialogProps) {
  return (
    <dialog
      {...props}
      className={cn("store-dialog", drawer && "store-drawer", className)}
    >
      <div className="flex shrink-0 items-center justify-between gap-4 border-b px-5 py-3">
        <h2 id={titleId} tabIndex={-1} className="min-w-0 text-2xl">
          {title}
        </h2>
        <Button
          type="button"
          variant="ghost"
          aria-label={closeLabel}
          className="size-11 shrink-0 text-3xl"
          onClick={(event) => event.currentTarget.closest("dialog")?.close()}
        >
          ×
        </Button>
      </div>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-5 [overflow-wrap:anywhere]">
        {children}
      </div>
    </dialog>
  );
}
