import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { UserProfile } from '../domain/models';
import { ensureProfile, fetchInvitations, type PendingInvitation } from '../data/authService';
import { buildDefaultAvatar, getDefaultDisplayName } from '../domain/profileDefaults';

export type { UserProfile } from '../domain/models';
export type { PendingInvitation } from '../data/authService';

type AuthContextType = {
  isConfigured: boolean;
  requiresAuth: boolean;
  isAuthLoading: boolean;
  isPasswordRecovery: boolean;
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
  cancelPasswordRecovery: () => Promise<void>;
  signOut: () => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateMyProfile: (updates: Partial<UserProfile>) => Promise<void>;
  acceptInvitation: (invitationId: string) => Promise<void>;
  declineInvitation: (invitationId: string) => Promise<void>;
  refreshAuthData: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const PASSWORD_RECOVERY_STORAGE_KEY = 'bunbietbay-password-recovery-user-id';

function hasPasswordRecoveryInUrl() {
  if (typeof window === 'undefined') {
    return false;
  }

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const queryParams = new URLSearchParams(window.location.search);
  return hashParams.get('type') === 'recovery' || queryParams.get('type') === 'recovery';
}

function readPasswordRecoveryUserId() {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY);
}

function storePasswordRecoveryUserId(userId: string) {
  window.localStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, userId);
}

function clearPasswordRecoveryMarker() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
  }
}

function isLocalHost() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function getAuthRedirectUrl(path: string) {
  if (typeof window === 'undefined' || window.location.origin === 'null') {
    return undefined;
  }

  return new URL(path, window.location.origin).toString();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const recoveryFromUrlRef = useRef(hasPasswordRecoveryInUrl());
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(
    () => recoveryFromUrlRef.current || Boolean(readPasswordRecoveryUserId()),
  );
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
    if (!session || isPasswordRecovery) {
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
  }, [isPasswordRecovery, session]);

  const clearAuthFeedback = useCallback(() => {
    setAuthError(null);
    setAuthNotice(null);
  }, []);

  useEffect(() => {
    if (!supabase) {
      recoveryFromUrlRef.current = false;
      clearPasswordRecoveryMarker();
      setIsPasswordRecovery(false);
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

      const nextSession = data.session ?? null;
      const storedRecoveryUserId = readPasswordRecoveryUserId();
      const shouldResumeRecovery = Boolean(nextSession) && (
        recoveryFromUrlRef.current || storedRecoveryUserId === nextSession?.user.id
      );

      if (shouldResumeRecovery && nextSession) {
        storePasswordRecoveryUserId(nextSession.user.id);
        setIsPasswordRecovery(true);
      } else {
        clearPasswordRecoveryMarker();
        setIsPasswordRecovery(false);
      }

      setSession(nextSession);
      setIsAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY' && nextSession) {
        recoveryFromUrlRef.current = true;
        storePasswordRecoveryUserId(nextSession.user.id);
        setIsPasswordRecovery(true);
      } else if (event === 'SIGNED_OUT' || !nextSession) {
        recoveryFromUrlRef.current = false;
        clearPasswordRecoveryMarker();
        setIsPasswordRecovery(false);
      } else {
        const storedRecoveryUserId = readPasswordRecoveryUserId();
        if (storedRecoveryUserId && storedRecoveryUserId !== nextSession.user.id) {
          recoveryFromUrlRef.current = false;
          clearPasswordRecoveryMarker();
          setIsPasswordRecovery(false);
        } else if (storedRecoveryUserId === nextSession.user.id) {
          setIsPasswordRecovery(true);
        }
      }

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
    if (!session || isPasswordRecovery) {
      setProfile(null);
      setPendingInvitations([]);
      return;
    }

    void refreshAuthData().catch((error) => {
      console.error('Failed to load auth data', error);
      setAuthError('Không thể tải hồ sơ tài khoản.');
    });

    if (!supabase || !session.user?.email) return;

    const client = supabase;
    let isSubscribed = true;
    const channel = client
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
      void client.removeChannel(channel);
    };
  }, [isPasswordRecovery, refreshAuthData, session]);

  const contextValue = useMemo<AuthContextType>(() => ({
    isConfigured,
    requiresAuth,
    isAuthLoading,
    isPasswordRecovery,
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
        options: {
          emailRedirectTo: getAuthRedirectUrl('/auth/callback'),
        },
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
          : 'Tài khoản đã được tạo. Hãy mở liên kết xác nhận email để kích hoạt tài khoản và quay lại ứng dụng.',
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
          emailRedirectTo: getAuthRedirectUrl('/auth/callback'),
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
      const redirectTo = getAuthRedirectUrl('/reset-password');
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo,
      });

      if (error) {
        setAuthNotice(null);
        setAuthError('Không thể gửi email đặt lại mật khẩu.');
        throw error;
      }

      setAuthError(null);
      setAuthNotice('Email đặt lại mật khẩu đã được gửi. Hãy mở liên kết để quay lại ứng dụng và đặt mật khẩu mới.');
    },
    cancelPasswordRecovery: async () => {
      if (!supabase) {
        clearPasswordRecoveryMarker();
        setIsPasswordRecovery(false);
        return;
      }

      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        setAuthError('Không thể hủy phiên khôi phục mật khẩu.');
        throw error;
      }

      recoveryFromUrlRef.current = false;
      clearPasswordRecoveryMarker();
      setIsPasswordRecovery(false);
      setSession(null);
      setProfile(null);
      setPendingInvitations([]);
      setAuthError(null);
      setAuthNotice(null);
    },
    signOut: async () => {
      if (!supabase) {
        return;
      }

      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        setAuthError('Không thể đăng xuất tài khoản.');
        throw error;
      }

      recoveryFromUrlRef.current = false;
      clearPasswordRecoveryMarker();
      setIsPasswordRecovery(false);
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
  }), [authError, authNotice, clearAuthFeedback, isAuthLoading, isCodeSent, isConfigured, isPasswordRecovery, pendingInvitations, profile, refreshAuthData, requiresAuth, session]);

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
