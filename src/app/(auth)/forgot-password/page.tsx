"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction } from "@/app/(auth)/forgot-password/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [error, formAction, pending] = useActionState(forgotPasswordAction, undefined);

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
            <CardTitle>Reset password</CardTitle>
            <CardDescription>Enter your work email and choose a new password</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="password">New password</Label>
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Saving..." : "Save new password"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Remembered it?{" "}
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
