"use client";

import { useState } from "react";

import {
  OccasionSelect,
  OptionPicker,
  PersonalizationText,
  QuantityStepper,
} from "@/components/storefront/customization-controls";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/storefront/dialog";
import { FilterChip } from "@/components/storefront/filter-chip";
import { ReferenceImageUploader } from "@/components/storefront/reference-image-uploader";
import { toast } from "@/components/storefront/toast";
import { Button } from "@/components/storefront/button";

/**
 * Client-side demo islands for the kitchen sink — local state only, so the
 * page itself stays a server component. DEV-ONLY (see page.tsx guard).
 */

export function CustomizationDemo() {
  const [size, setSize] = useState("md");
  const [shape, setShape] = useState("hex");
  const [text, setText] = useState("A & R · 14.02.2026");
  const [occasion, setOccasion] = useState("anniversary");
  const [qty, setQty] = useState(1);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <OptionPicker
        label="Size"
        name="demo-size"
        options={[
          { value: "sm", label: "Small · 15 cm" },
          { value: "md", label: "Medium · 20 cm" },
          { value: "lg", label: "Large · 30 cm" },
        ]}
        value={size}
        onChange={setSize}
      />
      <OptionPicker
        label="Shape"
        name="demo-shape"
        options={[
          { value: "round", label: "Round" },
          { value: "hex", label: "Hexagon" },
          { value: "free", label: "Freeform" },
        ]}
        value={shape}
        onChange={setShape}
      />
      <PersonalizationText
        label="Personalization"
        name="demo-personalization"
        maxLength={40}
        value={text}
        onChange={setText}
        hint="Names, initials, or a date — cast into the piece."
      />
      <div className="grid gap-6">
        <OccasionSelect value={occasion} onChange={setOccasion} />
        <QuantityStepper value={qty} onChange={setQty} min={1} max={9} />
      </div>
    </div>
  );
}

export function FilterChipsDemo() {
  const [selected, setSelected] = useState<string[]>(["Coasters"]);
  const all = ["Coasters", "Trays", "Wall art", "Jewelry", "Under ₹2,000"];
  return (
    <div className="flex flex-wrap gap-2">
      {all.map((label) => (
        <FilterChip
          key={label}
          label={label}
          selected={selected.includes(label)}
          removable={selected.includes(label)}
          onToggle={() =>
            setSelected((prev) =>
              prev.includes(label)
                ? prev.filter((l) => l !== label)
                : [...prev, label],
            )
          }
        />
      ))}
    </div>
  );
}

export function UploaderDemo() {
  return <ReferenceImageUploader maxFiles={5} />;
}

export function OverlayDemo() {
  return (
    <div className="flex flex-wrap gap-4">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="secondary">Open dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Made to order</DialogTitle>
            <DialogDescription>
              Every piece is poured for you — allow 7–10 days before dispatch.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button>Understood</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button
        variant="ghost"
        onClick={() => toast.success("Opening WhatsApp…")}
      >
        Fire toast
      </Button>
    </div>
  );
}
