"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

function LoginForm() {
  const [error, formAction, pending] = useActionState(loginAction, undefined);
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "";
  const resetDone = searchParams.get("reset") === "1";

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-700">
            <div className="grid grid-cols-2 gap-1">
              <div className="h-5 w-5 rounded-md bg-brand-500" />
              <div className="h-5 w-5 rounded-md bg-brand-300" />
              <div className="h-5 w-5 rounded-md bg-brand-300" />
              <div className="h-5 w-5 rounded-md bg-brand-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">Headsbase</h1>
          <p className="text-brand-300">Talent Network</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Enter your credentials to access your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
              {resetDone && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  Password updated. Sign in with your new password.
                </p>
              )}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Signing in..." : "Sign in"}
              </Button>
            </form>
            <p className="mt-3 text-center text-sm">
              <Link href="/forgot-password" className="text-brand-700 hover:underline">
                Forgot password?
              </Link>
            </p>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-brand-700 hover:underline">
                Sign up
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-brand-900 p-4 text-brand-300">
          Loading sign in…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
