"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function GoalSelector({
  goals,
  activeId,
  onSelect,
  onNew,
  onDelete,
  deleting,
}: {
  goals: { id: string; title: string; isPrimary: boolean }[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: () => void;
  deleting?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {goals.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => onSelect(g.id)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs transition-colors",
            g.id === activeId
              ? "border-primary/50 bg-primary/15 text-foreground"
              : "border-white/10 text-muted-foreground hover:border-white/20"
          )}
        >
          {g.title}
          {g.isPrimary ? " · Ana" : ""}
        </button>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={onNew}>
        <Plus className="mr-1 h-3.5 w-3.5" />
        Yeni hedef
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-negative hover:bg-negative/10 hover:text-negative"
        disabled={deleting || !activeId}
        onClick={onDelete}
      >
        <Trash2 className="mr-1 h-3.5 w-3.5" />
        {deleting ? "Siliniyor…" : "Hedefi sil"}
      </Button>
    </div>
  );
}
