import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PHONE_COUNTRY_CODES } from "@/lib/format-phone";
import { createCandidateAction } from "@/app/actions";

export default async function NewCandidatePage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  return (
    <div>
      <PageHeader title="Add Candidate" description="Manually add a candidate to the database" />
      <Card className="max-w-xl">
        <CardHeader><CardTitle>Candidate Details</CardTitle></CardHeader>
        <CardContent>
          <form action={createCandidateAction} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label htmlFor="firstName">First Name</Label><Input id="firstName" name="firstName" required className="mt-1" /></div>
              <div><Label htmlFor="lastName">Last Name</Label><Input id="lastName" name="lastName" required className="mt-1" /></div>
            </div>
            <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" className="mt-1" /></div>
            <div>
              <Label className="mb-1 block">Phone</Label>
              <div className="grid grid-cols-[140px_1fr] gap-3">
                <select
                  id="phoneCountryCode"
                  name="phoneCountryCode"
                  defaultValue=""
                  className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  <option value="">Code</option>
                  {PHONE_COUNTRY_CODES.map(({ code, label }) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
                <Input id="phone" name="phone" type="tel" placeholder="Phone number" />
              </div>
            </div>
            <div><Label htmlFor="currentRole">Current Role</Label><Input id="currentRole" name="currentRole" className="mt-1" /></div>
            <div><Label htmlFor="currentCompany">Current Company</Label><Input id="currentCompany" name="currentCompany" className="mt-1" /></div>
            <div><Label htmlFor="skills">Skills (comma-separated)</Label><Input id="skills" name="skills" className="mt-1" /></div>
            <Button type="submit">Add Candidate</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
