"use client";

import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SourcingJobOption = {
  id: string;
  jobCode: string;
  title: string;
  booleanSearch: string | null;
  status: string;
  client: { name: string };
};

export function jobLabel(job: SourcingJobOption) {
  return `${job.jobCode} · ${job.title}`;
}

export function SourcingJobSelect({
  jobs,
  value,
  onChange,
}: {
  jobs: SourcingJobOption[];
  value: string;
  onChange: (jobId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = jobs.find((job) => job.id === value);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          id="sourcing-job"
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Sourcing for"
          className={cn(
            "mt-1 h-9 w-full justify-between bg-card px-2 font-normal text-sm",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="truncate">{selected ? jobLabel(selected) : "Select a job…"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-[var(--radix-popover-trigger-width)] rounded-lg border border-border bg-card p-0 shadow-md"
          align="start"
          sideOffset={4}
        >
          <Command
            filter={(value, search) => {
              const needle = search.trim().toLowerCase();
              if (!needle) return 1;
              return value.toLowerCase().includes(needle) ? 1 : 0;
            }}
          >
            <div className="flex items-center border-b border-border px-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Command.Input
                placeholder="Search job ID or title…"
                className="flex h-10 w-full bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Command.List className="max-h-60 overflow-y-auto p-1">
              <Command.Empty className="py-4 text-center text-sm text-muted-foreground">
                No job found.
              </Command.Empty>
              <Command.Item
                value="clear selection"
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-muted"
              >
                <Check className="mr-2 h-4 w-4 shrink-0 opacity-0" />
                <span className="text-muted-foreground">Select a job…</span>
              </Command.Item>
              {jobs.map((job) => (
                <Command.Item
                  key={job.id}
                  value={`${job.jobCode} ${job.title} ${job.client.name} ${job.id}`}
                  onSelect={() => {
                    onChange(job.id);
                    setOpen(false);
                  }}
                  className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-muted"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0 text-brand-700",
                      value === job.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0 truncate">
                    {jobLabel(job)}
                    {job.status !== "OPEN" ? ` (${job.status.replace("_", " ").toLowerCase()})` : ""}
                  </span>
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
