"use client";

import { Columns3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import type { ColumnDef } from "@/lib/column-visibility";

/**
 * "Columns" control for a studio list table (10 remnants: "no column
 * controls"). `tableKey` scopes the choice in `localStorage` — use a name
 * stable across deploys (`"products"`, `"inquiries"`), never a value that
 * changes per render.
 *
 * The menu only toggles visibility; it never reorders or resizes. Consumers
 * read back `isVisible(column.key)` from `useColumnVisibility(tableKey,
 * columns)` to decide whether to render each `<th>`/`<td>` pair — this
 * component and the hook it wraps are the only two places that know the
 * storage key exists.
 */
export function ColumnsMenu({
  tableKey,
  columns,
}: {
  tableKey: string;
  columns: readonly ColumnDef[];
}) {
  const { isVisible, toggle } = useColumnVisibility(tableKey, columns);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="min-h-11">
          <Columns3 aria-hidden strokeWidth={1.5} /> Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.key}
            checked={isVisible(column.key)}
            onCheckedChange={() => toggle(column.key)}
            onSelect={(event) => event.preventDefault()}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
