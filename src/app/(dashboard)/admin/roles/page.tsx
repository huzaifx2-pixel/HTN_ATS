import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";

const ROLES = [
  { role: "OWNER", permissions: ["All permissions"] },
  { role: "ADMIN", permissions: ["Manage org", "Create/edit jobs", "Pipeline", "Email", "Marketing", "Analytics", "Admin"] },
  { role: "MANAGER", permissions: ["Create/edit jobs", "Pipeline", "Email", "Marketing", "Analytics"] },
  { role: "RECRUITER", permissions: ["Create/edit jobs", "Pipeline", "Email", "Analytics"] },
  { role: "MARKETING", permissions: ["Marketing campaigns", "Email", "Analytics"] },
  { role: "FINANCE", permissions: ["View analytics only"] },
  { role: "VIEWER", permissions: ["View analytics only"] },
];

export default async function RolesPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        description="Assign roles on the Users page. Permissions are enforced server-side and cannot be edited here."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ROLES.map((r) => (
          <Card key={r.role}>
            <CardContent className="pt-6">
              <div className="font-medium text-sm mb-2">{r.role}</div>
              <ul className="text-xs text-muted-foreground space-y-1">
                {r.permissions.map((p) => <li key={p}>• {p}</li>)}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
