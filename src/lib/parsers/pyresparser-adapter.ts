import type { ResumeParserAdapter, ParsedResumeResult } from "./types";
import { LocalResumeParser } from "./local-parser";

/** Response shape from the optional Python pyresparser sidecar */
interface PyresparserResponse {
  name?: string | null;
  email?: string | null;
  mobile_number?: string | null;
  skills?: string[] | null;
  college_name?: string[] | null;
  degree?: string[] | null;
  designation?: string[] | null;
  company_names?: string[] | null;
  total_experience?: number | null;
  experience?: string[] | null;
}

function mapPyresparserResult(data: PyresparserResponse, rawText: string): ParsedResumeResult {
  const nameParts = (data.name ?? "").trim().split(/\s+/).filter(Boolean);
  const designations = data.designation ?? [];
  const companies = data.company_names ?? [];

  return {
    firstName: nameParts[0],
    lastName: nameParts.slice(1).join(" ") || undefined,
    email: data.email ?? undefined,
    phone: data.mobile_number ?? undefined,
    currentRole: designations[0],
    currentCompany: companies[0],
    skills: data.skills ?? [],
    experience: designations.map((role, i) => ({
      role,
      company: companies[i] ?? "Unknown",
    })),
    education: (data.college_name ?? []).map((institution, i) => ({
      institution,
      degree: data.degree?.[i],
    })),
    certifications: [],
    rawText,
    experienceYears: data.total_experience ?? undefined,
  };
}

/**
 * Calls an optional Python pyresparser HTTP service (spaCy NER).
 * Falls back to the enhanced local parser if the service is unavailable.
 */
export class PyresparserAdapter implements ResumeParserAdapter {
  private fallback = new LocalResumeParser();

  constructor(private serviceUrl: string) {}

  async parse(buffer: Buffer, mimeType: string, fileName?: string): Promise<ParsedResumeResult> {
    const local = await this.fallback.parse(buffer, mimeType, fileName);

    try {
      const ext =
        mimeType === "application/pdf" ? "pdf" :
        mimeType.includes("wordprocessingml") ? "docx" : "txt";

      const formData = new FormData();
      formData.append(
        "file",
        new Blob([new Uint8Array(buffer)], { type: mimeType }),
        `resume.${ext}`
      );

      const res = await fetch(`${this.serviceUrl.replace(/\/$/, "")}/parse`, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) return local;

      const data = (await res.json()) as PyresparserResponse;
      const mapped = mapPyresparserResult(data, local.rawText);

      return {
        ...local,
        ...mapped,
        skills: mapped.skills.length > 0 ? mapped.skills : local.skills,
        linkedIn: local.linkedIn,
        githubUrl: local.githubUrl,
        portfolioUrl: local.portfolioUrl,
        contact: local.contact,
        city: local.city,
        state: local.state,
        country: local.country,
        zipCode: local.zipCode,
        location: local.location,
        workAuthorization: local.workAuthorization,
        availability: local.availability,
        experience: mapped.experience.length > 0 ? mapped.experience : local.experience,
        education: mapped.education.length > 0 ? mapped.education : local.education,
        experienceYears: mapped.experienceYears ?? local.experienceYears,
      };
    } catch {
      return local;
    }
  }
}
