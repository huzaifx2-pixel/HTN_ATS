import type { IslamicQuote } from "@/lib/islamic-quotes";

function timeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function ExecutiveHeader({
  firstName,
  quote,
}: {
  firstName: string;
  quote: IslamicQuote;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-[#0f172a]">
        {timeGreeting()}, {firstName}
      </h1>
      <p className="mt-1 max-w-3xl truncate text-sm italic text-muted-foreground">
        &ldquo;{quote.text}&rdquo;
      </p>
    </div>
  );
}
