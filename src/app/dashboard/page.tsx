"use client";

import { useState, useMemo } from "react";
import { Plus, Upload, FolderPlus, Folder as FolderIcon, FileSpreadsheet, Pencil, Trash2, MoreVertical } from "lucide-react";
import { ProspectStatus, StatsData, FOLDER_COLORS } from "@/types";
import { useProspects } from "@/context/ProspectsContext";
import StatsBar from "@/components/dashboard/StatsBar";
import SearchFilter from "@/components/dashboard/SearchFilter";
import ProspectTable from "@/components/dashboard/ProspectTable";
import DetailPanel from "@/components/dashboard/DetailPanel";
import AddProspectModal from "@/components/dashboard/AddProspectModal";
import FolderImportModal from "@/components/dashboard/FolderImportModal";
import AppointmentReminder from "@/components/dashboard/AppointmentReminder";

export default function DashboardPage() {
  const { prospects, folders, createFolder, updateFolder, deleteFolder } = useProspects();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | "All">("All");
  const [selectedProspect, setSelectedProspect] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // Folder creation state
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0].value);

  // Folder import modal
  const [importFolderId, setImportFolderId] = useState<string | null>(null);

  // Editing folder
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [editFolderColor, setEditFolderColor] = useState("");

  // Context menu
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);

  const activeProspects = useMemo(() => {
    if (!activeFolderId) return prospects;
    return prospects.filter((p) => p.folderId === activeFolderId);
  }, [prospects, activeFolderId]);

  const stats: StatsData = useMemo(() => ({
    total: activeProspects.length,
    new: activeProspects.filter((p) => p.status === "New").length,
    contacted: activeProspects.filter((p) => p.status === "Contacted").length,
    qualified: activeProspects.filter((p) => p.status === "Qualified").length,
    booked: activeProspects.filter((p) => p.status === "Booked").length,
    closed: activeProspects.filter((p) => p.status === "Closed").length,
  }), [activeProspects]);

  const filtered = useMemo(() => {
    return activeProspects.filter((p) => {
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.email.toLowerCase().includes(search.toLowerCase()) ||
        p.service.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "All" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [activeProspects, search, statusFilter]);

  const selected = selectedProspect ? prospects.find((p) => p.id === selectedProspect) : null;

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const folder = createFolder(newFolderName.trim(), newFolderColor);
    setShowCreateFolder(false);
    setNewFolderName("");
    setNewFolderColor(FOLDER_COLORS[0].value);
    // Open import modal for the new folder
    setImportFolderId(folder.id);
  };

  const handleEditFolder = (id: string) => {
    if (!editFolderName.trim()) return;
    updateFolder(id, { name: editFolderName.trim(), color: editFolderColor });
    setEditingFolderId(null);
  };

  const hasFolders = folders.length > 0;

  return (
    <>
      <header className="sticky top-0 z-30 bg-[rgba(10,10,15,0.85)] backdrop-blur-xl border-b border-[var(--border)]">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4">
          <div>
            <h1 className="text-xl font-bold">Dashboard</h1>
            <p className="text-xs text-[var(--muted)]">
              {activeFolderId
                ? `Viewing: ${folders.find((f) => f.id === activeFolderId)?.name}`
                : "Manage your prospect pipeline"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateFolder(true)}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              New Folder
            </button>
            {activeFolderId && (
              <button
                onClick={() => setImportFolderId(activeFolderId)}
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import
              </button>
            )}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Prospect</span>
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Appointment Reminder Banner */}
        <AppointmentReminder />

        {/* Empty State — No Folders Yet */}
        {!hasFolders && !showCreateFolder && (
          <div className="rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--card)] p-12 text-center fade-in">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(232, 85, 61, 0.1)" }}>
              <FolderPlus className="w-8 h-8 text-[var(--accent)]" />
            </div>
            <h2 className="text-lg font-bold mb-2">Create Your First Folder</h2>
            <p className="text-sm text-[var(--muted)] max-w-md mx-auto mb-6">
              Folders help you organize your prospects by campaign, client type, or project.
              Create a folder to get started, then import your leads.
            </p>
            <button
              onClick={() => setShowCreateFolder(true)}
              className="px-6 py-3 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors inline-flex items-center gap-2"
            >
              <FolderPlus className="w-4 h-4" />
              Create Folder
            </button>
          </div>
        )}

        {/* Create Folder Form */}
        {showCreateFolder && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 fade-in">
            <h3 className="text-sm font-bold mb-4">Create New Folder</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
                  Folder Name
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g., Q2 Campaign, Real Estate Leads..."
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-zinc-600"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2 block">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {FOLDER_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setNewFolderColor(c.value)}
                      className={`w-8 h-8 rounded-lg transition-all ${
                        newFolderColor === c.value
                          ? "ring-2 ring-white ring-offset-2 ring-offset-[var(--card)] scale-110"
                          : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowCreateFolder(false); setNewFolderName(""); }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card-hover)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create & Import Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Folder Grid */}
        {hasFolders && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider">Folders</h2>
              {activeFolderId && (
                <button
                  onClick={() => setActiveFolderId(null)}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  View All Prospects
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {folders.map((folder) => {
                const folderProspects = prospects.filter((p) => p.folderId === folder.id);
                const isActive = activeFolderId === folder.id;
                const isEditing = editingFolderId === folder.id;

                return (
                  <div
                    key={folder.id}
                    className={`relative rounded-xl border bg-[var(--card)] p-4 transition-all cursor-pointer group ${
                      isActive
                        ? "border-current shadow-lg"
                        : "border-[var(--border)] hover:border-current hover:bg-[var(--card-hover)]"
                    }`}
                    style={{ borderColor: isActive ? folder.color : undefined, color: folder.color }}
                    onClick={() => !isEditing && setActiveFolderId(isActive ? null : folder.id)}
                  >
                    {/* Context Menu Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenuId(contextMenuId === folder.id ? null : folder.id);
                      }}
                      className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-black/20 transition-all"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {/* Context Menu */}
                    {contextMenuId === folder.id && (
                      <div
                        className="absolute top-8 right-2 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-xl z-20 py-1 min-w-[140px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setEditingFolderId(folder.id);
                            setEditFolderName(folder.name);
                            setEditFolderColor(folder.color);
                            setContextMenuId(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--card)] transition-colors"
                        >
                          <Pencil className="w-3 h-3" /> Edit Folder
                        </button>
                        <button
                          onClick={() => {
                            setImportFolderId(folder.id);
                            setContextMenuId(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--card)] transition-colors"
                        >
                          <Upload className="w-3 h-3" /> Import Data
                        </button>
                        <button
                          onClick={() => {
                            deleteFolder(folder.id);
                            setContextMenuId(null);
                            if (activeFolderId === folder.id) setActiveFolderId(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    )}

                    {isEditing ? (
                      <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          value={editFolderName}
                          onChange={(e) => setEditFolderName(e.target.value)}
                          className="w-full px-2 py-1 rounded bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--foreground)] focus:outline-none"
                          autoFocus
                        />
                        <div className="flex flex-wrap gap-1">
                          {FOLDER_COLORS.map((c) => (
                            <button
                              key={c.value}
                              onClick={() => setEditFolderColor(c.value)}
                              className={`w-5 h-5 rounded transition-all ${
                                editFolderColor === c.value ? "ring-2 ring-white scale-110" : ""
                              }`}
                              style={{ backgroundColor: c.value }}
                            />
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEditFolder(folder.id)}
                            className="flex-1 px-2 py-1 rounded bg-[var(--accent)] text-white text-[10px] font-medium"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingFolderId(null)}
                            className="flex-1 px-2 py-1 rounded border border-[var(--border)] text-[10px] text-[var(--foreground)]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <FolderIcon className="w-6 h-6 mb-2" style={{ color: folder.color }} />
                        <h3 className="text-sm font-medium text-[var(--foreground)] truncate">{folder.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-[var(--muted)]">{folderProspects.length} prospects</span>
                          <span className="text-[10px] text-[var(--muted)]">&middot;</span>
                          <span className="text-[10px] text-[var(--muted)]">{folder.files.length} files</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {/* Add Folder Card */}
              <button
                onClick={() => setShowCreateFolder(true)}
                className="rounded-xl border-2 border-dashed border-[var(--border)] p-4 flex flex-col items-center justify-center gap-2 text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-all min-h-[100px]"
              >
                <FolderPlus className="w-5 h-5" />
                <span className="text-xs">New Folder</span>
              </button>
            </div>
          </div>
        )}

        {/* Files in active folder */}
        {activeFolderId && (
          <div>
            {(() => {
              const activeFolder = folders.find((f) => f.id === activeFolderId);
              if (!activeFolder || activeFolder.files.length === 0) return null;
              return (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-[var(--muted)]">Files:</span>
                  {activeFolder.files.map((file) => (
                    <span
                      key={file.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs"
                    >
                      <FileSpreadsheet className="w-3 h-3 text-[var(--muted)]" />
                      {file.name}
                      <span className="text-[var(--muted)]">({file.prospectCount})</span>
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Stats & Table — only show if we have folders */}
        {hasFolders && (
          <>
            <StatsBar stats={stats} />
            <SearchFilter
              search={search}
              onSearchChange={setSearch}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
            />
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
              <ProspectTable
                prospects={filtered}
                onSelect={(p) => setSelectedProspect(p.id)}
                selectedId={selectedProspect ?? undefined}
              />
            </div>
          </>
        )}
      </div>

      {selected && (
        <DetailPanel
          prospect={selected}
          onClose={() => setSelectedProspect(null)}
        />
      )}

      {showAddModal && (
        <AddProspectModal
          onClose={() => setShowAddModal(false)}
          folders={folders}
          defaultFolderId={activeFolderId}
        />
      )}

      {importFolderId && (
        <FolderImportModal
          folderId={importFolderId}
          onClose={() => setImportFolderId(null)}
        />
      )}

      {/* Click-away for context menu */}
      {contextMenuId && (
        <div className="fixed inset-0 z-10" onClick={() => setContextMenuId(null)} />
      )}
    </>
  );
}
