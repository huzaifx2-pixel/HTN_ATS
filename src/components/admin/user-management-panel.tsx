"use client";

import { useActionState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { addUserAction, removeUserAction, updateUserRoleAction } from "@/app/(dashboard)/admin/users/actions";
import { EditableMemberName } from "@/components/admin/editable-member-name";
import { ResetMemberPasswordButton } from "@/components/admin/reset-member-password-button";
import { displayRoleLabel } from "@/lib/auth/features";
import type { MemberRole } from "@prisma/client";

type MemberRow = {
  id: string;
  role: MemberRole;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
};

const ROLE_OPTIONS: MemberRole[] = ["ADMIN", "RECRUITER", "EXTERNAL_RECRUITER"];

const selectClassName =
  "flex h-9 rounded-lg border border-input bg-card px-2 text-sm";

export function UserManagementPanel({
  members,
  currentUserId,
  canManage,
}: {
  members: MemberRow[];
  currentUserId: string;
  canManage: boolean;
}) {
  const [addError, addUser, addPending] = useActionState(addUserAction, undefined);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Add User</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addUser} className="space-y-3">
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" name="name" required className="mt-1" placeholder="Jane Recruiter" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="mt-1"
                  placeholder="jane@headsbaseconsulting.com"
                />
              </div>
              <div>
                <Label htmlFor="password">Password (new users only)</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  minLength={8}
                  className="mt-1"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <select id="role" name="role" defaultValue="RECRUITER" className={`mt-1 w-full ${selectClassName}`}>
                    {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {displayRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </div>
              {addError && <p className="text-sm text-red-600">{addError}</p>}
              <Button type="submit" size="sm" disabled={addPending}>
                {addPending ? "Adding…" : "Add User"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className={canManage ? undefined : "lg:col-span-2"}>
        <CardHeader>
          <CardTitle className="text-sm">Team Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!canManage && (
            <p className="text-xs text-muted-foreground">
              Only Superadmin can add, remove, change roles, or edit member names.
            </p>
          )}
          {members.map((member) => {
            const isSelf = member.user.id === currentUserId;
            const isOwner = member.role === "OWNER";

            return (
              <div key={member.id} className="flex items-center gap-3 rounded-lg border p-3">
                <Avatar name={member.user.name} src={member.user.image} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1">
                    <EditableMemberName memberId={member.id} name={member.user.name} canEdit={canManage} />
                    {isSelf && <span className="shrink-0 text-xs text-muted-foreground">(you)</span>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{member.user.email}</div>
                </div>

                {canManage && !isOwner && ROLE_OPTIONS.includes(member.role) ? (
                  <select
                    value={member.role}
                    disabled={pending || isSelf}
                    className={selectClassName}
                    onChange={(event) => {
                      const role = event.target.value;
                      startTransition(async () => {
                        const error = await updateUserRoleAction(member.id, role);
                        if (error) window.alert(error);
                      });
                    }}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {displayRoleLabel(role)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{displayRoleLabel(member.role)}</span>
                )}

                {canManage && (
                  <ResetMemberPasswordButton
                    memberId={member.id}
                    memberName={member.user.name}
                    memberEmail={member.user.email}
                  />
                )}

                {canManage && !isSelf && !isOwner && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm(`Remove ${member.user.name} from the team?`)) return;
                      startTransition(async () => {
                        const error = await removeUserAction(member.id);
                        if (error) window.alert(error);
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
