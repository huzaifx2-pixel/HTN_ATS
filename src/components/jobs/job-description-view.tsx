function splitLines(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.trim().replace(/^[-•*]\s*/, ""))
    .filter(Boolean);
}

export function JobDescriptionView({
  description,
  responsibilities,
  requirementsText,
  preferredQualifications,
  skills = [],
}: {
  description?: string | null;
  responsibilities?: string | null;
  requirementsText?: string | null;
  preferredQualifications?: string | null;
  skills?: string[];
}) {
  const hasStructured = Boolean(
    responsibilities?.trim() ||
      requirementsText?.trim() ||
      preferredQualifications?.trim() ||
      skills.length > 0
  );

  if (!hasStructured) {
    if (!description?.trim()) return null;
    return <div className="pt-2 whitespace-pre-wrap">{description}</div>;
  }

  return (
    <div className="space-y-6 pt-2">
      {responsibilities?.trim() && (
        <JobDescriptionSection title="Key Responsibilities" items={splitLines(responsibilities)} />
      )}

      {requirementsText?.trim() && (
        <JobDescriptionSection title="Requirements" items={splitLines(requirementsText)} />
      )}

      {preferredQualifications?.trim() && (
        <JobDescriptionSection title="Preferred qualifications" items={splitLines(preferredQualifications)} />
      )}

      {skills.length > 0 && <JobDescriptionSection title="Skills" items={skills} />}
    </div>
  );
}

function JobDescriptionSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground/90">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
