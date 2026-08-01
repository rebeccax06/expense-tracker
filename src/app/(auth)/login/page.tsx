"use client";

import { Suspense, useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { sendMagicLink, signIn, type ActionState } from "../actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const redirectTo = params.get("redirectTo") ?? "/dashboard";
  const [mode, setMode] = useState<"password" | "magic-link">("password");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    signIn,
    {},
  );
  const [magicState, magicAction, magicPending] = useActionState<
    ActionState,
    FormData
  >(sendMagicLink, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Log in to your expense tracker.</CardDescription>
      </CardHeader>
      <CardContent>
        {mode === "password" ? (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {state.error && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Logging in…" : "Log in"}
            </Button>
          </form>
        ) : (
          <form action={magicAction} className="space-y-4">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            {magicState.error && (
              <Alert variant="destructive">
                <AlertDescription>{magicState.error}</AlertDescription>
              </Alert>
            )}
            {magicState.message && (
              <Alert>
                <AlertDescription>{magicState.message}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={magicPending}>
              {magicPending ? "Sending…" : "Email me a login link"}
            </Button>
          </form>
        )}
        <Button
          type="button"
          variant="ghost"
          className="mt-2 w-full"
          onClick={() =>
            setMode(mode === "password" ? "magic-link" : "password")
          }
        >
          {mode === "password"
            ? "Log in with a magic link instead"
            : "Log in with a password instead"}
        </Button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link href="/signup" className="text-foreground hover:underline">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
