"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { CandidateListNav } from "@/components/candidates/candidate-list-nav";
import {
  ChevronDown,
  ChevronRight,
  Home,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Printer,
  Search,
  Globe,
} from "lucide-react";
import type { ProfileCertification, ProfileEducation, ProfileExperience } from "@/lib/candidates/profile-view-data";

export type RecordNote = {
  id: string;
  date: string;
  recruiter: string;
  jobLabel?: string;
  jobHref?: string;
  note: string;
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

export function CandidateRecordSidebar({
  candidateId,
  name,
  email,
  phone,
  location,
  linkedIn,
  notes,
  skills,
  experience,
  education,
  certifications,
}: {
  candidateId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  linkedIn?: string | null;
  notes: RecordNote[];
  skills: string[];
  experience: ProfileExperience[];
  education: ProfileEducation[];
  certifications: ProfileCertification[];
}) {
  return (
    <aside className="flex h-full w-[min(320px,34%)] min-w-[240px] shrink-0 flex-col overflow-hidden border-r border-[#b8c4d4] bg-white">
        <div className="flex items-center gap-1 border-b border-[#c5d0dc] bg-[#f4f7fa] px-2 py-1">
          <Link href="/candidates" className="rounded p-1 text-[#1e4e8c] hover:bg-[#dce6f2]" title="Candidates">
            <Home className="h-3.5 w-3.5" />
          </Link>
          <Link href="/candidates/search" className="rounded p-1 text-[#1e4e8c] hover:bg-[#dce6f2]" title="Search">
            <Search className="h-3.5 w-3.5" />
          </Link>
          <Link
            href={`/candidates/${candidateId}?tab=edit`}
            className="rounded p-1 text-[#1e4e8c] hover:bg-[#dce6f2]"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>
          <Link
            href={`/candidates/${candidateId}?tab=email`}
            className="rounded p-1 text-[#1e4e8c] hover:bg-[#dce6f2]"
            title="Email"
          >
            <Mail className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded p-1 text-[#1e4e8c] hover:bg-[#dce6f2]"
            title="Print"
          >
            <Printer className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex items-center justify-center border-b border-[#c5d0dc] bg-[#e8eef5] px-1 py-0.5">
          <Suspense fallback={null}>
            <CandidateListNav candidateId={candidateId} />
          </Suspense>
        </div>

      <div className="border-b border-[#c5d0dc] px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-sm font-bold text-[#1a2b3c]">{name}</h1>
          <div className="flex shrink-0 items-center gap-1">
            <Link href={`/candidates/${candidateId}?tab=edit`} className="text-orange-500" title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </Link>
            {email ? (
              <a href={`mailto:${email}`} className="text-[#1e4e8c]" title="Email">
                <Mail className="h-3.5 w-3.5" />
              </a>
            ) : null}
            {linkedIn ? (
              <a href={linkedIn} target="_blank" rel="noreferrer" className="text-[#0a66c2]" title="LinkedIn">
                <Globe className="h-3.5 w-3.5" />
              </a>
            ) : null}
            {phone ? (
              <a href={`tel:${phone}`} className="text-emerald-700" title="Call">
                <Phone className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        </div>
        <div className="mt-1 space-y-0.5 text-[11px] text-[#3d4f63]">
          {email ? (
            <a href={`mailto:${email}`} className="block truncate text-[#1e4e8c] hover:underline">
              {email}
            </a>
          ) : (
            <div className="text-muted-foreground">No email</div>
          )}
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{location || "—"}</span>
          </div>
          {phone ? (
            <a href={`tel:${phone}`} className="block text-[#1e4e8c] hover:underline">
              {phone}
            </a>
          ) : (
            <div>No phone</div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Accordion title="Activities" count={notes.length}>
          {notes.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-muted-foreground">No activities yet.</p>
          ) : (
            <ul className="divide-y divide-[#e6edf4] text-[11px]">
              {notes.slice(0, 8).map((note) => (
                <li key={note.id} className="px-2 py-1.5">
                  <div className="text-[#4b5d73]">{note.date}</div>
                  <div>{note.note}</div>
                </li>
              ))}
            </ul>
          )}
        </Accordion>

        <Accordion title="Notes" count={notes.length} defaultOpen addHref={`/candidates/${candidateId}?tab=activity`}>
          {notes.length === 0 ? (
            <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">No notes yet.</p>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-[#eef3f8] text-left text-[#4b5d73]">
                  <th className="px-1.5 py-1 font-medium">Date</th>
                  <th className="px-1.5 py-1 font-medium">Recruiter</th>
                  <th className="px-1.5 py-1 font-medium">Job #</th>
                  <th className="px-1.5 py-1 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {notes.slice(0, 12).map((note) => (
                  <tr key={note.id} className="border-t border-[#e6edf4] align-top">
                    <td className="whitespace-nowrap px-1.5 py-1 text-[#4b5d73]">{note.date}</td>
                    <td className="px-1.5 py-1">{note.recruiter}</td>
                    <td className="px-1.5 py-1">
                      {note.jobHref ? (
                        <Link href={note.jobHref} className="text-[#1e4e8c] hover:underline">
                          {note.jobLabel}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-1.5 py-1">
                      <Link href={`/candidates/${candidateId}?tab=activity`} className="text-[#1e4e8c] hover:underline">
                        {note.note}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Accordion>

        <Accordion title="Qualifications" count={skills.length}>
          {skills.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-muted-foreground">No skills parsed.</p>
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
          {certifications.length === 0 ? (
            <EmptyTable columns={["Name", "Issuer", "Exp Date"]} />
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-[#eef3f8] text-left text-[#4b5d73]">
                  <th className="px-2 py-1 font-medium">Name</th>
                  <th className="px-2 py-1 font-medium">Issuer</th>
                  <th className="px-2 py-1 font-medium">Exp Date</th>
                </tr>
              </thead>
              <tbody>
                {certifications.map((row) => (
                  <tr key={row.name} className="border-t border-[#e6edf4]">
                    <td className="px-2 py-1">{row.name}</td>
                    <td className="px-2 py-1">{row.issuer ?? "—"}</td>
                    <td className="px-2 py-1">{row.expiry ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Accordion>

        <Accordion title="Experience" count={experience.length}>
          {experience.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-muted-foreground">No experience parsed.</p>
          ) : (
            <ul className="divide-y divide-[#e6edf4] text-[11px]">
              {experience.map((job, index) => (
                <li key={`${job.company}-${index}`} className="px-2 py-1.5">
                  <div className="font-medium">{job.title}</div>
                  <div className="text-[#4b5d73]">{job.company}</div>
                  <div className="text-[#7a8b9c]">{[job.start, job.end].filter(Boolean).join(" – ")}</div>
                </li>
              ))}
            </ul>
          )}
        </Accordion>

        <Accordion title="Education" count={education.length}>
          {education.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-muted-foreground">No education parsed.</p>
          ) : (
            <ul className="divide-y divide-[#e6edf4] text-[11px]">
              {education.map((row, index) => (
                <li key={`${row.institution}-${index}`} className="px-2 py-1.5">
                  <div className="font-medium">{row.institution}</div>
                  <div className="text-[#4b5d73]">{[row.degree, row.field, row.year].filter(Boolean).join(" · ")}</div>
                </li>
              ))}
            </ul>
          )}
        </Accordion>
      </div>

      <div className="border-t border-[#c5d0dc] bg-[#f4f7fa] px-2 py-1.5 text-[10px] text-[#4b5d73]">
        <Plus className="mr-1 inline h-3 w-3" />
        Candidate record
      </div>
    </aside>
  );
}
