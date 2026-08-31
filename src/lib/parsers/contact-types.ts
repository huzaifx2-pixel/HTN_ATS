export const PARSER_VERSION = "1.0";

export interface ContactField<T = string> {
  value: T;
  confidence: number;
  source: string;
  normalized: boolean;
  validated: boolean;
  raw?: string;
  line?: number;
}

export interface ParsedName {
  full_name?: ContactField;
  first_name?: ContactField;
  middle_name?: ContactField;
  last_name?: ContactField;
  preferred_name?: ContactField;
  prefix?: ContactField;
  suffix?: ContactField;
}

export interface ParsedEmailEntry {
  value: string;
  confidence: number;
  source: string;
  normalized: boolean;
  validated: boolean;
  username?: string;
  domain?: string;
  provider?: string;
  is_business?: boolean;
  is_disposable?: boolean;
  is_educational?: boolean;
  is_corporate?: boolean;
  domain_reputation?: "public" | "corporate" | "education" | "government";
  is_primary?: boolean;
  flags?: string[];
}

export interface ParsedPhoneEntry {
  value: string;
  normalized?: string;
  confidence: number;
  source: string;
  normalized_field: boolean;
  validated: boolean;
  country_code?: string;
  area_code?: string;
  national_number?: string;
  extension?: string;
  phone_type?: "mobile" | "landline" | "unknown";
  country?: string;
  flags?: string[];
}

export interface ParsedProfileLink {
  url: string;
  username?: string;
  platform: string;
  profile_type?: string;
  confidence: number;
  source: string;
  normalized: boolean;
  validated: boolean;
  flags?: string[];
}

export interface ParsedAddress {
  street?: string;
  apartment?: string;
  city?: ContactField;
  county?: string;
  state?: ContactField;
  province?: string;
  zip?: ContactField;
  country?: ContactField;
  full_address?: string;
  flags?: string[];
}

export interface ParsedWorkAuthorization {
  status?: string;
  requires_sponsorship?: boolean;
  authorized_to_work?: boolean;
  security_clearance?: string;
  visa_expiry?: string;
  labels: string[];
  confidence: number;
}

export interface ParsedAvailability {
  immediate?: boolean;
  notice_period?: string;
  available_from?: string;
  preferred_start_date?: string;
  current_employer?: string;
  actively_looking?: boolean;
  open_to_opportunities?: boolean;
  confidence: number;
}

export interface ContactQuality {
  contact_completeness_score: number;
  contact_quality_score: number;
  overall_confidence: number;
  duplicate_probability: number;
}

export interface ContactParserDiagnostics {
  header_detected: boolean;
  resume_type: "PDF" | "DOCX" | "TEXT" | "UNKNOWN";
  ocr_used: boolean;
  columns_detected: boolean;
  tables_detected: boolean;
  images_present: boolean;
  scanned_pdf: boolean;
  parse_time_ms: number;
  parser_version: string;
  warnings: string[];
}

export interface ParsedContactInfo {
  name: ParsedName;
  emails: ParsedEmailEntry[];
  phones: ParsedPhoneEntry[];
  linkedin?: ParsedProfileLink;
  github?: ParsedProfileLink;
  portfolio?: ParsedProfileLink;
  professional_profiles: ParsedProfileLink[];
  address: ParsedAddress;
  work_authorization: ParsedWorkAuthorization;
  availability: ParsedAvailability;
  quality: ContactQuality;
  search_tokens: string[];
  parser: ContactParserDiagnostics;
}
