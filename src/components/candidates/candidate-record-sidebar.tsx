"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Globe,
  Mail,
  MapPin,
  Pencil,
  Phone,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { updateCandidateAction } from "@/app/actions";
import { PHONE_COUNTRY_CODES } from "@/lib/format-phone";
import type { ProfileCertification, ProfileEducation, ProfileExperience } from "@/lib/candidates/profile-view-data";
import { getInitials } from "@/lib/utils";

export type RecordNote = {
  id: string;
  date: string;
  recruiter: string;
  jobLabel?: string;
  jobHref?: string;
  note: string;
};

export type RecordApplication = {
  id: string;
  jobId: string;
  stage: string;
  date?: string;
  job: { jobCode: string; title: string };
};

function Accordion({
  title,
  count,
  defaultOpen = false,
  addHref,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  addHref?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-b border-[#c5d0dc]">
      <div className="flex items-center bg-[#1e4e8c] text-white">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-1 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide"
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <span className="truncate">
            {title} ({count})
          </span>
        </button>
        {addHref ? (
          <Link href={addHref} className="px-2 text-lg leading-none text-sky-200 hover:text-white" title={`Add ${title}`}>
            +
          </Link>
        ) : null}
      </div>
      {open ? <div className="bg-white">{children}</div> : null}
    </section>
  );
}

function EmptyTable({ columns }: { columns: string[] }) {
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="bg-[#eef3f8] text-left text-[#4b5d73]">
          {columns.map((column) => (
            <th key={column} className="border-b border-[#d7e0ea] px-2 py-1 font-medium">
              {column}
            </th>
          ))}
        </tr>
      </thead>
    </table>
  );
}

function MiniTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: React.ReactNode[][];
}) {
  if (rows.length === 0) return <EmptyTable columns={columns} />;
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="bg-[#eef3f8] text-left text-[#4b5d73]">
          {columns.map((column) => (
            <th key={column} className="border-b border-[#d7e0ea] px-1.5 py-1 font-medium">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index} className="border-t border-[#e6edf4] align-top">
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className="px-1.5 py-1">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PhoneCodeSelect({
  name,
  value,
}: {
  name: string;
  value?: string | null;
}) {
  return (
    <select
      name={name}
      defaultValue={value ?? ""}
      className="h-7 rounded border border-[#c5d0dc] bg-white px-1 text-[11px]"
    >
      <option value="">Code</option>
      {PHONE_COUNTRY_CODES.map(({ code, label }) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
      {value && !PHONE_COUNTRY_CODES.some(({ code }) => code === value) ? (
        <option value={value}>{value}</option>
      ) : null}
    </select>
  );
}

async function copyValue(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`);
  }
}

function ContactRow({
  label,
  value,
  href,
  copyText,
}: {
  label: string;
  value?: string | null;
  href?: string | null;
  copyText?: string | null;
}) {
  const display = value?.trim() || "";
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)_auto] items-start gap-1 px-3 py-1 text-[11px]">
      <span className="pt-0.5 font-medium text-[#4b5d73]">{label}</span>
      {href && display ? (
        <a href={href} className="truncate text-[#1e4e8c] hover:underline" target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined}>
          {display}
        </a>
      ) : (
        <span className={display ? "truncate text-[#1a2b3c]" : "text-[#9aa8b8]"}>{display || "—"}</span>
      )}
      <span className="flex shrink-0 items-center gap-0.5">
        {display ? (
          <button
            type="button"
            className="rounded p-0.5 text-[#7a8b9c] hover:bg-[#e8eef5] hover:text-[#1e4e8c]"
            title={`Copy ${label}`}
            onClick={() => copyValue(copyText || display, label)}
          >
            <Copy className="h-3 w-3" />
          </button>
        ) : null}
      </span>
    </div>
  );
}

function ContactEditor({
  candidateId,
  firstName,
  lastName,
  email,
  altEmail,
  phone,
  phoneCountryCode,
  altPhone,
  altPhoneCountryCode,
  location,
  linkedIn,
  githubUrl,
  portfolioUrl,
  website,
  currentRole,
  currentCompany,
  skills,
  experienceYears,
  onCancel,
}: {
  candidateId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  altEmail?: string | null;
  phone?: string | null;
  phoneCountryCode?: string | null;
  altPhone?: string | null;
  altPhoneCountryCode?: string | null;
  location?: string | null;
  linkedIn?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  website?: string | null;
  currentRole?: string | null;
  currentCompany?: string | null;
  skills: string[];
  experienceYears?: number | null;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-1.5 border-b border-[#c5d0dc] bg-[#f7f9fb] px-3 py-2"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          try {
            await updateCandidateAction(candidateId, formData);
            toast.success("Contact saved");
            onCancel();
            router.refresh();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not save contact");
          }
        });
      }}
    >
      <input type="hidden" name="currentRole" value={currentRole ?? ""} />
      <input type="hidden" name="currentCompany" value={currentCompany ?? ""} />
      <input type="hidden" name="skills" value={skills.join(", ")} />
      <input type="hidden" name="experienceYears" value={experienceYears ?? ""} />
      <div className="grid grid-cols-2 gap-1.5">
        <input name="firstName" defaultValue={firstName} required className="h-7 rounded border border-[#c5d0dc] px-1.5 text-[11px]" placeholder="First name" />
        <input name="lastName" defaultValue={lastName} required className="h-7 rounded border border-[#c5d0dc] px-1.5 text-[11px]" placeholder="Last name" />
      </div>
      <input name="email" type="email" defaultValue={email ?? ""} className="h-7 w-full rounded border border-[#c5d0dc] px-1.5 text-[11px]" placeholder="Main email" />
      <input name="altEmail" type="email" defaultValue={altEmail ?? ""} className="h-7 w-full rounded border border-[#c5d0dc] px-1.5 text-[11px]" placeholder="Alternative email" />
      <div className="grid grid-cols-[88px_1fr] gap-1.5">
        <PhoneCodeSelect name="phoneCountryCode" value={phoneCountryCode} />
        <input name="phone" type="tel" defaultValue={phone ?? ""} className="h-7 rounded border border-[#c5d0dc] px-1.5 text-[11px]" placeholder="Main phone" />
      </div>
      <div className="grid grid-cols-[88px_1fr] gap-1.5">
        <PhoneCodeSelect name="altPhoneCountryCode" value={altPhoneCountryCode} />
        <input name="altPhone" type="tel" defaultValue={altPhone ?? ""} className="h-7 rounded border border-[#c5d0dc] px-1.5 text-[11px]" placeholder="Alternative phone" />
      </div>
      <input name="location" defaultValue={location ?? ""} className="h-7 w-full rounded border border-[#c5d0dc] px-1.5 text-[11px]" placeholder="Location" />
      <input name="linkedIn" defaultValue={linkedIn ?? ""} className="h-7 w-full rounded border border-[#c5d0dc] px-1.5 text-[11px]" placeholder="LinkedIn URL" />
      <input name="githubUrl" defaultValue={githubUrl ?? ""} className="h-7 w-full rounded border border-[#c5d0dc] px-1.5 text-[11px]" placeholder="GitHub URL" />
      <input name="portfolioUrl" defaultValue={portfolioUrl ?? ""} className="h-7 w-full rounded border border-[#c5d0dc] px-1.5 text-[11px]" placeholder="Portfolio URL" />
      <input name="website" defaultValue={website ?? ""} className="h-7 w-full rounded border border-[#c5d0dc] px-1.5 text-[11px]" placeholder="Website" />
      <div className="flex justify-end gap-1 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="inline-flex h-6 items-center gap-0.5 rounded px-1.5 text-[11px] text-[#4b5d73] hover:bg-white"
        >
          <X className="h-3 w-3" />
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-6 items-center gap-0.5 rounded bg-[#1e4e8c] px-1.5 text-[11px] font-medium text-white hover:bg-[#163a68] disabled:opacity-60"
        >
          <Check className="h-3 w-3" />
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

export function CandidateRecordSidebar({
  candidateId,
  firstName,
  lastName,
  title,
  status,
  email,
  altEmail,
  phone,
  phoneRaw,
  phoneCountryCode,
  phoneHref,
  altPhone,
  altPhoneRaw,
  altPhoneCountryCode,
  altPhoneHref,
  location,
  linkedIn,
  githubUrl,
  portfolioUrl,
  website,
  currentRole,
  currentCompany,
  skills,
  experienceYears,
  notes,
  applications,
  experience,
  education,
  certifications,
}: {
  candidateId: string;
  firstName: string;
  lastName: string;
  title?: string | null;
  status?: string | null;
  email?: string | null;
  altEmail?: string | null;
  phone?: string | null;
  phoneRaw?: string | null;
  phoneCountryCode?: string | null;
  phoneHref?: string | null;
  altPhone?: string | null;
  altPhoneRaw?: string | null;
  altPhoneCountryCode?: string | null;
  altPhoneHref?: string | null;
  location?: string | null;
  linkedIn?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  website?: string | null;
  currentRole?: string | null;
  currentCompany?: string | null;
  skills: string[];
  experienceYears?: number | null;
  notes: RecordNote[];
  applications: RecordApplication[];
  experience: ProfileExperience[];
  education: ProfileEducation[];
  certifications: ProfileCertification[];
}) {
  const [editing, setEditing] = useState(false);
  const name = `${firstName} ${lastName}`.trim();
  const active = status !== "INACTIVE" && status !== "ARCHIVED";

  return (
    <aside className="flex h-full w-[min(320px,34%)] min-w-[240px] shrink-0 flex-col overflow-hidden border-r border-[#b8c4d4] bg-white">
      <div className="border-b border-[#c5d0dc] px-3 py-2">
        <div className="flex items-start gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1e4e8c]/10 text-xs font-semibold text-[#1e4e8c]">
            {getInitials(name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h1 className="flex items-center gap-1.5 text-sm font-bold text-[#1a2b3c]">
                <span className="truncate">{name}</span>
                <span className={`h-2 w-2 shrink-0 rounded-full ${active ? "bg-emerald-500" : "bg-[#9aa8b8]"}`} title={status ?? "status"} />
              </h1>
              <button
                type="button"
                onClick={() => setEditing((value) => !value)}
                className="rounded p-0.5 text-orange-500 hover:bg-[#fff4ea]"
                title="Edit contact"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="truncate text-[11px] text-[#3d4f63]">{title || "—"}</p>
          </div>
        </div>
      </div>

      {editing ? (
        <ContactEditor
          candidateId={candidateId}
          firstName={firstName}
          lastName={lastName}
          email={email}
          altEmail={altEmail}
          phone={phoneRaw}
          phoneCountryCode={phoneCountryCode}
          altPhone={altPhoneRaw}
          altPhoneCountryCode={altPhoneCountryCode}
          location={location}
          linkedIn={linkedIn}
          githubUrl={githubUrl}
          portfolioUrl={portfolioUrl}
          website={website}
          currentRole={currentRole}
          currentCompany={currentCompany}
          skills={skills}
          experienceYears={experienceYears}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="border-b border-[#c5d0dc] py-1">
          <ContactRow label="Main email" value={email} href={email ? `mailto:${email}` : null} />
          <ContactRow label="Alt email" value={altEmail} href={altEmail ? `mailto:${altEmail}` : null} />
          <ContactRow label="Main phone" value={phone} href={phoneHref} copyText={phoneRaw || phone} />
          <ContactRow label="Alt phone" value={altPhone} href={altPhoneHref} copyText={altPhoneRaw || altPhone} />
          <ContactRow label="Location" value={location} />
          <ContactRow label="LinkedIn" value={linkedIn} href={linkedIn} />
          <ContactRow label="GitHub" value={githubUrl} href={githubUrl} />
          <ContactRow label="Portfolio" value={portfolioUrl} href={portfolioUrl} />
          <ContactRow label="Website" value={website} href={website} />
          <div className="flex items-center gap-2 px-3 pb-1 pt-0.5 text-[#7a8b9c]">
            {email ? <Mail className="h-3 w-3" /> : null}
            {phoneHref ? <Phone className="h-3 w-3" /> : null}
            {location ? <MapPin className="h-3 w-3" /> : null}
            {linkedIn ? <Globe className="h-3 w-3" /> : null}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Accordion title="Job Submissions" count={applications.length}>
          <MiniTable
            columns={["Job Title", "Stage", "Date"]}
            rows={applications.slice(0, 8).map((application) => [
              <Link key={application.id} href={`/jobs/${application.jobId}`} className="text-[#1e4e8c] hover:underline">
                {application.job.jobCode} · {application.job.title}
              </Link>,
              application.stage.replace(/_/g, " "),
              application.date ?? "—",
            ])}
          />
        </Accordion>

        <Accordion title="Activities" count={notes.length}>
          <MiniTable
            columns={["Type", "Date"]}
            rows={notes.slice(0, 8).map((note) => [note.note, note.date])}
          />
        </Accordion>

        <Accordion title="Notes" count={notes.length} defaultOpen addHref={`/candidates/${candidateId}?tab=activity`}>
          <MiniTable
            columns={["Date", "Recruiter", "Job #", "Note"]}
            rows={notes.slice(0, 12).map((note) => [
              note.date,
              note.recruiter,
              note.jobHref ? (
                <Link href={note.jobHref} className="text-[#1e4e8c] hover:underline">
                  {note.jobLabel}
                </Link>
              ) : (
                "—"
              ),
              <Link key={note.id} href={`/candidates/${candidateId}?tab=activity`} className="text-[#1e4e8c] hover:underline">
                {note.note}
              </Link>,
            ])}
          />
        </Accordion>

        <Accordion title="Qualifications" count={skills.length}>
          {skills.length === 0 ? (
            <EmptyTable columns={["Skill"]} />
          ) : (
            <div className="flex flex-wrap gap-1 p-2">
              {skills.slice(0, 40).map((skill) => (
                <span key={skill} className="rounded bg-[#eef3f8] px-1.5 py-0.5 text-[10px] text-[#1a2b3c]">
                  {skill}
                </span>
              ))}
            </div>
          )}
        </Accordion>

        <Accordion title="Licenses" count={0}>
          <EmptyTable columns={["Name", "License #", "State", "Exp Date"]} />
        </Accordion>

        <Accordion title="Certifications" count={certifications.length}>
          <MiniTable
            columns={["Name", "Issuer", "Exp Date"]}
            rows={certifications.map((row) => [row.name, row.issuer ?? "—", row.expiry ?? "—"])}
          />
        </Accordion>

        <Accordion title="Experience" count={experience.length}>
          <MiniTable
            columns={["Title", "Company", "Dates"]}
            rows={experience.map((job) => [
              job.title,
              job.company,
              [job.start, job.end].filter(Boolean).join(" – ") || "—",
            ])}
          />
        </Accordion>

        <Accordion title="Education" count={education.length}>
          <MiniTable
            columns={["School", "Degree", "Year"]}
            rows={education.map((row) => [
              row.institution,
              [row.degree, row.field].filter(Boolean).join(" · ") || "—",
              row.year ?? "—",
            ])}
          />
        </Accordion>
      </div>
    </aside>
  );
}
