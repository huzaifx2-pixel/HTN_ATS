import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { ProfileNameForm } from "@/components/settings/profile-name-form";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  return (
    <div>
      <PageHeader title="My Profile" description="Your account information" />
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-sm">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar name={session.user.name} src={session.user.image} size="lg" />
            <div>
              <div className="font-medium">{session.user.name}</div>
              <div className="text-sm text-muted-foreground">{session.user.email}</div>
            </div>
          </div>
          <ProfileNameForm currentName={session.user.name} />
        </CardContent>
      </Card>
    </div>
  );
}
