import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";
import type {
  Prospect,
  Folder,
  ProspectFile,
  AppointmentRecord,
  ProspectStatus,
  AppointmentOutcome,
  AppointmentDuration,
  CancelReason,
} from "@/types";

export async function requireUser(): Promise<string | null> {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) return null;
  return session.userId;
}

type DbProspect = {
  id: string;
  user_id: string;
  folder_id: string;
  file_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  service: string | null;
  notes: string | null;
  address: string | null;
  website: string | null;
  contact_name: string | null;
  maps_url: string | null;
  status: string;
  deal_value: number | string | null;
  closed_at: string | null;
  generated_website_id: string | null;
  created_at: string;
};

type DbFolder = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
};

type DbFile = {
  id: string;
  folder_id: string;
  user_id: string;
  name: string;
  source: string;
  prospect_count: number;
  created_at: string;
};

type DbAppointment = {
  id: string;
  user_id: string;
  prospect_id: string;
  date: string;
  time: string;
  duration: number;
  meet_link: string | null;
  agenda: string | null;
  meeting_notes: string | null;
  summarized_notes: string | null;
  outcome: string;
  cancel_reason: string | null;
  calendar_event_id: string | null;
  created_at: string;
};

export function mapProspect(
  row: DbProspect,
  appointments: AppointmentRecord[],
): Prospect {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? "",
    email: row.email ?? "",
    service: row.service ?? "",
    notes: row.notes ?? "",
    address: row.address ?? undefined,
    website: row.website ?? undefined,
    contactName: row.contact_name ?? undefined,
    mapsUrl: row.maps_url ?? undefined,
    status: (row.status as ProspectStatus) ?? "New",
    createdAt: row.created_at,
    folderId: row.folder_id,
    fileId: row.file_id ?? undefined,
    appointments,
    dealValue: row.deal_value == null ? undefined : Number(row.deal_value),
    closedAt: row.closed_at ?? undefined,
    generatedWebsiteId: row.generated_website_id ?? undefined,
  };
}

export function mapAppointment(row: DbAppointment): AppointmentRecord {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    duration: row.duration as AppointmentDuration,
    meetLink: row.meet_link ?? undefined,
    agenda: row.agenda ?? undefined,
    meetingNotes: row.meeting_notes ?? undefined,
    summarizedNotes: row.summarized_notes ?? undefined,
    outcome: (row.outcome as AppointmentOutcome) ?? "pending",
    cancelReason: (row.cancel_reason as CancelReason | null) ?? undefined,
    createdAt: row.created_at,
    calendarEventId: row.calendar_event_id ?? undefined,
  };
}

export function mapFolder(row: DbFolder, files: ProspectFile[]): Folder {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    files,
  };
}

export function mapFile(row: DbFile): ProspectFile {
  return {
    id: row.id,
    name: row.name,
    folderId: row.folder_id,
    createdAt: row.created_at,
    source: (row.source as ProspectFile["source"]) ?? "manual",
    prospectCount: row.prospect_count ?? 0,
  };
}

export async function loadCrmState(userId: string): Promise<{
  prospects: Prospect[];
  folders: Folder[];
}> {
  const [foldersRes, filesRes, prospectsRes, appointmentsRes] = await Promise.all([
    supabaseAdmin.from("folders").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
    supabaseAdmin.from("files").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
    supabaseAdmin.from("prospects").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabaseAdmin.from("appointments").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
  ]);

  const folderRows = (foldersRes.data ?? []) as DbFolder[];
  const fileRows = (filesRes.data ?? []) as DbFile[];
  const prospectRows = (prospectsRes.data ?? []) as DbProspect[];
  const apptRows = (appointmentsRes.data ?? []) as DbAppointment[];

  const filesByFolder = new Map<string, ProspectFile[]>();
  for (const f of fileRows) {
    const mapped = mapFile(f);
    const bucket = filesByFolder.get(f.folder_id) ?? [];
    bucket.push(mapped);
    filesByFolder.set(f.folder_id, bucket);
  }

  const apptsByProspect = new Map<string, AppointmentRecord[]>();
  for (const a of apptRows) {
    const mapped = mapAppointment(a);
    const bucket = apptsByProspect.get(a.prospect_id) ?? [];
    bucket.push(mapped);
    apptsByProspect.set(a.prospect_id, bucket);
  }

  const folders = folderRows.map((f) => mapFolder(f, filesByFolder.get(f.id) ?? []));
  const prospects = prospectRows.map((p) => mapProspect(p, apptsByProspect.get(p.id) ?? []));

  return { prospects, folders };
}
