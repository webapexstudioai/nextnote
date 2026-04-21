"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plus, FolderPlus, Folder as FolderIcon, FileSpreadsheet, FilePlus, ChevronRight,
  Upload, Pencil, Trash2, MoreVertical, List, ArrowLeft, Search, X, Inbox,
} from "lucide-react";
import { FOLDER_COLORS, ProspectStatus } from "@/types";
import { useProspects } from "@/context/ProspectsContext";
import ProspectKanban from "@/components/dashboard/ProspectKanban";
import DetailPanel from "@/components/dashboard/DetailPanel";
import AddProspectModal from "@/components/dashboard/AddProspectModal";
import FolderImportModal from "@/components/dashboard/FolderImportModal";
import ConfirmModal from "@/components/ui/ConfirmModal";

function ProspectsPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const folderId = params.get("folder");
  const fileId = params.get("file");

  const {
    prospects, folders,
    createFolder, updateFolder, deleteFolder,
    createFile, renameFile, deleteFile,
    moveProspectToFile,
  } = useProspects();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addStatus, setAddStatus] = useState<ProspectStatus | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Folder / file creation
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0].value);
  const [showCreateFile, setShowCreateFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  // Context menus
  const [folderMenu, setFolderMenu] = useState<string | null>(null);
  const [fileMenu, setFileMenu] = useState<string | null>(null);

  // Editing
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [editFolderColor, setEditFolderColor] = useState("");
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editFileName, setEditFileName] = useState("");

  const [importFolderId, setImportFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [movingProspectId, setMovingProspectId] = useState<string | null>(null);

  useEffect(() => {
    if (!folderMenu && !fileMenu) return;
    const close = () => { setFolderMenu(null); setFileMenu(null); };
    const t = setTimeout(() => document.addEventListener("click", close), 0);
    return () => { clearTimeout(t); document.removeEventListener("click", close); };
  }, [folderMenu, fileMenu]);

  const activeFolder = folderId ? folders.find((f) => f.id === folderId) : null;
  const activeFile = activeFolder && fileId ? activeFolder.files.find((f) => f.id === fileId) : null;

  const kanbanProspects = useMemo(() => {
    if (!activeFolder) return [];
    let list = prospects.filter((p) => p.folderId === activeFolder.id);
    if (activeFile) list = list.filter((p) => p.fileId === activeFile.id);
    else if (fileId === "unfiled") list = list.filter((p) => !p.fileId);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const digits = q.replace(/\D/g, "");
      list = list.filter((p) => {
        const hay = `${p.name ?? ""} ${p.contactName ?? ""} ${p.email ?? ""} ${p.service ?? ""} ${p.notes ?? ""}`.toLowerCase();
        if (hay.includes(q)) return true;
        if (digits && (p.phone ?? "").replace(/\D/g, "").includes(digits)) return true;
        return false;
      });
    }
    return list;
  }, [prospects, activeFolder, activeFile, fileId, searchQuery]);

  const selected = selectedId ? prospects.find((p) => p.id === selectedId) : null;

  const go = (qs: Record<string, string | null>) => {
    const p = new URLSearchParams();
    if (qs.folder) p.set("folder", qs.folder);
    if (qs.file) p.set("file", qs.file);
    const q = p.toString();
    router.push(q ? `/dashboard/prospects?${q}` : "/dashboard/prospects");
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const f = createFolder(newFolderName.trim(), newFolderColor);
    setShowCreateFolder(false);
    setNewFolderName("");
    setNewFolderColor(FOLDER_COLORS[0].value);
    go({ folder: f.id, file: null });
  };

  const handleCreateFile = () => {
    if (!newFileName.trim() || !activeFolder) return;
    const f = createFile(activeFolder.id, newFileName.trim());
    setShowCreateFile(false);
    setNewFileName("");
    go({ folder: activeFolder.id, file: f.id });
  };

  // ---------- LEVEL 3: KANBAN VIEW ----------
  if (activeFolder && (activeFile || fileId === "unfiled")) {
    const isTriage = fileId === "unfiled";
    const fileLabel = activeFile?.name ?? "Triage";
    return (
      <>
        <header className="sticky top-0 z-30 liquid-glass-strong border-b border-white/5">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 gap-3">
            <div className="min-w-0 flex items-center gap-3">
              <button
                onClick={() => go({ folder: activeFolder.id, file: null })}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                  <button onClick={() => go({ folder: null, file: null })} className="hover:text-[var(--foreground)] transition-colors">Prospects</button>
                  <ChevronRight className="w-3 h-3" />
                  <button onClick={() => go({ folder: activeFolder.id, file: null })} className="hover:text-[var(--foreground)] transition-colors truncate">{activeFolder.name}</button>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-[var(--foreground)] truncate">{fileLabel}</span>
                </div>
                <h1 className="text-xl font-bold tracking-tight truncate flex items-center gap-2">
                  {isTriage && <Inbox className="w-5 h-5 text-[var(--muted)]" />}
                  {fileLabel}
                </h1>
                <p className="text-[11px] text-[var(--muted)]">
                  {isTriage
                    ? `${kanbanProspects.length} prospect${kanbanProspects.length === 1 ? "" : "s"} waiting to be sorted into a file`
                    : `${kanbanProspects.length} prospects · drag cards between columns`}
                </p>
              </div>
            </div>
            <button onClick={() => setShowAddModal(true)} className="liquid-btn shrink-0">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Prospect</span>
            </button>
          </div>
        </header>

        <div className="relative z-10 p-4 sm:p-6 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, email, or notes…"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl liquid-glass border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-white/10 transition-colors"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5 text-[var(--muted)]" />
              </button>
            )}
            {searchQuery && (
              <div className="absolute -bottom-5 left-2 text-[10px] text-[var(--muted)]">
                {kanbanProspects.length} match{kanbanProspects.length === 1 ? "" : "es"}
              </div>
            )}
          </div>
          <ProspectKanban
            prospects={kanbanProspects}
            onSelect={(p) => setSelectedId(p.id)}
            onAdd={(status) => { setAddStatus(status); setShowAddModal(true); }}
            onMoveToFile={isTriage ? (id) => setMovingProspectId(id) : undefined}
          />
        </div>

        {selected && <DetailPanel prospect={selected} onClose={() => setSelectedId(null)} />}
        {showAddModal && (
          <AddProspectModal
            onClose={() => { setShowAddModal(false); setAddStatus(null); }}
            folders={folders}
            defaultFolderId={activeFolder.id}
            defaultFileId={activeFile?.id ?? null}
          />
        )}
        {movingProspectId && (
          <MoveToFileModal
            files={activeFolder.files}
            onPick={(fid) => {
              moveProspectToFile(movingProspectId, fid);
              setMovingProspectId(null);
            }}
            onClose={() => setMovingProspectId(null)}
          />
        )}
      </>
    );
  }

  // ---------- LEVEL 2: FILES-IN-FOLDER VIEW ----------
  if (activeFolder) {
    const folderProspects = prospects.filter((p) => p.folderId === activeFolder.id);
    const unfiledCount = folderProspects.filter((p) => !p.fileId).length;

    return (
      <>
        <header className="sticky top-0 z-30 liquid-glass-strong border-b border-white/5">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 gap-3">
            <div className="min-w-0 flex items-center gap-3">
              <button
                onClick={() => go({ folder: null, file: null })}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                  <button onClick={() => go({ folder: null, file: null })} className="hover:text-[var(--foreground)] transition-colors">Prospects</button>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-[var(--foreground)] truncate">{activeFolder.name}</span>
                </div>
                <h1 className="text-xl font-bold tracking-tight truncate flex items-center gap-2">
                  <FolderIcon className="w-5 h-5" style={{ color: activeFolder.color }} />
                  {activeFolder.name}
                </h1>
                <p className="text-[11px] text-[var(--muted)]">{folderProspects.length} prospects across {activeFolder.files.length} files</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setImportFolderId(activeFolder.id)} className="hidden sm:inline-flex liquid-btn-ghost">
                <Upload className="w-4 h-4" />
                Import
              </button>
              <button onClick={() => setShowCreateFile(true)} className="liquid-btn">
                <FilePlus className="w-4 h-4" />
                <span className="hidden sm:inline">New File</span>
              </button>
            </div>
          </div>
        </header>

        <div className="relative z-10 p-4 sm:p-6 space-y-6">
          {showCreateFile && (
            <div className="liquid-glass rounded-2xl p-5 liquid-in">
              <h3 className="text-sm font-bold mb-3">Create a new file</h3>
              <p className="text-xs text-[var(--muted)] mb-4">Files are pipelines. Think &ldquo;Q2 Warm Leads&rdquo; or &ldquo;Tampa Cold List&rdquo; — each one gets its own Kanban board.</p>
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateFile()}
                  placeholder="File name..."
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder:text-zinc-600"
                />
                <button onClick={handleCreateFile} disabled={!newFileName.trim()} className="liquid-btn disabled:opacity-50">Create</button>
                <button onClick={() => { setShowCreateFile(false); setNewFileName(""); }} className="liquid-btn-ghost">Cancel</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {/* Triage tile — only shown when there's something to triage */}
            {unfiledCount > 0 && (
              <div
                onClick={() => go({ folder: activeFolder.id, file: "unfiled" })}
                className="liquid-glass rounded-2xl p-4 cursor-pointer liquid-in hover:bg-white/[0.04] transition-all group ring-1 ring-amber-500/20"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Inbox className="w-5 h-5 text-amber-400" />
                  </div>
                  <span className="text-[10px] text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/15">{unfiledCount}</span>
                </div>
                <div className="text-sm font-medium text-[var(--foreground)]">Triage</div>
                <div className="text-[11px] text-[var(--muted)] mt-0.5">Prospects not yet sorted into a file</div>
              </div>
            )}

            {activeFolder.files.map((file, idx) => {
              const count = folderProspects.filter((p) => p.fileId === file.id).length;
              const isEditing = editingFileId === file.id;
              return (
                <div
                  key={file.id}
                  onClick={() => !isEditing && go({ folder: activeFolder.id, file: file.id })}
                  className={`relative liquid-glass rounded-2xl p-4 cursor-pointer liquid-in hover:bg-white/[0.04] transition-all group ${idx < 6 ? `liquid-d${Math.min(idx + 1, 6)}` : ""} ${fileMenu === file.id || isEditing ? "z-20" : ""}`}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); setFileMenu(fileMenu === file.id ? null : file.id); }}
                    className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-black/20 transition-all"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                  {fileMenu === file.id && (
                    <div className="absolute top-8 right-2 liquid-glass-strong rounded-xl z-20 py-1 min-w-[140px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => { setEditingFileId(file.id); setEditFileName(file.name); setFileMenu(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--foreground)] hover:bg-white/5 transition-colors"
                      >
                        <Pencil className="w-3 h-3" /> Rename
                      </button>
                      <button
                        onClick={() => {
                          setFileMenu(null);
                          setConfirmState({
                            title: `Delete file "${file.name}"?`,
                            message: "Prospects inside will stay in the folder.",
                            onConfirm: () => deleteFile(activeFolder.id, file.id),
                          });
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  )}

                  {isEditing ? (
                    <div onClick={(e) => e.stopPropagation()} className="space-y-2">
                      <input
                        autoFocus
                        value={editFileName}
                        onChange={(e) => setEditFileName(e.target.value)}
                        className="w-full px-2 py-1.5 rounded bg-[var(--background)] border border-[var(--border)] text-xs focus:outline-none"
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            if (editFileName.trim()) renameFile(activeFolder.id, file.id, editFileName.trim());
                            setEditingFileId(null);
                          }}
                          className="flex-1 px-2 py-1 rounded bg-[var(--accent)] text-white text-[10px]"
                        >Save</button>
                        <button onClick={() => setEditingFileId(null)} className="flex-1 px-2 py-1 rounded border border-[var(--border)] text-[10px]">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/15 flex items-center justify-center">
                          <FileSpreadsheet className="w-5 h-5 text-[var(--accent)]" />
                        </div>
                        <span className="text-[10px] text-[var(--muted)] px-2 py-0.5 rounded-full bg-white/5">{count}</span>
                      </div>
                      <div className="text-sm font-medium text-[var(--foreground)] truncate">{file.name}</div>
                      <div className="text-[11px] text-[var(--muted)] mt-0.5 capitalize">{file.source} · {file.createdAt}</div>
                    </>
                  )}
                </div>
              );
            })}

            {/* Add file tile */}
            <button
              onClick={() => setShowCreateFile(true)}
              className="liquid-glass rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-[var(--muted)] hover:text-white transition-all min-h-[120px]"
              style={{ borderStyle: "dashed" }}
            >
              <FilePlus className="w-5 h-5" />
              <span className="text-xs font-medium">New File</span>
            </button>
          </div>
        </div>

        {importFolderId && <FolderImportModal folderId={importFolderId} onClose={() => setImportFolderId(null)} />}
        <ConfirmModal
          open={!!confirmState}
          title={confirmState?.title ?? ""}
          message={confirmState?.message ?? ""}
          confirmLabel="Delete"
          destructive
          onConfirm={() => { confirmState?.onConfirm(); setConfirmState(null); }}
          onCancel={() => setConfirmState(null)}
        />
      </>
    );
  }

  // ---------- LEVEL 1: FOLDERS (DRIVE ROOT) ----------
  return (
    <>
      <header className="sticky top-0 z-30 liquid-glass-strong border-b border-white/5">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">Prospects</h1>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {folders.length} folders · {prospects.length} prospects
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShowCreateFolder(true)} className="liquid-btn">
              <FolderPlus className="w-4 h-4" />
              <span className="hidden sm:inline">New Folder</span>
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 p-4 sm:p-6 space-y-6">
        {folders.length === 0 && !showCreateFolder && (
          <div className="liquid-glass rounded-3xl p-12 text-center liquid-in">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 liquid-accent">
              <FolderPlus className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-lg font-bold mb-2">Organize your pipeline</h2>
            <p className="text-sm text-[var(--muted)] max-w-md mx-auto mb-6">
              Folders group prospects by campaign or client. Inside each folder, create files that act as Kanban boards — move leads from New through Closed.
            </p>
            <button onClick={() => setShowCreateFolder(true)} className="liquid-btn">
              <FolderPlus className="w-4 h-4" />
              Create your first folder
            </button>
          </div>
        )}

        {showCreateFolder && (
          <div className="liquid-glass rounded-2xl p-6 liquid-in">
            <h3 className="text-sm font-bold mb-4">Create New Folder</h3>
            <div className="space-y-4">
              <input
                autoFocus
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                placeholder="e.g., Q2 Campaign, Real Estate Leads..."
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder:text-zinc-600"
              />
              <div className="flex flex-wrap gap-2">
                {FOLDER_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setNewFolderColor(c.value)}
                    className={`w-8 h-8 rounded-lg transition-all ${newFolderColor === c.value ? "ring-2 ring-white ring-offset-2 ring-offset-[var(--card)] scale-110" : "hover:scale-105"}`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setShowCreateFolder(false); setNewFolderName(""); }} className="flex-1 liquid-btn-ghost justify-center">Cancel</button>
                <button onClick={handleCreateFolder} disabled={!newFolderName.trim()} className="flex-1 liquid-btn justify-center disabled:opacity-50">Create</button>
              </div>
            </div>
          </div>
        )}

        {folders.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {folders.map((folder, idx) => {
              const fp = prospects.filter((p) => p.folderId === folder.id);
              const isEditing = editingFolderId === folder.id;
              return (
                <div
                  key={folder.id}
                  onClick={() => !isEditing && go({ folder: folder.id, file: null })}
                  className={`relative rounded-2xl p-4 cursor-pointer group liquid-glass liquid-in ${idx < 6 ? `liquid-d${Math.min(idx + 1, 6)}` : ""} ${folderMenu === folder.id || isEditing ? "z-20" : ""}`}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); setFolderMenu(folderMenu === folder.id ? null : folder.id); }}
                    className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-black/20 transition-all"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                  {folderMenu === folder.id && (
                    <div className="absolute top-8 right-2 liquid-glass-strong rounded-xl z-20 py-1 min-w-[140px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => { setEditingFolderId(folder.id); setEditFolderName(folder.name); setEditFolderColor(folder.color); setFolderMenu(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--foreground)] hover:bg-white/5 transition-colors"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={() => { setImportFolderId(folder.id); setFolderMenu(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--foreground)] hover:bg-white/5 transition-colors"
                      >
                        <Upload className="w-3 h-3" /> Import
                      </button>
                      <button
                        onClick={() => {
                          setFolderMenu(null);
                          setConfirmState({
                            title: `Delete folder "${folder.name}"?`,
                            message: "This folder and all prospects inside will be deleted. This cannot be undone.",
                            onConfirm: () => deleteFolder(folder.id),
                          });
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  )}
                  {isEditing ? (
                    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                      <input value={editFolderName} onChange={(e) => setEditFolderName(e.target.value)} className="w-full px-2 py-1 rounded bg-[var(--background)] border border-[var(--border)] text-xs focus:outline-none" autoFocus />
                      <div className="flex flex-wrap gap-1">
                        {FOLDER_COLORS.map((c) => (
                          <button key={c.value} onClick={() => setEditFolderColor(c.value)} className={`w-5 h-5 rounded ${editFolderColor === c.value ? "ring-2 ring-white scale-110" : ""}`} style={{ backgroundColor: c.value }} />
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => {
                          if (editFolderName.trim()) updateFolder(folder.id, { name: editFolderName.trim(), color: editFolderColor });
                          setEditingFolderId(null);
                        }} className="flex-1 px-2 py-1 rounded bg-[var(--accent)] text-white text-[10px]">Save</button>
                        <button onClick={() => setEditingFolderId(null)} className="flex-1 px-2 py-1 rounded border border-[var(--border)] text-[10px]">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <FolderIcon className="w-6 h-6 mb-2" style={{ color: folder.color }} />
                      <h3 className="text-sm font-medium text-[var(--foreground)] truncate">{folder.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-[var(--muted)]">{fp.length} prospects</span>
                        <span className="text-[10px] text-[var(--muted)]">·</span>
                        <span className="text-[10px] text-[var(--muted)]">{folder.files.length} files</span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
            <button
              onClick={() => setShowCreateFolder(true)}
              className="liquid-glass rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-[var(--muted)] hover:text-white transition-all min-h-[100px]"
              style={{ borderStyle: "dashed" }}
            >
              <FolderPlus className="w-5 h-5" />
              <span className="text-xs font-medium">New Folder</span>
            </button>
          </div>
        )}
      </div>

      {importFolderId && <FolderImportModal folderId={importFolderId} onClose={() => setImportFolderId(null)} />}
      <ConfirmModal
        open={!!confirmState}
        title={confirmState?.title ?? ""}
        message={confirmState?.message ?? ""}
        confirmLabel="Delete"
        destructive
        onConfirm={() => { confirmState?.onConfirm(); setConfirmState(null); }}
        onCancel={() => setConfirmState(null)}
      />
      {/* Suppress unused warnings for addStatus/List (kept for future quick-add slot) */}
      <span className="hidden">{addStatus}<List className="w-0 h-0" /></span>
    </>
  );
}

function MoveToFileModal({
  files,
  onPick,
  onClose,
}: {
  files: { id: string; name: string }[];
  onPick: (fileId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative liquid-glass-strong rounded-2xl p-5 max-w-sm w-full shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[var(--foreground)]">Move to file</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 transition-colors">
            <X className="w-4 h-4 text-[var(--muted)]" />
          </button>
        </div>
        {files.length === 0 ? (
          <p className="text-xs text-[var(--muted)] py-4 text-center">
            This folder has no files yet. Create one first.
          </p>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {files.map((f) => (
              <button
                key={f.id}
                onClick={() => onPick(f.id)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left hover:bg-white/5 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span className="truncate">{f.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProspectsPage() {
  return (
    <Suspense fallback={null}>
      <ProspectsPageInner />
    </Suspense>
  );
}
