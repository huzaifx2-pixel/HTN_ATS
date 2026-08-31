"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { resetUserPasswordAction } from "@/app/(dashboard)/admin/users/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

function generateTempPassword() {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 10);
  return `Hb-${token}`;
}

export function ResetMemberPasswordButton({
  memberId,
  memberName,
  memberEmail,
}: {
  memberId: string;
  memberName: string;
  memberEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setPassword("");
    setConfirmPassword("");
    setError(undefined);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => setOpen(true)}
        aria-label={`Reset password for ${memberName}`}
        title="Reset password"
      >
        <KeyRound className="h-4 w-4" />
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
          else setOpen(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
          </DialogHeader>
          <p className="mb-4 text-sm text-muted-foreground">
            Set a new password for <span className="font-medium text-foreground">{memberName}</span>{" "}
            ({memberEmail}). They will need to sign in again.
          </p>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setError(undefined);
              startTransition(async () => {
                const result = await resetUserPasswordAction(memberId, password, confirmPassword);
                if (result) {
                  setError(result);
                  return;
                }
                close();
              });
            }}
          >
            <div>
              <Label htmlFor={`reset-password-${memberId}`}>New password</Label>
              <PasswordInput
                id={`reset-password-${memberId}`}
                name="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={`reset-confirm-${memberId}`}>Confirm password</Label>
              <PasswordInput
                id={`reset-confirm-${memberId}`}
                name="confirmPassword"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  const next = generateTempPassword();
                  setPassword(next);
                  setConfirmPassword(next);
                }}
              >
                Generate
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? "Saving…" : "Save password"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
