import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../domain/models';
import { buildDefaultAvatar, getDefaultDisplayName } from '../domain/profileDefaults';

export type PendingInvitation = {
  id: string;
  tripId: string;
  tripTitle: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  createdAt: string;
  invitedByName: string | null;
};

type InvitationRow = {
  id: string;
  trip_id: string;
  email: string;
  role: PendingInvitation['role'];
  status: PendingInvitation['status'];
  created_at: string;
  trips?: { title?: string | null } | null;
  inviter?: { display_name?: string | null } | null;
};

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, avatar_url, phone, birthdate, bio')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id as string,
    email: data.email as string,
    displayName: data.display_name as string,
    avatar: data.avatar_url as string,
    phone: (data.phone as string | null) ?? undefined,
    birthdate: (data.birthdate as string | null) ?? undefined,
    bio: (data.bio as string | null) ?? undefined,
  };
}

export async function ensureProfile(session: Session): Promise<UserProfile> {
  if (!supabase) throw new Error('Supabase chưa được cấu hình');
  const existing = await fetchProfile(session.user.id);
  if (existing) return existing;

  const email = session.user.email?.toLowerCase() ?? '';
  const { error } = await supabase.from('profiles').insert({
    id: session.user.id,
    email,
    display_name: getDefaultDisplayName(email),
    avatar_url: buildDefaultAvatar(session.user.id),
  });
  if (error) throw error;

  const profile = await fetchProfile(session.user.id);
  if (!profile) throw new Error('Không thể khởi tạo hồ sơ người dùng');
  return profile;
}

export async function fetchInvitations(email: string | null): Promise<PendingInvitation[]> {
  if (!supabase || !email) return [];
  const { data, error } = await supabase
    .from('trip_invitations')
    .select(`id, trip_id, email, role, status, created_at, trips:trip_id(title), inviter:invited_by(display_name)`)
    .eq('email', email.toLowerCase())
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;

  return ((data ?? []) as InvitationRow[]).map((invitation) => ({
    id: invitation.id,
    tripId: invitation.trip_id,
    tripTitle: invitation.trips?.title ?? 'Chuyến đi',
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    createdAt: invitation.created_at,
    invitedByName: invitation.inviter?.display_name ?? null,
  }));
}
