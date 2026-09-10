"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  FEATURE_ROLES,
  FEATURE_SECTIONS,
  LOCKED_FEATURE_KEYS,
  MATRIX_ROLES,
  ROLE_COLUMN_META,
  type EditableFeatureRole,
} from "@/lib/auth/features";
import { saveRoleMatrixAction } from "@/app/(dashboard)/admin/roles/actions";

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange?: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors",
        checked ? "bg-[#2563eb]" : "bg-slate-200",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

function formatUpdatedAt(value: string | null) {
  if (!value) return "Not saved yet";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RolesPermissionsMatrix({
  initialGrants,
  lastUpdated,
}: {
  initialGrants: Record<EditableFeatureRole, string[]>;
  lastUpdated: string | null;
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [grants, setGrants] = useState<Record<EditableFeatureRole, Set<string>>>(() => ({
    ADMIN: new Set(initialGrants.ADMIN),
    RECRUITER: new Set(initialGrants.RECRUITER),
    EXTERNAL_RECRUITER: new Set(initialGrants.EXTERNAL_RECRUITER),
  }));
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(lastUpdated);
  const [pending, startTransition] = useTransition();

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return FEATURE_SECTIONS;
    return FEATURE_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.label.toLowerCase().includes(needle) ||
          section.title.toLowerCase().includes(needle),
      ),
    })).filter((section) => section.items.length > 0);
  }, [query]);

  function isOn(role: (typeof MATRIX_ROLES)[number], feature: string) {
    if (role === "OWNER") return true;
    if (LOCKED_FEATURE_KEYS.includes(feature)) return false;
    return grants[role].has(feature);
  }

  function toggle(role: EditableFeatureRole, feature: string, next: boolean) {
    if (LOCKED_FEATURE_KEYS.includes(feature)) return;
    setGrants((current) => {
      const copy = {
        ADMIN: new Set(current.ADMIN),
        RECRUITER: new Set(current.RECRUITER),
        EXTERNAL_RECRUITER: new Set(current.EXTERNAL_RECRUITER),
      };
      if (next) copy[role].add(feature);
      else copy[role].delete(feature);
      return copy;
    });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveRoleMatrixAction({
        ADMIN: [...grants.ADMIN],
        RECRUITER: [...grants.RECRUITER],
        EXTERNAL_RECRUITER: [...grants.EXTERNAL_RECRUITER],
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSavedAt(result?.updatedAt ?? new Date().toISOString());
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Roles & Permissions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage feature access for each user role. Toggle the permissions below to control what
            each role can access.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save Changes"}
          </Button>
          <p className="text-xs text-muted-foreground">Last updated: {formatUpdatedAt(savedAt)}</p>
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search functions..."
          className="pl-9"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-[860px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="sticky left-0 z-10 min-w-[220px] bg-slate-50 px-4 py-3 text-left font-medium text-slate-700">
                Function
              </th>
              {MATRIX_ROLES.map((role) => (
                <th key={role} className="min-w-[160px] px-4 py-3 text-left font-medium text-slate-900">
                  <div>{ROLE_COLUMN_META[role].label}</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    {ROLE_COLUMN_META[role].description}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => {
              const isCollapsed = Boolean(collapsed[section.id]);
              return (
                <SectionRows
                  key={section.id}
                  title={section.title}
                  collapsed={isCollapsed}
                  onToggle={() =>
                    setCollapsed((current) => ({ ...current, [section.id]: !current[section.id] }))
                  }
                >
                  {!isCollapsed &&
                    section.items.map((item) => (
                      <tr key={item.key} className="border-b last:border-b-0">
                        <td className="sticky left-0 z-10 bg-white px-4 py-3 text-slate-800">
                          {item.label}
                        </td>
                        {MATRIX_ROLES.map((role) => {
                          const locked = role === "OWNER" || LOCKED_FEATURE_KEYS.includes(item.key);
                          return (
                            <td key={role} className="px-4 py-3">
                              <Toggle
                                checked={isOn(role, item.key)}
                                disabled={locked}
                                onChange={
                                  role === "OWNER"
                                    ? undefined
                                    : (next) => toggle(role, item.key, next)
                                }
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </SectionRows>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionRows({
  title,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr className="bg-slate-100">
        <td colSpan={1 + FEATURE_ROLES.length + 1} className="px-4 py-2">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", collapsed && "-rotate-90")} />
            {title}
          </button>
        </td>
      </tr>
      {children}
    </>
  );
}
