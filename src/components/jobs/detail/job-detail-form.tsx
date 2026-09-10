import type { ReactNode } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CountrySelect } from "@/components/jobs/country-select";
import { parseSalaryCurrency, SALARY_CURRENCIES, SALARY_PERIODS } from "@/lib/constants/salary-periods";

function toDateInput(value?: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function toNumberInput(value: unknown) {
  if (value == null) return "";
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : "";
}

export type JobDetailFormJob = {
  clientId: string;
  status: string;
  title: string;
  jobCode: string;
  description?: string | null;
  location?: string | null;
  country?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  address1?: string | null;
  address2?: string | null;
  department?: string | null;
  jobFunction?: string | null;
  seniority?: string | null;
  employmentType?: string | null;
  workplaceType?: string | null;
  ownerId?: string | null;
  priority?: string | null;
  openings: number;
  maxSubmissions?: number | null;
  salaryMin?: unknown;
  salaryMax?: unknown;
  salaryCurrency?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  requireResume?: boolean;
  travelRequired?: boolean;
  otRequired?: boolean;
  referencesRequired?: boolean;
  drugTestRequired?: boolean;
  backgroundCheckRequired?: boolean;
  securityClearanceRequired?: boolean;
  updatedAt: Date;
};

export function JobDetailForm({
  jobId,
  job,
  clients,
  members,
  salaryPeriod,
  requiredSkills,
  preferredSkills,
  certifications,
  experienceYears,
  children,
}: {
  jobId: string;
  job: JobDetailFormJob;
  clients: Array<{ id: string; name: string; prefix: string }>;
  members: Array<{ id: string; name: string }>;
  salaryPeriod: string;
  requiredSkills: string;
  preferredSkills: string;
  certifications: string;
  experienceYears?: number;
  children?: ReactNode;
}) {
  return (
    <form
      key={job.updatedAt.toISOString()}
      action={async (fd) => {
        "use server";
        const { updateJobAction } = await import("@/app/actions");
        await updateJobAction(jobId, fd);
      }}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="clientId">Client / Company</Label>
          <select
            id="clientId"
            name="clientId"
            required
            defaultValue={job.clientId}
            className="mt-1 flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.prefix})
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={job.status}
            className="mt-1 flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
          >
            <option value="OPEN">Open</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="CLOSED">Closed</option>
            <option value="FILLED">Filled</option>
          </select>
        </div>
        <div>
          <Label htmlFor="title">Job Title</Label>
          <Input id="title" name="title" defaultValue={job.title} required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="jobCode">Job ID</Label>
          <Input id="jobCode" name="jobCode" defaultValue={job.jobCode} required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="jobFunction">Job Function</Label>
          <Input id="jobFunction" name="jobFunction" defaultValue={job.jobFunction ?? ""} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="department">Department</Label>
          <Input id="department" name="department" defaultValue={job.department ?? ""} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="priority">Priority</Label>
          <select
            id="priority"
            name="priority"
            defaultValue={job.priority ?? "MEDIUM"}
            className="mt-1 flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
        <div>
          <Label htmlFor="ownerId">Owner</Label>
          <select
            id="ownerId"
            name="ownerId"
            defaultValue={job.ownerId ?? ""}
            className="mt-1 flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="employmentType">Employment Type</Label>
          <select
            id="employmentType"
            name="employmentType"
            defaultValue={job.employmentType ?? ""}
            className="mt-1 flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
          >
            <option value="">Select</option>
            <option value="FULL_TIME">Full Time</option>
            <option value="PART_TIME">Part Time</option>
            <option value="CONTRACT">Contract</option>
            <option value="TEMPORARY">Temporary</option>
            <option value="INTERNSHIP">Internship</option>
            <option value="FREELANCE">Freelance</option>
          </select>
        </div>
        <div>
          <Label htmlFor="workplaceType">Workplace</Label>
          <select
            id="workplaceType"
            name="workplaceType"
            defaultValue={job.workplaceType ?? ""}
            className="mt-1 flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
          >
            <option value="">Select</option>
            <option value="ON_SITE">On Site</option>
            <option value="HYBRID">Hybrid</option>
            <option value="REMOTE">Remote</option>
          </select>
        </div>
        <div>
          <Label htmlFor="seniority">Seniority</Label>
          <Input id="seniority" name="seniority" defaultValue={job.seniority ?? ""} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="openings"># Openings</Label>
          <Input id="openings" name="openings" type="number" min={1} defaultValue={job.openings} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="maxSubmissions">Max Submissions</Label>
          <Input
            id="maxSubmissions"
            name="maxSubmissions"
            type="number"
            min={0}
            defaultValue={job.maxSubmissions ?? ""}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="startDate">Start Date</Label>
          <Input id="startDate" name="startDate" type="date" defaultValue={toDateInput(job.startDate)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="endDate">End Date</Label>
          <Input id="endDate" name="endDate" type="date" defaultValue={toDateInput(job.endDate)} className="mt-1" />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border/80 p-4">
        <div className="text-sm font-medium">Location</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="address1">Address 1</Label>
            <Input id="address1" name="address1" defaultValue={job.address1 ?? ""} className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="address2">Address 2</Label>
            <Input id="address2" name="address2" defaultValue={job.address2 ?? ""} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" defaultValue={job.city ?? ""} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="state">State</Label>
            <Input id="state" name="state" defaultValue={job.state ?? ""} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="zip">Zip</Label>
            <Input id="zip" name="zip" defaultValue={job.zip ?? ""} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="country">Country</Label>
            <CountrySelect id="country" name="country" defaultValue={job.country ?? ""} className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="location">Location (display)</Label>
            <Input id="location" name="location" defaultValue={job.location ?? ""} className="mt-1" />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border/80 p-4">
        <div className="text-sm font-medium">Compensation</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="salaryMin">Salary Min</Label>
            <Input id="salaryMin" name="salaryMin" type="number" min={0} step="0.01" defaultValue={toNumberInput(job.salaryMin)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="salaryMax">Salary Max</Label>
            <Input id="salaryMax" name="salaryMax" type="number" min={0} step="0.01" defaultValue={toNumberInput(job.salaryMax)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="salaryPeriod">Rate Period</Label>
            <select
              id="salaryPeriod"
              name="salaryPeriod"
              defaultValue={salaryPeriod}
              className="mt-1 flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
            >
              {SALARY_PERIODS.map((period) => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="salaryCurrency">Currency</Label>
            <select
              id="salaryCurrency"
              name="salaryCurrency"
              defaultValue={parseSalaryCurrency(job.salaryCurrency)}
              className="mt-1 flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
            >
              {SALARY_CURRENCIES.map((currency) => (
                <option key={currency.value} value={currency.value}>
                  {currency.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Job Description</Label>
        <textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={job.description ?? ""}
          className="mt-1 flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="requiredSkills">Required Skills</Label>
          <Input id="requiredSkills" name="requiredSkills" defaultValue={requiredSkills} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="preferredSkills">Preferred Skills</Label>
          <Input id="preferredSkills" name="preferredSkills" defaultValue={preferredSkills} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="certifications">Certifications</Label>
          <Input id="certifications" name="certifications" defaultValue={certifications} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="experienceYears">Experience (years)</Label>
          <Input
            id="experienceYears"
            name="experienceYears"
            type="number"
            min={0}
            defaultValue={experienceYears ?? ""}
            className="mt-1"
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["requireResume", "Require Resume", job.requireResume ?? true],
          ["travelRequired", "Travel Required", job.travelRequired ?? false],
          ["otRequired", "OT Required", job.otRequired ?? false],
          ["referencesRequired", "References Required", job.referencesRequired ?? false],
          ["drugTestRequired", "Drug Test Required", job.drugTestRequired ?? false],
          ["backgroundCheckRequired", "Background Check", job.backgroundCheckRequired ?? false],
          ["securityClearanceRequired", "Security Clearance", job.securityClearanceRequired ?? false],
        ].map(([name, label, checked]) => (
          <label key={String(name)} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={String(name)}
              defaultChecked={Boolean(checked)}
              className="rounded border-border"
            />
            {String(label)}
          </label>
        ))}
      </div>

      {children}

      <Button type="submit">Save Changes</Button>
    </form>
  );
}
