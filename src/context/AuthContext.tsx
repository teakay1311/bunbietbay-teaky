import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { UserProfile } from '../domain/models';

export type { UserProfile } from '../domain/models';

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

type AuthContextType = {
  isConfigured: boolean;
  requiresAuth: boolean;
  isAuthLoading: boolean;
  isCodeSent: boolean;
  session: Session | null;
  userEmail: string | null;
  profile: UserProfile | null;
  pendingInvitations: PendingInvitation[];
  authError: string | null;
  authNotice: string | null;
  clearAuthFeedback: () => void;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<void>;
  sendLoginCode: (email: string) => Promise<void>;
  verifyLoginCode: (email: string, token: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateMyProfile: (updates: Partial<UserProfile>) => Promise<void>;
  acceptInvitation: (invitationId: string) => Promise<void>;
  declineInvitation: (invitationId: string) => Promise<void>;
  refreshAuthData: () => Promise<void>;
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isLocalHost() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function getDefaultDisplayName(email: string | null) {
  if (!email) {
    return 'Traveler';
  }

  const [localPart] = email.split('@');
  return localPart ? localPart.slice(0, 1).toUpperCase() + localPart.slice(1) : 'Traveler';
}

function buildDefaultAvatar(seed: string | null) {
  return `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(seed || 'traveler')}`;
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, avatar_url, phone, birthdate, bio')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

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

async function ensureProfile(session: Session): Promise<UserProfile> {
  if (!supabase) {
    throw new Error('Supabase chưa được cấu hình');
  }

  const existing = await fetchProfile(session.user.id);
  if (existing) {
    return existing;
  }

  const email = session.user.email?.toLowerCase() ?? '';
  const displayName = getDefaultDisplayName(email);
  const avatar = buildDefaultAvatar(session.user.id);

  const { error } = await supabase
    .from('profiles')
    .insert({
      id: session.user.id,
      email,
      display_name: displayName,
      avatar_url: avatar,
    });

  if (error) {
    throw error;
  }

  const profile = await fetchProfile(session.user.id);
  if (!profile) {
    throw new Error('Không thể khởi tạo hồ sơ người dùng');
  }

  return profile;
}

async function fetchInvitations(email: string | null): Promise<PendingInvitation[]> {
  if (!supabase || !email) {
    return [];
  }

  const { data, error } = await supabase
    .from('trip_invitations')
    .select(`
      id,
      trip_id,
      email,
      role,
      status,
      created_at,
      trips:trip_id(title),
      inviter:invited_by(display_name)
    `)
    .eq('email', email.toLowerCase())
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const isConfigured = isSupabaseConfigured;
  const authModeOverride = import.meta.env.VITE_REQUIRE_AUTH?.toLowerCase();
  const requiresAuth = useMemo(() => {
    if (authModeOverride === 'true') {
      return true;
    }
    if (authModeOverride === 'false') {
      return false;
    }

    if (!isConfigured) {
      return false;
    }

    if (typeof window !== 'undefined' && window.desktopApi?.isDesktopApp) {
      return false;
    }

    return !isLocalHost();
  }, [authModeOverride, isConfigured]);

  const refreshAuthData = useCallback(async () => {
    if (!session) {
      setProfile(null);
      setPendingInvitations([]);
      return;
    }

    try {
      const [nextProfile, nextInvitations] = await Promise.all([
        ensureProfile(session),
        fetchInvitations(session.user.email ?? null),
      ]);
      setProfile(nextProfile);
      setPendingInvitations(nextInvitations);

      // Auto-accept trip invitations if setting is enabled
      // Read directly from localStorage to avoid circular dependency with SettingsContext
      const shouldAutoAcceptTrips = localStorage.getItem('autoAcceptTripInvites') !== 'false';
      if (shouldAutoAcceptTrips && supabase && nextInvitations.length > 0) {
        const pendingTrips = nextInvitations.filter(inv => inv.status === 'pending');
        if (pendingTrips.length > 0) {
          const results = await Promise.allSettled(
            pendingTrips.map(inv =>
              supabase.rpc('accept_trip_invitation', { target_invitation_id: inv.id })
            )
          );
          const accepted = results.filter(r => r.status === 'fulfilled').length;
          if (accepted > 0) {
            console.log(`[Auto-accept] Accepted ${accepted}/${pendingTrips.length} trip invitation(s)`);
            // Re-fetch to update state after auto-accepting
            const [updatedProfile, updatedInvitations] = await Promise.all([
              ensureProfile(session),
              fetchInvitations(session.user.email ?? null),
            ]);
            setProfile(updatedProfile);
            setPendingInvitations(updatedInvitations);
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTableMissing = errorMessage.includes('schema cache') || errorMessage.includes('does not exist') || errorMessage.includes('relation');
      if (isTableMissing) {
        console.warn('Supabase profile tables chưa sẵn sàng, dùng profile local.', error);
        const email = session.user.email?.toLowerCase() ?? '';
        setProfile({
          id: session.user.id,
          email,
          displayName: getDefaultDisplayName(email),
          avatar: buildDefaultAvatar(session.user.id),
        });
        setPendingInvitations([]);
        return;
      }
      throw error;
    }
  }, [session]);

  const clearAuthFeedback = useCallback(() => {
    setAuthError(null);
    setAuthNotice(null);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setIsAuthLoading(false);
      return;
    }

    let isMounted = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Failed to restore Supabase session', error);
      }

      if (!isMounted) {
        return;
      }

      setSession(data.session ?? null);
      setIsAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsCodeSent(false);
      setAuthError(null);
      setAuthNotice(null);
      setIsAuthLoading(false);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setPendingInvitations([]);
      return;
    }

    void refreshAuthData().catch((error) => {
      console.error('Failed to load auth data', error);
      setAuthError('Không thể tải hồ sơ tài khoản.');
    });

    if (!supabase || !session.user?.email) return;

    let isSubscribed = true;
    const channel = supabase
      .channel('public:trip_invitations:authContext')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trip_invitations',
          filter: `email=eq.${session.user.email.toLowerCase()}`,
        },
        () => {
          if (!isSubscribed) return;
          void refreshAuthData().catch((error) => {
            console.error('Failed to refresh auth data from realtime event', error);
          });
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('new_trip_invitation_event'));
          }
        }
      )
      .subscribe();

    return () => {
      isSubscribed = false;
      void supabase.removeChannel(channel);
    };
  }, [refreshAuthData, session]);

  const contextValue = useMemo<AuthContextType>(() => ({
    isConfigured,
    requiresAuth,
    isAuthLoading,
    isCodeSent,
    session,
    userEmail: session?.user.email ?? null,
    profile,
    pendingInvitations,
    authError,
    authNotice,
    clearAuthFeedback,
    signInWithPassword: async (email: string, password: string) => {
      if (!supabase) {
        throw new Error('Supabase chưa được cấu hình');
      }

      const normalizedEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        setAuthNotice(null);
        setAuthError('Email hoặc mật khẩu không đúng.');
        throw error;
      }

      setAuthError(null);
      setAuthNotice(null);
      setIsCodeSent(false);
    },
    signUpWithPassword: async (email: string, password: string) => {
      if (!supabase) {
        throw new Error('Supabase chưa được cấu hình');
      }

      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      if (error) {
        setAuthNotice(null);
        setAuthError('Không thể tạo tài khoản bằng mật khẩu.');
        throw error;
      }

      setAuthError(null);
      setIsCodeSent(false);
      setAuthNotice(
        data.session
          ? 'Tài khoản đã được tạo và bạn đã được đăng nhập.'
          : 'Tài khoản đã được tạo. Nếu dự án đang bật xác minh email, hãy mở email một lần để kích hoạt tài khoản.',
      );
    },
    sendLoginCode: async (email: string) => {
      if (!supabase) {
        throw new Error('Supabase chưa được cấu hình');
      }

      const normalizedEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        setAuthNotice(null);
        setAuthError('Không thể gửi mã đăng nhập.');
        throw error;
      }

      setAuthError(null);
      setAuthNotice('Mã xác thực đã được gửi tới email của bạn.');
      setIsCodeSent(true);
    },
    verifyLoginCode: async (email: string, token: string) => {
      if (!supabase) {
        throw new Error('Supabase chưa được cấu hình');
      }

      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: token.trim(),
        type: 'email',
      });

      if (error) {
        setAuthNotice(null);
        setAuthError('Mã xác thực không hợp lệ hoặc đã hết hạn.');
        throw error;
      }

      setAuthError(null);
      setAuthNotice(null);
      setIsCodeSent(false);
    },
    sendPasswordReset: async (email: string) => {
      if (!supabase) {
        throw new Error('Supabase chưa được cấu hình');
      }

      const normalizedEmail = email.trim().toLowerCase();
      const redirectTo = typeof window === 'undefined' ? undefined : `${window.location.origin}/login`;
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo,
      });

      if (error) {
        setAuthNotice(null);
        setAuthError('Không thể gửi email đặt lại mật khẩu.');
        throw error;
      }

      setAuthError(null);
      setAuthNotice('Email đặt lại mật khẩu đã được gửi. Sau khi mở liên kết, bạn có thể đổi mật khẩu trong ứng dụng.');
    },
    signOut: async () => {
      if (!supabase) {
        return;
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        setAuthError('Không thể đăng xuất tài khoản.');
        throw error;
      }

      setSession(null);
      setProfile(null);
      setPendingInvitations([]);
      setIsCodeSent(false);
      setAuthError(null);
      setAuthNotice(null);
    },
    updatePassword: async (password: string) => {
      if (!supabase || !session) {
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setAuthNotice(null);
        setAuthError('Không thể cập nhật mật khẩu.');
        throw error;
      }

      setAuthError(null);
      setAuthNotice('Mật khẩu đã được cập nhật.');
    },
    updateMyProfile: async (updates: Partial<UserProfile>) => {
      if (!supabase || !session) {
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: updates.displayName,
          avatar_url: updates.avatar,
          phone: updates.phone,
          birthdate: updates.birthdate,
          bio: updates.bio,
        })
        .eq('id', session.user.id);

      if (error) {
        setAuthNotice(null);
        setAuthError('Không thể cập nhật hồ sơ cá nhân.');
        throw error;
      }

      setAuthError(null);
      setAuthNotice('Hồ sơ cá nhân đã được cập nhật.');
      await refreshAuthData();
    },
    acceptInvitation: async (invitationId: string) => {
      if (!supabase || !session) {
        return;
      }

      const invitation = pendingInvitations.find((item) => item.id === invitationId);
      if (!invitation) {
        return;
      }

      const { error } = await supabase.rpc('accept_trip_invitation', {
        target_invitation_id: invitation.id,
      });
      if (error) {
        setAuthNotice(null);
        setAuthError('Không thể tham gia chuyến đi.');
        throw error;
      }

      setAuthError(null);
      setAuthNotice('Bạn đã nhận quyền truy cập chuyến đi.');
      await refreshAuthData();
    },
    declineInvitation: async (invitationId: string) => {
      if (!supabase) {
        return;
      }

      const { error } = await supabase
        .from('trip_invitations')
        .update({
          status: 'declined',
        })
        .eq('id', invitationId);

      if (error) {
        setAuthNotice(null);
        setAuthError('Không thể từ chối lời mời.');
        throw error;
      }

      setAuthError(null);
      setAuthNotice('Lời mời đã được từ chối.');
      await refreshAuthData();
    },
    refreshAuthData,
  }), [authError, authNotice, clearAuthFeedback, isAuthLoading, isCodeSent, isConfigured, pendingInvitations, profile, refreshAuthData, requiresAuth, session]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
