"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { PasswordField } from "@/components/studio/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The sign-in fields — §12.1 `idle · submitting` states.
 *
 * Lives in its own client component purely so `useFormStatus` has a form
 * ancestor: the Server Action itself stays declared on the page and is passed
 * straight to `<form action>`, untouched. While the action is in flight both
 * fields are disabled and the button swaps its label for a spinner at a locked
 * width, so the row cannot reflow mid-submit.
 *
 * Enter submits because this is a real `<form>` with a real `type="submit"` —
 * there is no key handler to get wrong.
 */
export function LoginFields() {
  const { pending } = useFormStatus();

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-foreground">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          disabled={pending}
          autoComplete="username email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="you@example.com"
        />
      </div>

      <PasswordField
        id="password"
        name="password"
        label="Password"
        autoComplete="current-password"
        capsLockHint
        disabled={pending}
      />

      <div className="flex justify-end">
        <Link
          href="/studio/forgot-password"
          className="inline-flex min-h-11 items-center rounded-input text-small font-medium text-sapphire-ink outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-sapphire-hi focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? (
          <>
            <Loader2 aria-hidden className="size-4 animate-spin" />
            <span className="sr-only">Signing in…</span>
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </div>
  );
}

/**
 * §12.1 rate-limited state — a live `Try again in 4:32` countdown.
 *
 * WIRED. This comment used to say the component was unreachable on purpose;
 * that stopped being true when the login Server Action learned to ask the
 * counters. `authorize()` is still a bare `null` for a throttled attempt
 * exactly as it is for a wrong password — that is what stops a lockout
 * becoming an account-existence oracle — but the action calls
 * `loginLockoutSeconds` separately AFTER its own attempt has failed and been
 * recorded, then redirects to `?retryAfter=<seconds>`, which is what this
 * renders on (src/app/studio/login/page.tsx). Nothing an attacker can see
 * changed: the number is only ever produced for an attempt that already
 * failed.
 *
 * The tick lives in an interval (never a setState in an effect body) and the
 * countdown is derived from a deadline captured at mount, so a backgrounded
 * tab that misses ticks still shows the right remaining time when it wakes.
 */
export function LockoutCountdown({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    const deadline = Date.now() + seconds * 1000;
    const id = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [seconds]);

  if (remaining <= 0) {
    return (
      <p
        role="status"
        className="rounded-input border-s-2 border-alert/60 bg-alert/8 px-4 py-3 text-small text-alert"
      >
        You can try signing in again now.
      </p>
    );
  }

  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <p
      role="alert"
      className="rounded-input border-s-2 border-alert/60 bg-alert/8 px-4 py-3 text-small leading-relaxed text-alert"
    >
      Too many sign-in attempts. Try again in{" "}
      <span className="u-num font-medium">
        {mm}:{ss}
      </span>
      .
    </p>
  );
}
