import { cn, getInitials } from "@/lib/utils";

export function Avatar({
  name,
  src,
  className,
  size = "md",
}: {
  name: string;
  src?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-12 w-12 text-base" : "h-10 w-10 text-sm";
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn("rounded-full object-cover", sizeClass, className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-brand-700/10 font-medium text-brand-700",
        sizeClass,
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}
