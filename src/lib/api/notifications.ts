import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type NotificationRow = Database["public"]["Tables"]["talent_notifications"]["Row"];

export async function listNotifications(): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("talent_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function unreadNotificationCount(): Promise<number> {
  const { data, error } = await supabase
    .from("talent_notifications")
    .select("id")
    .is("read_at", null);
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("talent_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from("talent_notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw new Error(error.message);
}
