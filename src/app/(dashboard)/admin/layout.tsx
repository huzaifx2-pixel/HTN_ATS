import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  return children;
}
