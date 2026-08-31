"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Search, Plus, Calendar, Bell, Mail, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";

function SearchField({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  }

  return (
    <form onSubmit={onSubmit} className="relative mx-auto w-full max-w-2xl flex-1">
      <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search candidates, jobs, companies, contacts..."
        className="h-10 w-full rounded-full border border-border bg-[#f4f6f8] pl-10 pr-20 text-sm outline-none ring-brand-700/30 focus:ring-2"
        aria-label="Universal search"
      />
      <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-white px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
        ⌘ K
      </kbd>
    </form>
  );
}

export function TopBar({
  user,
  notificationCount = 0,
  messageCount = 0,
}: {
  user?: { name: string; image?: string | null; role?: string };
  notificationCount?: number;
  messageCount?: number;
}) {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-white px-5">
      <SearchField key={urlQuery} initialQuery={urlQuery} />
      <div className="flex shrink-0 items-center gap-1">
        <Button asChild size="icon" className="h-9 w-9 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8]">
          <Link href="/jobs/create" title="Add new">
            <Plus className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9" asChild title="Calendar">
          <Link href="/jobs/activity">
            <Calendar className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" asChild title="Notifications">
          <Link href="/messages">
            <Bell className="h-4 w-4" />
            {notificationCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] text-white">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </Link>
        </Button>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" asChild title="Messages">
          <Link href="/messages">
            <Mail className="h-4 w-4" />
            {messageCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] text-white">
                {messageCount > 9 ? "9+" : messageCount}
              </span>
            )}
          </Link>
        </Button>
        {user ? (
          <Link
            href="/settings/profile"
            className="ml-2 flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 hover:bg-muted/50"
          >
            <Avatar name={user.name} src={user.image} size="sm" />
            <div className="hidden text-left lg:block">
              <div className="text-xs font-medium leading-tight">{user.name}</div>
              <div className="text-[10px] capitalize text-muted-foreground">{user.role?.toLowerCase() ?? "recruiter"}</div>
            </div>
            <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground lg:block" />
          </Link>
        ) : null}
      </div>
    </header>
  );
}
