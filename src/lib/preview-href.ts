export function previewHref(type: "candidate" | "job" | "client", id: string, basePath: string) {
  const params = new URLSearchParams({ preview: type, id });
  return `${basePath}?${params.toString()}`;
}
