"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { importAudienceAction } from "@/app/marketing-actions";
import {
  CONTACT_IMPORT_TEMPLATE_HEADERS,
  parseContactImportFile,
  type ImportedContactRow,
} from "@/lib/marketing/parse-contact-import";

export function AudienceImport() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportedContactRow[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onFileChange = async (file: File | null) => {
    setMessage(null);
    if (!file) {
      setFileName(null);
      setPreview([]);
      setSkipped(0);
      setErrors([]);
      return;
    }

    try {
      const parsed = await parseContactImportFile(file);
      setFileName(file.name);
      setPreview(parsed.rows.slice(0, 8));
      setSkipped(parsed.skipped);
      setErrors(parsed.errors);
      if (parsed.rows.length === 0) {
        setMessage("No valid rows found. Make sure the file includes an Email column.");
      }
    } catch (error) {
      setFileName(null);
      setPreview([]);
      setMessage(error instanceof Error ? error.message : "Failed to read file");
    }
  };

  const downloadTemplate = () => {
    const csv = `${CONTACT_IMPORT_TEMPLATE_HEADERS.join(",")}\nJane Doe,Jane,Doe,HR Manager,Human Resources,jane@example.com,Acme Corp`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "marketing-contacts-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const save = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage("Choose a CSV or XLSX file first.");
      return;
    }

    const formData = new FormData();
    formData.set("name", name);
    formData.set("description", description);
    formData.set("file", file);

    startTransition(async () => {
      try {
        const result = await importAudienceAction(formData);
        setMessage(`Imported ${result.imported} contact(s)${result.skipped ? ` (${result.skipped} duplicates skipped)` : ""}.`);
        setName("");
        setDescription("");
        setPreview([]);
        setFileName(null);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Import failed");
      }
    });
  };

  return (
    <div className="max-w-3xl space-y-4 rounded-lg border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold">Import contacts from CSV or Excel</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Supported columns: Contact Name, First Name, Last Name, Title, Department, Email, Company
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Audience name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
            placeholder="Imported HR Contacts"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Upload file</label>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => void onFileChange(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
          Download CSV template
        </Button>
        {fileName && (
          <span className="self-center text-xs text-muted-foreground">
            {fileName} · {preview.length > 0 ? `${preview.length}+ contacts ready` : "no valid rows"}
            {skipped > 0 ? ` · ${skipped} duplicate emails skipped` : ""}
          </span>
        )}
      </div>

      {preview.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-muted/50">
              <tr>
                {CONTACT_IMPORT_TEMPLATE_HEADERS.map((header) => (
                  <th key={header} className="px-3 py-2 font-medium">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, index) => (
                <tr key={`${row.email}-${index}`} className="border-t border-border">
                  <td className="px-3 py-2">{row.contactName ?? ""}</td>
                  <td className="px-3 py-2">{row.firstName ?? ""}</td>
                  <td className="px-3 py-2">{row.lastName ?? ""}</td>
                  <td className="px-3 py-2">{row.title ?? ""}</td>
                  <td className="px-3 py-2">{row.department ?? ""}</td>
                  <td className="px-3 py-2">{row.email}</td>
                  <td className="px-3 py-2">{row.company ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {errors.length > 0 && (
        <p className="text-xs text-amber-700">{errors[0]}</p>
      )}
      {message && (
        <p className={`text-sm ${message.startsWith("Imported") ? "text-green-700" : "text-red-600"}`}>{message}</p>
      )}

      <Button type="button" onClick={save} disabled={pending || !name.trim() || preview.length === 0}>
        {pending ? "Importing..." : "Import & save audience"}
      </Button>
    </div>
  );
}
