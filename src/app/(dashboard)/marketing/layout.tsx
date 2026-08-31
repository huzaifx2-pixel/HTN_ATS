import { redirect } from "next/navigation";
import { getSession, getActiveOrganization } from "@/lib/auth/session";
import { MarketingNav } from "@/components/marketing/marketing-nav";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Marketing</h1>
        <p className="text-sm text-muted-foreground">Email campaigns, audiences, and talent marketing automation</p>
      </div>
      <MarketingNav />
      {children}
    </div>
  );
}
