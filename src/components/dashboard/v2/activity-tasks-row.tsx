"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ActivityTimestamp } from "@/components/shared/activity-timestamp";
import { cn } from "@/lib/utils";
import type { PreviewActivityItem, PreviewTaskItem } from "@/lib/services/executive-dashboard-preview";

const PRIORITY_STYLES = {
  HIGH: "bg-red-50 text-red-700",
  MEDIUM: "bg-amber-50 text-amber-700",
  LOW: "bg-emerald-50 text-emerald-700",
} as const;

const STORAGE_KEY = "headsbase.dashboard.preview.tasks.v2";

type StoredTasks = {
  deletedIds: string[];
  extras: PreviewTaskItem[];
};

function loadStored(): StoredTasks {
  if (typeof window === "undefined") return { deletedIds: [], extras: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { deletedIds: [], extras: [] };
    const parsed = JSON.parse(raw) as StoredTasks;
    return {
      deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds.map(String) : [],
      extras: Array.isArray(parsed.extras)
        ? parsed.extras.map((task) => ({
            id: String(task.id),
            title: String(task.title ?? "New task"),
            meta: String(task.meta ?? "Today"),
            priority:
              task.priority === "HIGH" || task.priority === "LOW" || task.priority === "MEDIUM"
                ? task.priority
                : "MEDIUM",
            bucket:
              task.bucket === "overdue" || task.bucket === "upcoming" ? task.bucket : "today",
            href: String(task.href ?? "/dashboard/preview"),
            overdueCount: typeof task.overdueCount === "number" ? task.overdueCount : undefined,
          }))
        : [],
    };
  } catch {
    return { deletedIds: [], extras: [] };
  }
}

function ActivityCard({
  title,
  href,
  items,
}: {
  title: string;
  href: string;
  items: PreviewActivityItem[];
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#0f172a]">{title}</h3>
        <Link href={href} className="text-xs text-[#2563eb] hover:underline">
          View all
        </Link>
      </div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No recent items</p>
        ) : (
          items.map((item) => {
            const body = (
              <>
                <div className="text-sm font-medium text-[#0f172a]">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.detail}</div>
                <ActivityTimestamp createdAt={item.createdAt} className="mt-0.5 text-[10px] text-muted-foreground" />
              </>
            );
            return item.href ? (
              <Link key={item.id} href={item.href} className="block rounded-md px-1 py-1 hover:bg-muted/50">
                {body}
              </Link>
            ) : (
              <div key={item.id} className="px-1 py-1">
                {body}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function TasksPanel({
  tasks,
}: {
  tasks: { total: number; overdue: number; today: number; items: PreviewTaskItem[] };
}) {
  const [tab, setTab] = useState<"all" | "overdue" | "today">("all");
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState<PreviewTaskItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = loadStored();
    setDeletedIds(new Set(stored.deletedIds));
    setExtras(stored.extras);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ deletedIds: [...deletedIds], extras } satisfies StoredTasks),
    );
  }, [deletedIds, extras, hydrated]);

  const visibleItems = useMemo(() => {
    const base = [...extras, ...tasks.items].filter((task) => !deletedIds.has(task.id));
    const seen = new Set<string>();
    return base.filter((task) => {
      if (seen.has(task.id)) return false;
      seen.add(task.id);
      return true;
    });
  }, [tasks.items, deletedIds, extras]);

  const overdueCount = useMemo(
    () => visibleItems.filter((t) => (t.overdueCount ?? 0) > 0 || t.bucket === "overdue").length,
    [visibleItems],
  );

  const filtered = visibleItems.filter((t) => {
    if (tab === "all") return true;
    if (tab === "overdue") return (t.overdueCount ?? 0) > 0 || t.bucket === "overdue";
    return t.bucket === "today";
  });

  function removeTask(id: string) {
    setDeletedIds((prev) => new Set([...prev, id]));
    setExtras((prev) => prev.filter((task) => task.id !== id));
  }

  function addTask() {
    const title = window.prompt("Task title", "New task")?.trim();
    if (!title) return;
    const id = `local-${Date.now()}`;
    setExtras((prev) => [
      {
        id,
        title,
        meta: "Today",
        priority: "MEDIUM",
        bucket: "today",
        href: "/dashboard/preview",
      },
      ...prev,
    ]);
    setTab("today");
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#0f172a]">Tasks Due</h3>
        <div className="flex items-center gap-2">
          <div className="text-[10px] text-muted-foreground">{overdueCount.toLocaleString()} overdue</div>
          <button
            type="button"
            onClick={addTask}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2 py-1 text-[11px] font-medium text-[#2563eb] hover:bg-slate-50"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>
      </div>
      <div className="mb-4 inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
        {(
          [
            { id: "all", label: "All" },
            { id: "overdue", label: "Overdue" },
            { id: "today", label: "Today" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              tab === item.id ? "bg-white text-[#0f172a] shadow-sm" : "text-muted-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tasks in this view</p>
        ) : (
          filtered.map((task) => (
            <div key={task.id} className="flex items-start gap-2 rounded-md px-1 py-1">
              <input type="checkbox" className="mt-1 pointer-events-none" tabIndex={-1} readOnly />
              <Link
                href={task.href}
                className="-mx-1 min-w-0 flex-1 rounded-md px-1 py-0.5 hover:bg-muted/40"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-[#0f172a]">{task.title}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      PRIORITY_STYLES[task.priority],
                    )}
                  >
                    {task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {task.meta}
                  {task.overdueCount ? (
                    <span className="text-red-600"> · {task.overdueCount.toLocaleString()} overdue</span>
                  ) : null}
                </div>
              </Link>
              <button
                type="button"
                onClick={() => removeTask(task.id)}
                className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                aria-label={`Delete ${task.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function RecentActivityCard({ items }: { items: PreviewActivityItem[] }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#0f172a]">Recent Activity</h3>
        <Link href="/activity" className="text-xs text-[#2563eb] hover:underline">
          View all
        </Link>
      </div>
      <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No recent activity</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-start gap-3">
              <Avatar name={item.detail || "System"} size="sm" className="shrink-0" />
              <div className="min-w-0 flex-1">
                {item.href ? (
                  <Link href={item.href} className="text-sm font-medium text-[#0f172a] hover:underline">
                    {item.title}
                  </Link>
                ) : (
                  <div className="text-sm font-medium text-[#0f172a]">{item.title}</div>
                )}
                <div className="truncate text-xs text-muted-foreground">{item.detail}</div>
                <ActivityTimestamp createdAt={item.createdAt} className="text-[10px] text-muted-foreground" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function ActivityTasksRow({
  jobActivity,
  tasks,
}: {
  jobActivity: PreviewActivityItem[];
  tasks: { total: number; overdue: number; today: number; items: PreviewTaskItem[] };
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ActivityCard title="Recent Job Activity" href="/jobs/activity" items={jobActivity} />
      <TasksPanel tasks={tasks} />
    </div>
  );
}
