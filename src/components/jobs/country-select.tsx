"use client";

import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { COUNTRIES, findCountry } from "@/lib/constants/countries";
import { cn } from "@/lib/utils";

type CountrySelectProps = {
  name: string;
  id?: string;
  defaultValue?: string;
  className?: string;
};

export function CountrySelect({ name, id, defaultValue = "", className }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(findCountry(defaultValue));

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "h-10 w-full justify-between bg-card font-normal text-sm",
              !value && "text-muted-foreground",
              className
            )}
          >
            <span className="truncate">{value || "Select country..."}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="z-50 w-[var(--radix-popover-trigger-width)] rounded-lg border border-border bg-card p-0 shadow-md"
            align="start"
            sideOffset={4}
          >
            <Command>
              <Command.Input
                placeholder="Search country..."
                className="flex h-10 w-full rounded-t-lg border-b border-border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
              />
              <Command.List className="max-h-60 overflow-y-auto p-1">
                <Command.Empty className="py-4 text-center text-sm text-muted-foreground">
                  No country found.
                </Command.Empty>
                {COUNTRIES.map((country) => (
                  <Command.Item
                    key={country}
                    value={country}
                    onSelect={(selected) => {
                      setValue(findCountry(selected));
                      setOpen(false);
                    }}
                    className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-muted"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0 text-brand-700",
                        value === country ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {country}
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
