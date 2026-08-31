const STORAGE_KEY = "headsbase.candidateNav";
const MAX_IDS = 500;

export type CandidateNavState = {
  ids: string[];
  returnTo: string;
};

export function saveCandidateNav(ids: string[], returnTo: string, mode: "replace" | "append" = "replace") {
  if (typeof window === "undefined" || ids.length === 0) return;
  const unique = [...new Set(ids.filter(Boolean))];
  let nextIds = unique;
  if (mode === "append") {
    const current = readCandidateNav();
    const merged = current ? [...current.ids] : [];
    for (const id of unique) {
      if (!merged.includes(id)) merged.push(id);
    }
    nextIds = merged.slice(-MAX_IDS);
  }
  const state: CandidateNavState = { ids: nextIds, returnTo };
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function readCandidateNav(): CandidateNavState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CandidateNavState;
    if (!Array.isArray(parsed.ids) || parsed.ids.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function candidateNavPosition(candidateId: string, state: CandidateNavState | null) {
  if (!state) return null;
  const index = state.ids.indexOf(candidateId);
  if (index < 0) return null;
  return {
    index,
    total: state.ids.length,
    prevId: index > 0 ? state.ids[index - 1] : null,
    nextId: index < state.ids.length - 1 ? state.ids[index + 1] : null,
    returnTo: state.returnTo,
  };
}
