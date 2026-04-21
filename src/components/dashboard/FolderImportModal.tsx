"use client";

import { useState, useRef } from "react";
import { X, Upload, Link2, FileSpreadsheet, Loader2, CheckCircle, AlertCircle, Sparkles, ArrowRight, Eye } from "lucide-react";
import { useProspects } from "@/context/ProspectsContext";
import { Prospect, ProspectFile } from "@/types";

interface FolderImportModalProps {
  folderId: string;
  onClose: () => void;
}

type Step = "name" | "source" | "analyzing" | "preview" | "done" | "error";

export default function FolderImportModal({ folderId, onClose }: FolderImportModalProps) {
  const { addProspects, addFileToFolder, folders } = useProspects();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("name");
  const [fileName, setFileName] = useState("");
  const [importMode, setImportMode] = useState<"file" | "sheets">("file");
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [parsedProspects, setParsedProspects] = useState<Prospect[]>([]);
  const [error, setError] = useState("");

  const folder = folders.find((f) => f.id === folderId);

  const analyzeWithAI = async (headers: string[], rows: Record<string, string>[]) => {
    setStep("analyzing");
    try {
      const res = await fetch("/api/ai-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers, rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to analyze");

      setRawHeaders(headers);
      setMapping(data.mapping);

      // Add folderId and fileId to each prospect
      const fileId = `file-${Date.now()}`;
      const prospects = data.prospects.map((p: Prospect) => ({
        ...p,
        folderId,
        fileId,
        appointments: [],
      }));
      setParsedProspects(prospects);
      setStep("preview");
    } catch {
      // AI failed — fall back to manual column mapping
      setRawHeaders(headers);
      const fileId = `file-${Date.now()}`;
      // Build a best-guess mapping without AI
      const autoMapping: Record<string, string> = {};
      const guessMap: Record<string, string> = {
        name: "name", "full name": "name", fullname: "name", company: "name", "business name": "name", "company name": "name",
        "contact name": "contactName", "contact": "contactName", "owner": "contactName", "first name": "contactName",
        email: "email", "email address": "email",
        phone: "phone", mobile: "phone", cell: "phone", "phone number": "phone",
        service: "service", business: "service", niche: "service",
        address: "address", "street address": "address", location: "address", "business address": "address", city: "address",
        "google maps": "mapsUrl", "maps link": "mapsUrl", "maps url": "mapsUrl", "google maps link": "mapsUrl", "gmaps": "mapsUrl", "map link": "mapsUrl",
        website: "website", url: "website", site: "website", web: "website",
        notes: "notes", note: "notes", comments: "notes",
        status: "status", stage: "status",
      };
      headers.forEach((h) => {
        const lower = h.toLowerCase().trim();
        autoMapping[h] = guessMap[lower] || "skip";
      });
      setMapping(autoMapping);
      // Build prospects from auto-mapping
      const prospects: Prospect[] = rows.map((row, index) => {
        const p: Record<string, string> = {
          id: `import-${Date.now()}-${index}`,
          name: "", email: "", phone: "", service: "", notes: "", status: "New",
          createdAt: new Date().toISOString().split("T")[0],
          folderId, fileId,
        };
        Object.entries(autoMapping).forEach(([col, field]) => {
          if (field !== "skip" && row[col]) p[field] = String(row[col]).trim();
        });
        if (!p.name) p.name = `Lead #${index + 1}`;
        return { ...p, appointments: [] } as unknown as Prospect;
      });
      setParsedProspects(prospects);
      setStep("preview");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!fileName.trim()) setFileName(file.name.replace(/\.\w+$/, ""));

    setStep("analyzing");
    try {
      const XLSX = await import("xlsx");
      const ext = file.name.split(".").pop()?.toLowerCase();
      let workbook;

      if (ext === "csv") {
        const text = await file.text();
        workbook = XLSX.read(text, { type: "string" });
      } else {
        const data = await file.arrayBuffer();
        workbook = XLSX.read(data, { type: "array" });
      }

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
      const headers = Object.keys(rows[0] || {});

      if (!rows.length || !headers.length) {
        setError("File is empty or has no columns.");
        setStep("error");
        return;
      }

      await analyzeWithAI(headers, rows);
    } catch (err) {
      console.error("File read error:", err);
      setError("Could not read the file. Make sure it is a valid .xlsx, .xls, or .csv file.");
      setStep("error");
    }
  };

  const handleGoogleSheets = async () => {
    if (!googleSheetUrl) return;
    const match = googleSheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) { setError("Invalid Google Sheets URL"); setStep("error"); return; }

    setStep("analyzing");
    try {
      const res = await fetch(`https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`);
      if (!res.ok) throw new Error("Could not fetch sheet. Make sure it's shared publicly.");
      const csvText = await res.text();
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(csvText, { type: "string" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
      const headers = Object.keys(rows[0] || {});
      if (rows.length === 0) { setError("Sheet is empty"); setStep("error"); return; }
      await analyzeWithAI(headers, rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("error");
    }
  };

  const handleConfirm = () => {
    const fileId = parsedProspects[0]?.fileId || `file-${Date.now()}`;
    const file: ProspectFile = {
      id: fileId,
      name: fileName.trim() || "Untitled Import",
      folderId,
      createdAt: new Date().toISOString().split("T")[0],
      source: importMode === "sheets" ? "google-sheets" : "xlsx",
      prospectCount: parsedProspects.length,
    };
    addFileToFolder(folderId, file);
    addProspects(parsedProspects);
    setStep("done");
  };

  const fieldLabels: Record<string, string> = {
    name: "Company / Name", contactName: "Contact Name", email: "Email", phone: "Phone",
    service: "Service", address: "Address", mapsUrl: "Google Maps Link", website: "Website",
    notes: "Notes", status: "Status", skip: "Skipped",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-2xl w-full max-w-xl shadow-2xl fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)] sticky top-0 bg-[var(--card)] z-10 rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold">Import to {folder?.name}</h2>
            <p className="text-xs text-[var(--muted)]">AI will auto-detect your columns</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--background)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Step: Name */}
          {step === "name" && (
            <>
              <div>
                <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
                  File Name
                </label>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="e.g., March Leads, Website Inquiries..."
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-zinc-600"
                />
              </div>
              <button
                onClick={() => setStep("source")}
                disabled={!fileName.trim()}
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Choose Source
              </button>
            </>
          )}

          {/* Step: Source */}
          {step === "source" && (
            <>
              <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
                <button
                  onClick={() => setImportMode("file")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    importMode === "file" ? "bg-[var(--accent)] text-white" : "bg-[var(--card)] text-[var(--muted)]"
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" /> Upload File
                </button>
                <button
                  onClick={() => setImportMode("sheets")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    importMode === "sheets" ? "bg-[var(--accent)] text-white" : "bg-[var(--card)] text-[var(--muted)]"
                  }`}
                >
                  <Link2 className="w-4 h-4" /> Google Sheets
                </button>
              </div>

              {importMode === "file" ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border-2 border-dashed border-[var(--border)] p-10 text-center cursor-pointer hover:border-[var(--accent)] transition-all"
                >
                  <Upload className="w-8 h-8 mx-auto mb-3 text-[var(--muted)]" />
                  <p className="text-sm font-medium mb-1">Click to browse or drop a file</p>
                  <p className="text-xs text-[var(--muted)]">.xlsx, .xls, .csv</p>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="url"
                    value={googleSheetUrl}
                    onChange={(e) => setGoogleSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder:text-zinc-600"
                  />
                  <button
                    onClick={handleGoogleSheets}
                    disabled={!googleSheetUrl}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-4 h-4" /> Analyze with AI
                  </button>
                </div>
              )}
            </>
          )}

          {/* Step: Analyzing */}
          {step === "analyzing" && (
            <div className="py-10 text-center">
              <Loader2 className="w-10 h-10 mx-auto mb-4 text-[var(--accent)] animate-spin" />
              <p className="text-sm font-medium">Let AI summarize your document...</p>
              <p className="text-xs text-[var(--muted)] mt-1">Detecting columns for &quot;{fileName}&quot;</p>
            </div>
          )}

          {/* Step: Preview */}
          {step === "preview" && (
            <>
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-[var(--accent)]" /> AI Column Mapping
                </h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {rawHeaders.map((h) => (
                    <div key={h} className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[var(--background)] text-xs">
                      <span className="text-[var(--muted)] truncate mr-2">{h}</span>
                      <div className="flex items-center gap-1">
                        <ArrowRight className="w-2.5 h-2.5 text-[var(--muted)]" />
                        <span className={`font-medium ${mapping[h] === "skip" ? "text-zinc-500" : "text-[var(--accent)]"}`}>
                          {fieldLabels[mapping[h]] || mapping[h]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--border)] overflow-hidden">
                <div className="px-3 py-2 border-b border-[var(--border)] flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-[var(--muted)]" />
                  <span className="text-xs font-medium">{parsedProspects.length} leads detected</span>
                </div>
                <div className="overflow-x-auto max-h-48">
                  <table className="w-full text-[11px]">
                    <thead className="bg-[var(--background)]">
                      <tr>
                        <th className="text-left py-1.5 px-2 text-[var(--muted)]">Name</th>
                        <th className="text-left py-1.5 px-2 text-[var(--muted)]">Email</th>
                        <th className="text-left py-1.5 px-2 text-[var(--muted)]">Phone</th>
                        <th className="text-left py-1.5 px-2 text-[var(--muted)]">Service</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedProspects.slice(0, 10).map((p, i) => (
                        <tr key={i} className="border-t border-[var(--border)]">
                          <td className="py-1.5 px-2">{p.name}</td>
                          <td className="py-1.5 px-2 text-[var(--muted)]">{p.email}</td>
                          <td className="py-1.5 px-2 text-[var(--muted)]">{p.phone}</td>
                          <td className="py-1.5 px-2 text-[var(--muted)]">{p.service}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setStep("source"); setParsedProspects([]); }} className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card-hover)]">
                  Back
                </button>
                <button onClick={handleConfirm} className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Import {parsedProspects.length} Prospects
                </button>
              </div>
            </>
          )}

          {/* Step: Done */}
          {step === "done" && (
            <div className="py-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
              <p className="text-lg font-bold text-emerald-400">Imported!</p>
              <p className="text-sm text-[var(--muted)] mt-1">{parsedProspects.length} prospects added to &quot;{folder?.name}&quot;</p>
              <button onClick={onClose} className="mt-4 px-6 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)]">
                Done
              </button>
            </div>
          )}

          {/* Step: Error */}
          {step === "error" && (
            <div className="py-8 text-center">
              <AlertCircle className="w-10 h-10 mx-auto mb-3 text-rose-400" />
              <p className="text-sm font-medium text-rose-400">{error}</p>
              {error.toLowerCase().includes("api key") && (
                <button
                  onClick={() => window.location.href = "/dashboard/settings"}
                  className="mt-4 mr-2 px-6 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm hover:opacity-90"
                >
                  Go to Settings
                </button>
              )}
              <button onClick={() => setStep("source")} className="mt-4 px-6 py-2.5 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card-hover)]">
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
