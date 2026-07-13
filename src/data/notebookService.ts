import { supabase } from '../lib/supabase';
import type { PendingNotebookInvitation } from '../domain/models';
import { mapNotebookInvitations } from './notebookMappers';

export async function runNotebookMutation(run: () => PromiseLike<{ error: unknown }>) {
  const response = await Promise.resolve(run());
  if (response.error) throw response.error;
}

export function isMissingSupabaseObject(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error);
  return message.includes('schema cache') || message.includes('does not exist') || message.includes('relation');
}

export async function fetchNotebookInvitations(email: string | null): Promise<PendingNotebookInvitation[]> {
  if (!supabase || !email) return [];

  const { data, error } = await supabase
    .from('notebook_invitations')
    .select(`id, notebook_id, email, role, status, created_at, notebooks:notebook_id(name), inviter:invited_by(display_name)`)
    .eq('email', email.toLowerCase())
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return mapNotebookInvitations(data ?? []);
}

export async function acceptNotebookInvitationRemote(invitationId: string) {
  if (!supabase) return;
  const { error } = await supabase.rpc('accept_notebook_invitation', { target_invitation_id: invitationId });
  if (error) throw error;
}
