"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PasswordFieldProps {
  id: string;
  name: string;
  label: string;
  autoComplete?: "current-password" | "new-password";
  required?: boolean;
  placeholder?: string;
  /** §12.1 — the login screen wants the Caps Lock hint; the reset forms don't. */
  capsLockHint?: boolean;
  disabled?: boolean;
}

/**
 * Password input with an inline show/hide toggle — §12.1.
 *
 * The Caps Lock hint reads `getModifierState` off the key event rather than
 * tracking keyup/keydown pairs, so it is correct when the field is focused
 * with Caps already on and it never needs an effect to stay in sync. It is a
 * `role="status"`, not an error: it is advice, and it must not steal the
 * announcement queue from the sign-in failure message above the form.
 */
export function PasswordField({
  id,
  name,
  label,
  autoComplete = "current-password",
  required = true,
  placeholder,
  capsLockHint = false,
  disabled = false,
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const hintId = useId();

  const trackCaps = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!capsLockHint) return;
    setCapsOn(event.getModifierState?.("CapsLock") ?? false);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-describedby={capsLockHint && capsOn ? hintId : undefined}
          onKeyDown={trackCaps}
          onKeyUp={trackCaps}
          className="pe-12"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          disabled={disabled}
          className="absolute inset-y-0 end-0 flex w-12 items-center justify-center rounded-input text-graphite outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40 motion-reduce:transition-none"
        >
          {show ? (
            <EyeOff aria-hidden className="size-4" strokeWidth={1.5} />
          ) : (
            <Eye aria-hidden className="size-4" strokeWidth={1.5} />
          )}
        </button>
      </div>
      {/* Rendered only when it is true — an always-present, empty live region
          here would fight the sign-in alert for the announcement queue. */}
      {capsLockHint && capsOn && (
        <p id={hintId} role="status" className="u-micro text-warning">
          Caps Lock is on
        </p>
      )}
    </div>
  );
}
