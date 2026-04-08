"use client";

import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Link2, Loader2, CheckCircle, AlertCircle, Sparkles, ArrowRight, Eye } from "lucide-react";
import { useProspects } from "@/context/ProspectsContext";
import { Prospect } from "@/types";

type ImportStep = "upload" | "analyzing" | "preview" | "done" | "error";

interface ColumnMapping {
  [header: string]: string;
}

export default function ImportPage() {
  const { addProspects } = useProspects();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>("upload");
  const [fileName, setFileName] = useState("");
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [parsedProspects, setParsedProspects] = useState<Prospect[]>([]);
  const [error, setError] = useState("");
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [importMode, setImportMode] = useState<"file" | "sheets">("file");

  const parseXLSX = async (file: File) => {
    const XLSX = await import("xlsx");
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
    const headers = Object.keys(rows[0] || {});
    return { headers, rows };
  };

  const analyzeWithAI = async (headers: string[], rows: Record<string, string>[]) => {
    setStep("analyzing");
    try {
      const res = await fetch("/api/ai-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers, rows }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze file");
      }

      setMapping(data.mapping);
      setParsedProspects(data.prospects);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze file");
      setStep("error");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError("");

    try {
      const { headers, rows } = await parseXLSX(file);
      setRawHeaders(headers);
      setRawRows(rows);

      if (rows.length === 0) {
        setError("The file appears to be empty.");
        setStep("error");
        return;
      }

      await analyzeWithAI(headers, rows);
    } catch {
      setError("Could not read the file. Make sure it's a valid .xlsx or .xls file.");
      setStep("error");
    }
  };

  const handleGoogleSheets = async () => {
    if (!googleSheetUrl) return;

    setError("");
    setFileName("Google Sheet");

    // Convert Google Sheets URL to CSV export URL
    const sheetIdMatch = googleSheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch) {
      setError("Invalid Google Sheets URL. Please use a sharing link like: https://docs.google.com/spreadsheets/d/...");
      setStep("error");
      return;
    }

    const sheetId = sheetIdMatch[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

    setStep("analyzing");

    try {
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error("Could not fetch the Google Sheet. Make sure it's shared publicly (Anyone with the link).");

      const csvText = await res.text();
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(csvText, { type: "string" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
      const headers = Object.keys(rows[0] || {});

      setRawHeaders(headers);
      setRawRows(rows);

      if (rows.length === 0) {
        setError("The sheet appears to be empty.");
        setStep("error");
        return;
      }

      await analyzeWithAI(headers, rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import from Google Sheets");
      setStep("error");
    }
  };

  const handleConfirmImport = () => {
    const withAppointments = parsedProspects.map((p) => ({ ...p, appointments: p.appointments ?? [] }));
    addProspects(withAppointments as Prospect[]);
    setStep("done");
  };

  const handleReset = () => {
    setStep("upload");
    setFileName("");
    setRawHeaders([]);
    setRawRows([]);
    setMapping({});
    setParsedProspects([]);
    setError("");
    setGoogleSheetUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fieldLabels: Record<string, string> = {
    name: "Name",
    email: "Email",
    phone: "Phone",
    service: "Service",
    notes: "Notes",
    status: "Status",
    skip: "Skipped",
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-[var(--header-bg)] backdrop-blur-xl border-b border-[var(--border)]">
        <div className="px-4 sm:px-6 py-4">
          <h1 className="text-xl font-bold">Import Prospects</h1>
          <p className="text-xs text-[var(--muted)]">Import from XLSX files or Google Sheets — AI auto-detects your columns</p>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">

        {/* Step: Upload */}
        {step === "upload" && (
          <>
            {/* Import Mode Toggle */}
            <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
              <button
                onClick={() => setImportMode("file")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  importMode === "file" ? "bg-[var(--accent)] text-white" : "bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" /> Upload File
              </button>
              <button
                onClick={() => setImportMode("sheets")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  importMode === "sheets" ? "bg-[var(--accent)] text-white" : "bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <Link2 className="w-4 h-4" /> Google Sheets
              </button>
            </div>

            {importMode === "file" ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--card)] p-12 text-center cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--card-hover)] transition-all group"
              >
                <Upload className="w-10 h-10 mx-auto mb-4 text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors" />
                <p className="text-sm font-medium mb-1">Drop your spreadsheet here or click to browse</p>
                <p className="text-xs text-[var(--muted)]">Supports .xlsx, .xls, and .csv files</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
                <div>
                  <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2 block">
                    Google Sheets URL
                  </label>
                  <input
                    type="url"
                    value={googleSheetUrl}
                    onChange={(e) => setGoogleSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full px-4 py-3 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-zinc-600"
                  />
                  <p className="text-[10px] text-[var(--muted)] mt-1.5">Make sure the sheet is shared as &quot;Anyone with the link&quot;</p>
                </div>
                <button
                  onClick={handleGoogleSheets}
                  disabled={!googleSheetUrl}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-4 h-4" />
                  Analyze with AI
                </button>
              </div>
            )}

            {/* How it works */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--accent)]" /> How AI Import Works
              </h3>
              <div className="space-y-2 text-xs text-[var(--muted)]">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[rgba(232,85,61,0.1)] text-[var(--accent)] flex items-center justify-center shrink-0 text-[10px] font-bold">1</span>
                  <span>Upload your XLSX file or paste a Google Sheets link</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[rgba(232,85,61,0.1)] text-[var(--accent)] flex items-center justify-center shrink-0 text-[10px] font-bold">2</span>
                  <span>Claude AI scans your data and auto-detects columns (name, email, phone, service, notes)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[rgba(232,85,61,0.1)] text-[var(--accent)] flex items-center justify-center shrink-0 text-[10px] font-bold">3</span>
                  <span>Preview the mapped data before importing into your dashboard</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Step: Analyzing */}
        {step === "analyzing" && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-12 text-center">
            <Loader2 className="w-10 h-10 mx-auto mb-4 text-[var(--accent)] animate-spin" />
            <p className="text-sm font-medium mb-1">Claude AI is analyzing your data...</p>
            <p className="text-xs text-[var(--muted)]">Detecting columns and mapping fields for {fileName}</p>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && (
          <>
            {/* Column Mapping */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--accent)]" /> AI Column Mapping
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {rawHeaders.map((header) => (
                  <div key={header} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--background)]">
                    <span className="text-xs text-[var(--muted)] truncate">{header}</span>
                    <div className="flex items-center gap-1.5">
                      <ArrowRight className="w-3 h-3 text-[var(--muted)]" />
                      <span className={`text-xs font-medium ${mapping[header] === "skip" ? "text-zinc-500" : "text-[var(--accent)]"}`}>
                        {fieldLabels[mapping[header]] || mapping[header]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview Table */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[var(--muted)]" />
                  Preview ({parsedProspects.length} leads)
                </h3>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--background)]">
                    <tr>
                      <th className="text-left py-2 px-3 text-[var(--muted)] font-medium">Name</th>
                      <th className="text-left py-2 px-3 text-[var(--muted)] font-medium">Email</th>
                      <th className="text-left py-2 px-3 text-[var(--muted)] font-medium">Phone</th>
                      <th className="text-left py-2 px-3 text-[var(--muted)] font-medium">Service</th>
                      <th className="text-left py-2 px-3 text-[var(--muted)] font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedProspects.slice(0, 20).map((p, i) => (
                      <tr key={i} className="border-t border-[var(--border)]">
                        <td className="py-2 px-3">{p.name}</td>
                        <td className="py-2 px-3 text-[var(--muted)]">{p.email}</td>
                        <td className="py-2 px-3 text-[var(--muted)]">{p.phone}</td>
                        <td className="py-2 px-3 text-[var(--muted)]">{p.service}</td>
                        <td className="py-2 px-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 text-blue-400">
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedProspects.length > 20 && (
                  <div className="px-3 py-2 text-xs text-[var(--muted)] text-center border-t border-[var(--border)]">
                    ...and {parsedProspects.length - 20} more
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-3 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--card)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                className="flex-1 px-4 py-3 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Import {parsedProspects.length} Prospects
              </button>
            </div>
          </>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-12 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
            <p className="text-lg font-bold text-emerald-400 mb-1">Import Successful!</p>
            <p className="text-sm text-[var(--muted)] mb-6">
              {parsedProspects.length} prospects have been added to your dashboard.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleReset}
                className="px-6 py-2.5 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
              >
                Import More
              </button>
              <a
                href="/dashboard"
                className="px-6 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
              >
                View Dashboard
              </a>
            </div>
          </div>
        )}

        {/* Step: Error */}
        {step === "error" && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-8 text-center">
            <AlertCircle className="w-10 h-10 mx-auto mb-4 text-rose-400" />
            <p className="text-sm font-medium text-rose-400 mb-1">Import Failed</p>
            <p className="text-xs text-[var(--muted)] mb-4">{error}</p>
            <button
              onClick={handleReset}
              className="px-6 py-2.5 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </>
  );
}
