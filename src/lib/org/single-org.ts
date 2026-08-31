export const CANONICAL_ORG_NAME =
  process.env.HEADSBASE_ORG_NAME?.trim() || "Headsbase Consulting";

export const CANONICAL_ORG_SLUG =
  process.env.HEADSBASE_ORG_SLUG?.trim() || "headsbase-consulting";

/** LAN deployment uses one shared organization for all recruiters. */
export function isSingleOrgMode(): boolean {
  return process.env.HEADSBASE_SINGLE_ORG !== "false";
}

export function getCanonicalOrgFilter() {
  return isSingleOrgMode() ? { slug: CANONICAL_ORG_SLUG } : undefined;
}
