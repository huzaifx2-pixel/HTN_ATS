"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signupAction } from "@/app/(auth)/signup/actions";
import { CANONICAL_ORG_NAME } from "@/lib/org/single-org";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function SignupPage() {
  const [error, formAction, pending] = useActionState(signupAction, undefined);

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
            <CardTitle>Create account</CardTitle>
            <CardDescription>
              Join {CANONICAL_ORG_NAME} on the shared recruiting workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" name="name" autoComplete="name" required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </div>
              <p className="text-xs text-muted-foreground rounded-lg border bg-muted/40 px-3 py-2">
                New accounts are added to <strong>{CANONICAL_ORG_NAME}</strong>. All recruiters share the same jobs and candidates.
              </p>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Creating account..." : "Create account"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-brand-700 hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
