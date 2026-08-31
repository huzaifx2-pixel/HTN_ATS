import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { getOrCreateTeamChannel, listOrgMembers } from "@/lib/services/messaging-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { MessageThread } from "@/components/messages/message-thread";

export default async function MessagesPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const [teamChannel, members] = await Promise.all([
    getOrCreateTeamChannel(member.organizationId),
    listOrgMembers(member.organizationId),
  ]);

  return (
    <div>
      <PageHeader
        title="Team Chat"
        description={`${members.length} registered team member${members.length === 1 ? "" : "s"}`}
      />
      <div className="grid gap-4 lg:grid-cols-3 h-[calc(100vh-200px)]">
        <Card className="overflow-hidden flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Team Members</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto pt-0 space-y-1">
            {members.map((m) => (
              <div
                key={m.id}
                className={`flex items-center gap-3 rounded-lg p-3 ${
                  m.userId === session.user.id ? "bg-brand-700/5 border-l-2 border-brand-700" : "hover:bg-muted/50"
                }`}
              >
                <Avatar name={m.user.name} src={m.user.image} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {m.user.name}
                    {m.userId === session.user.id && (
                      <span className="text-muted-foreground font-normal"> (you)</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{m.user.email}</div>
                </div>
                <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 shrink-0">{m.role}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <MessageThread
            key={teamChannel.id}
            channelId={teamChannel.id}
            userId={session.user.id}
          />
        </div>
      </div>
    </div>
  );
}
