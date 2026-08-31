import type { ResumeParserAdapter } from "./types";
import { LocalResumeParser } from "./local-parser";
import { PyresparserAdapter } from "./pyresparser-adapter";

export type { ParsedResumeResult, ResumeParserAdapter } from "./types";

export function getResumeParser(): ResumeParserAdapter {
  const provider = process.env.RESUME_PARSER_PROVIDER ?? "local";
  const serviceUrl = process.env.RESUME_PARSER_URL;

  if (provider === "pyresparser" && serviceUrl) {
    return new PyresparserAdapter(serviceUrl);
  }

  return new LocalResumeParser();
}
