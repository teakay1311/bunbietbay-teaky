import { useEffect, useMemo, useState, useRef, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';

import { Icons } from '../components/Icons';
import { useSettings } from '../context/SettingsContext';
import { clearPersistedState } from '../utils/persistence';
import { formatLocalDateTime } from '../utils/date';
import { EMBEDDED_PHOTO_WARNING_BYTES, formatBytes, getPhotoStorageSummary, shouldWarnAboutEmbeddedStorage } from '../utils/photoStorage';
import { useAuth } from '../context/AuthContext';
import { useAppContext, type PersistedAppState } from '../context/AppContext';
import { useFeedback } from '../context/FeedbackContext';
import { useNotebook } from '../context/NotebookContext';
import { validateImportedSnapshot } from '../utils/appState';
import { motion, AnimatePresence } from 'framer-motion';

type SectionKey = 'account' | 'workspace' | 'appearance' | 'reminders' | 'shortcuts' | 'data';

const SECTIONS: Array<{ key: SectionKey; label: string; icon: keyof typeof Icons }> = [
  { key: 'account', label: 'Tài khoản', icon: 'Mail' },
  { key: 'workspace', label: 'Quyền truy cập', icon: 'Users' },
  { key: 'appearance', label: 'Giao diện', icon: 'LayoutDashboard' },
  { key: 'reminders', label: 'Nhắc việc', icon: 'Calendar' },
  { key: 'shortcuts', label: 'Phím tắt', icon: 'Command' },
  { key: 'data', label: 'Dữ liệu', icon: 'FileText' },
];

const SHORTCUTS = [
  ['Ctrl/Cmd + N', 'Tạo chuyến đi mới'],
  ['Ctrl/Cmd + ,', 'Mở cài đặt'],
  ['Ctrl/Cmd + K', 'Mở command palette'],
  ['/', 'Focus ô tìm kiếm trong màn hình hiện tại'],
  ['G rồi S', 'Đi đến Lịch trình'],
  ['G rồi O', 'Đi đến Tổng quan'],
  ['G rồi E', 'Đi đến Chi tiêu'],
  ['G rồi M', 'Đi đến Thành viên'],
  ['G rồi P', 'Đi đến Địa điểm'],
  ['G rồi H', 'Đi đến Hành lý'],
  ['G rồi I', 'Đi đến Ảnh'],
  ['Ctrl/Cmd + Shift + M', 'Mời thành viên bằng email'],
  ['Esc', 'Đóng modal đang mở'],
  ['?', 'Mở bảng trợ giúp phím tắt'],
];

export function Settings() {
  const location = useLocation();
  const {
    themeMode,
    setThemeMode,
    themePresetId,
    setThemePresetId,
    themePresets,
    uiDensity,
    setUiDensity,
    language,
    setLanguage,
    remindersEnabled,
    setRemindersEnabled,
    reminderLeadMinutes,
    setReminderLeadMinutes,
    notificationPermission,
    requestNotificationPermission,
    autoAcceptTripInvites,
    setAutoAcceptTripInvites,
    autoAcceptNotebookInvites,
    setAutoAcceptNotebookInvites,
  } = useSettings();
  const {
    session,
    isConfigured,
    authError,
    authNotice,
    pendingInvitations,
    signOut,
    updateMyProfile,
    updatePassword,
    acceptInvitation,
    declineInvitation,
    clearAuthFeedback,
  } = useAuth();
  const {
    trips,
    photos,
    snapshot,
    currentUserProfile,
    currentTripId,
    replacePersistedState,
    isRemoteMode,
  } = useAppContext();
  const {
    pendingNotebookInvitations,
    acceptNotebookInvitation,
    declineNotebookInvitation,
  } = useNotebook();
  const { showToast, confirm } = useFeedback();
  const [activeSection, setActiveSection] = useState<SectionKey>('account');
  const [profileForm, setProfileForm] = useState({
    displayName: '',
    avatar: '',
    phone: '',
    birthdate: '',
    bio: '',
  });
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    nextPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>((window as any).deferredPrompt || null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any).deferredPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        (window as any).deferredPrompt = null;
      }
    }
  };
  const [dataDirectory, setDataDirectory] = useState<string | null>(null);

  const isDesktopApp = Boolean(window.desktopApi?.isDesktopApp);
  const photoStorageSummary = useMemo(() => getPhotoStorageSummary(photos), [photos]);
  const shouldWarnAboutLocalPhotoStorage = useMemo(() => shouldWarnAboutEmbeddedStorage(photos), [photos]);
  const currentTrip = trips.find((trip) => trip.id === currentTripId) ?? trips[0] ?? null;

  useEffect(() => {
    const state = location.state as { section?: SectionKey } | null;
    if (state?.section) {
      setActiveSection(state.section);
    }
  }, [location.state]);

  useEffect(() => {
    setProfileForm({
      displayName: currentUserProfile?.displayName ?? '',
      avatar: currentUserProfile?.avatar ?? '',
      phone: currentUserProfile?.phone ?? '',
      birthdate: currentUserProfile?.birthdate ?? '',
      bio: currentUserProfile?.bio ?? '',
    });
  }, [currentUserProfile]);

  useEffect(() => {
    if (!window.desktopApi?.getDataDirectory) {
      return;
    }

    void window.desktopApi.getDataDirectory()
      .then((directory) => setDataDirectory(directory))
      .catch((error) => console.error('Failed to get desktop data directory', error));
  }, []);

  const exportBackup = () => {
    const exportTimestamp = new Date().toISOString();
    const backupBlob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(backupBlob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = `bunbietbay-workspace-${exportTimestamp.slice(0, 19).replace(/[:T]/g, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const rawContent = await file.text();
      const parsedSnapshot = JSON.parse(rawContent) as Partial<PersistedAppState>;
      validateImportedSnapshot(parsedSnapshot);
      replacePersistedState(parsedSnapshot);
      showToast({
        tone: 'success',
        title: 'Đã nhập backup',
        message: 'Workspace local đã được cập nhật từ file JSON.',
      });
    } catch (error) {
      console.error('Failed to import backup', error);
      showToast({
        tone: 'error',
        title: 'Không thể nhập backup',
        message: 'Hãy kiểm tra lại file JSON trước khi thử lại.',
      });
    } finally {
      event.target.value = '';
    }
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileFeedback(null);
    setProfileError(null);

    if (session) {
      try {
        setIsSavingProfile(true);
        await updateMyProfile(profileForm);
        setProfileFeedback('Hồ sơ cá nhân đã được lưu.');
      } catch (error) {
        setProfileError(error instanceof Error ? error.message : 'Không thể lưu hồ sơ cá nhân.');
      } finally {
        setIsSavingProfile(false);
      }
      return;
    }

    if (!currentUserProfile) {
      return;
    }

    replacePersistedState({
      profiles: snapshot.profiles.map((profile) => profile.id === currentUserProfile.id ? {
        ...profile,
        ...profileForm,
      } : profile),
    });
    setProfileFeedback('Hồ sơ local đã được cập nhật trên máy này.');
  };

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);
    setProfileFeedback(null);
    clearAuthFeedback();

    if (!passwordForm.nextPassword.trim() || passwordForm.nextPassword.length < 6) {
      setPasswordError('Mật khẩu mới cần có ít nhất 6 ký tự.');
      return;
    }

    if (passwordForm.nextPassword !== passwordForm.confirmPassword) {
      setPasswordError('Xác nhận mật khẩu chưa khớp.');
      return;
    }

    try {
      setIsUpdatingPassword(true);
      await updatePassword(passwordForm.nextPassword);
      setPasswordForm({
        nextPassword: '',
        confirmPassword: '',
      });
      setProfileFeedback('Mật khẩu đã được cập nhật thành công.');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Không thể đổi mật khẩu.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    setProfileError(null);

    try {
      // Very simple local bas64 encoding for avatar
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Không thể đọc file'));
        reader.readAsDataURL(file);
      });

      // Quick resize logic using canvas to keep avatar size small
      const img = new Image();
      img.src = base64Data;
      await new Promise((resolve) => { img.onload = resolve; });

      const canvas = document.createElement('canvas');
      const MAX_SIZE = 400;
      let width = img.width;
      let height = img.height;

      if (width > height && width > MAX_SIZE) {
        height *= MAX_SIZE / width;
        width = MAX_SIZE;
      } else if (height > MAX_SIZE) {
        width *= MAX_SIZE / height;
        height = MAX_SIZE;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);

      const optimizedBase64 = canvas.toDataURL('image/webp', 0.8);

      setProfileForm((current) => ({ ...current, avatar: optimizedBase64 }));
      showToast({
        tone: 'success',
        title: 'Đã tải ảnh lên',
        message: 'Ảnh đã được nén và thêm vào khung. Vui lòng bấm Lưu để hoàn tất.',
      });
    } catch (error) {
      console.error('Avatar upload failed', error);
      setProfileError('Có lỗi xảy ra khi tải ảnh lên.');
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const sectionVariants = {
    hidden: { opacity: 0, y: 15, scale: 0.98 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { ease: 'easeOut', duration: 0.2 } },
    exit: { opacity: 0, y: -10, scale: 0.98, transition: { duration: 0.2 } },
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-10">
      <div className="mb-8 flex flex-col gap-3">
        <p className="font-label text-xs font-extrabold uppercase tracking-[0.3em] text-secondary dark:text-gray-300">System Settings</p>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <h1 className="font-headline text-4xl font-black tracking-[-0.05em] text-primary dark:text-white md:text-5xl">Cài đặt hệ thống & tài khoản</h1>
            <p className="mt-3 text-lg leading-8 text-secondary dark:text-gray-300">
              Khu vực này gom toàn bộ tài khoản, hồ sơ cá nhân, quyền truy cập, giao diện, nhắc việc, dữ liệu và phím tắt vào một workspace gọn hơn thay vì kéo dọc quá dài.
            </p>
          </div>
          <div className="rounded-[1.75rem] bg-slate-950 px-5 py-4 text-white">
            <p className="font-label text-[11px] uppercase tracking-[0.24em] text-teal-200">Current mode</p>
            <p className="mt-2 font-headline text-2xl font-bold">{session ? 'Tài khoản đang kết nối' : isConfigured ? 'Có thể đăng nhập' : 'Local workspace'}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-28 xl:self-start">
          <div className="overflow-hidden rounded-[2rem] border border-outline-variant/40 bg-surface-container-lowest/90 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.06)] backdrop-blur">
            {SECTIONS.map((section) => {
              const Icon = Icons[section.icon];
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveSection(section.key)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${activeSection === section.key ? 'bg-slate-950 text-white' : 'text-on-surface hover:bg-surface-container-low'}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-headline text-sm font-bold">{section.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="space-y-8 min-w-0">
          <AnimatePresence mode="wait">
            {activeSection === 'account' && (
              <motion.section key="account" variants={sectionVariants} initial="hidden" animate="visible" exit="exit" className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-[0_18px_40px_rgba(0,0,0,0.06)] md:p-8">
                <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="font-label text-xs font-bold uppercase tracking-[0.24em] text-secondary dark:text-gray-300">Tài khoản</p>
                    <h2 className="mt-2 font-headline text-3xl font-black tracking-[-0.04em] text-on-surface">Đăng ký, đăng nhập, hồ sơ cá nhân</h2>
                  </div>
                  <div className="rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-secondary dark:text-gray-300">
                    {session ? `Đang dùng ${currentUserProfile?.email || session.user.email}` : 'Chưa kết nối tài khoản cloud'}
                  </div>
                </div>

                {(authError || profileError || passwordError) && (
                  <div className="mb-6 rounded-2xl bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
                    {passwordError || profileError || authError}
                  </div>
                )}

                {(authNotice || profileFeedback) && (
                  <div className="mb-6 rounded-2xl border border-primary/15 bg-primary/10 px-4 py-3 text-sm text-on-surface">
                    {profileFeedback || authNotice}
                  </div>
                )}

                {!session && isConfigured && (
                  <div className="mb-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-[1.75rem] bg-slate-950 p-6 text-white">
                      <p className="font-label text-xs uppercase tracking-[0.24em] text-teal-200">Account onboarding</p>
                      <h3 className="mt-3 font-headline text-3xl font-black tracking-[-0.04em]">Tạo tài khoản mật khẩu hoặc đăng nhập nhanh</h3>
                      <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">
                        Luồng onboarding chính đã được chuyển sang email + mật khẩu để bạn không phải mở email mỗi lần. OTP email vẫn còn ở màn đăng nhập như một phương án phụ.
                      </p>
                    </div>

                    <div className="space-y-4 rounded-[1.75rem] border border-outline-variant/30 bg-surface-container-low p-6">
                      <p className="text-sm leading-7 text-secondary dark:text-gray-300">
                        Khi đăng nhập, cùng một tài khoản sẽ dùng được trên nhiều máy và các lời mời theo email sẽ tự nối vào đúng workspace.
                      </p>
                      <Link
                        to="/login"
                        className="density-button block rounded-2xl bg-slate-950 text-center font-headline text-lg font-bold text-white transition hover:opacity-95"
                      >
                        Mở màn hình đăng nhập / đăng ký
                      </Link>
                    </div>
                  </div>
                )}

                <div className="grid gap-8 xl:grid-cols-[0.92fr_1.08fr]">
                  <div className="rounded-[1.75rem] bg-surface-container-low p-6 min-w-0">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="group relative h-20 w-20 shrink-0 cursor-pointer rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-wait"
                        title="Bấm để đổi ảnh đại diện"
                      >
                        <img
                          src={profileForm.avatar || 'https://api.dicebear.com/9.x/glass/svg?seed=traveler'}
                          alt={profileForm.displayName || 'Avatar'}
                          className="h-20 w-20 rounded-full border-4 border-surface-container-lowest object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <Icons.Image className="h-6 w-6 text-white" />
                        </div>
                        {isUploadingAvatar && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          </div>
                        )}
                      </button>
                      <div>
                        <p className="font-headline text-2xl font-black tracking-[-0.03em] text-on-surface truncate">{profileForm.displayName || 'Chưa có tên hiển thị'}</p>
                        <p className="mt-1 text-sm text-secondary dark:text-gray-300 truncate">{currentUserProfile?.email || 'Chế độ local trên máy này'}</p>
                      </div>
                    </div>
                    <div className="mt-6 grid gap-3">
                      <div className="rounded-2xl bg-surface-container-lowest px-4 py-3 text-sm text-secondary dark:text-gray-300">
                        {session ? 'Tài khoản này sẽ được dùng để truy cập cùng một workspace trên nhiều máy.' : 'Hiện bạn đang ở local mode. Khi đăng nhập, hồ sơ và quyền sẽ gắn với email.'}
                      </div>
                      {session && (
                        <button
                          type="button"
                          onClick={() => { void signOut(); }}
                          className="rounded-2xl border border-error px-4 py-3 font-semibold text-error transition hover:bg-error-container"
                        >
                          Đăng xuất tài khoản
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6 min-w-0">
                    <form onSubmit={saveProfile} className="grid gap-4 rounded-[1.75rem] bg-surface-container-low p-6 md:grid-cols-2">
                      <div className="md:col-span-2 min-w-0">
                        <label className="mb-2 block font-label text-xs font-bold uppercase tracking-[0.22em] text-secondary dark:text-gray-300">Tên hiển thị</label>
                        <input
                          value={profileForm.displayName}
                          onChange={(event) => setProfileForm((current) => ({ ...current, displayName: event.target.value }))}
                          className="density-control w-full min-w-0 max-w-full rounded-2xl border border-outline-variant/60 bg-surface-container-lowest outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="md:col-span-2 min-w-0">
                        <label className="mb-2 block font-label text-xs font-bold uppercase tracking-[0.22em] text-secondary dark:text-gray-300">Ảnh đại diện</label>
                        <div className="flex gap-2">
                          <input
                            value={profileForm.avatar}
                            onChange={(event) => setProfileForm((current) => ({ ...current, avatar: event.target.value }))}
                            placeholder="https://..."
                            className="density-control flex-1 min-w-0 max-w-full rounded-2xl border border-outline-variant/60 bg-surface-container-lowest px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface"
                          />
                          <button
                            type="button"
                            onClick={() => avatarInputRef.current?.click()}
                            disabled={isUploadingAvatar}
                            className="density-button flex shrink-0 items-center gap-2 rounded-2xl bg-surface-container-high px-4 py-3 font-semibold text-on-surface transition hover:bg-surface-container-highest disabled:opacity-50"
                          >
                            <Icons.Upload className="h-5 w-5" />
                            <span className="hidden sm:inline">{isUploadingAvatar ? 'Đang tải...' : 'Tải lên'}</span>
                          </button>
                          <input
                            type="file"
                            accept="image/*"
                            ref={avatarInputRef}
                            onChange={(e) => { void handleAvatarUpload(e); }}
                            className="hidden"
                          />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <label className="mb-2 block font-label text-xs font-bold uppercase tracking-[0.22em] text-secondary dark:text-gray-300">Số điện thoại</label>
                        <input
                          value={profileForm.phone}
                          onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))}
                          className="density-control w-full min-w-0 max-w-full rounded-2xl border border-outline-variant/60 bg-surface-container-lowest outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="mb-2 block font-label text-xs font-bold uppercase tracking-[0.22em] text-secondary dark:text-gray-300">Ngày sinh</label>
                        <input
                          type="date"
                          value={profileForm.birthdate}
                          onChange={(event) => setProfileForm((current) => ({ ...current, birthdate: event.target.value }))}
                          className="density-control w-full min-w-0 max-w-full rounded-2xl border border-outline-variant/60 bg-surface-container-lowest outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="md:col-span-2 min-w-0">
                        <label className="mb-2 block font-label text-xs font-bold uppercase tracking-[0.22em] text-secondary dark:text-gray-300">Giới thiệu ngắn</label>
                        <textarea
                          rows={4}
                          value={profileForm.bio}
                          onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))}
                          className="density-control w-full min-w-0 max-w-full rounded-2xl border border-outline-variant/60 bg-surface-container-lowest outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <button type="submit" disabled={isSavingProfile} className="density-button rounded-2xl bg-slate-950 font-headline text-lg font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60">
                          {isSavingProfile ? 'Đang lưu hồ sơ...' : 'Lưu hồ sơ của tôi'}
                        </button>
                      </div>
                    </form>

                    {session && (
                      <form onSubmit={savePassword} className="grid gap-4 rounded-[1.75rem] bg-surface-container-low p-6 md:grid-cols-2">
                        <div className="md:col-span-2">
                          <p className="font-headline text-2xl font-black tracking-[-0.03em] text-on-surface">Đổi mật khẩu</p>
                          <p className="mt-2 text-sm leading-7 text-secondary dark:text-gray-300">
                            Dùng mật khẩu mới cho các lần đăng nhập sau, thay cho việc phải lấy OTP liên tục trong email.
                          </p>
                        </div>
                        <div className="min-w-0">
                          <label className="mb-2 block font-label text-xs font-bold uppercase tracking-[0.22em] text-secondary dark:text-gray-300">Mật khẩu mới</label>
                          <input
                            type="password"
                            value={passwordForm.nextPassword}
                            onChange={(event) => setPasswordForm((current) => ({ ...current, nextPassword: event.target.value }))}
                            className="density-control w-full min-w-0 max-w-full rounded-2xl border border-outline-variant/60 bg-surface-container-lowest outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                        <div className="min-w-0">
                          <label className="mb-2 block font-label text-xs font-bold uppercase tracking-[0.22em] text-secondary dark:text-gray-300">Xác nhận mật khẩu</label>
                          <input
                            type="password"
                            value={passwordForm.confirmPassword}
                            onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                            className="density-control w-full min-w-0 max-w-full rounded-2xl border border-outline-variant/60 bg-surface-container-lowest outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <button type="submit" disabled={isUpdatingPassword} className="density-button rounded-2xl border border-outline-variant/60 bg-surface-container-lowest font-semibold text-on-surface transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-60">
                            {isUpdatingPassword ? 'Đang cập nhật mật khẩu...' : 'Cập nhật mật khẩu'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </motion.section>
            )}

            {activeSection === 'workspace' && (
              <motion.section key="workspace" variants={sectionVariants} initial="hidden" animate="visible" exit="exit" className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-[0_18px_40px_rgba(0,0,0,0.06)] md:p-8">
                <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="font-label text-xs font-bold uppercase tracking-[0.24em] text-secondary dark:text-gray-300">Quyền truy cập</p>
                    <h2 className="mt-2 font-headline text-3xl font-black tracking-[-0.04em] text-on-surface">Thành viên, lời mời, phân quyền theo email</h2>
                  </div>
                  {currentTrip && (
                    <Link to={`/trips/${currentTrip.id}/members`} className="rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:opacity-95">
                      Mở quản lý thành viên của chuyến đi hiện tại
                    </Link>
                  )}
                </div>

                <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                  <div className="rounded-[1.75rem] bg-surface-container-low p-6">
                    <p className="font-headline text-2xl font-black tracking-[-0.03em] text-on-surface">Workspace của bạn</p>
                    <div className="mt-5 grid gap-3">
                      {trips.map((trip) => (
                        <div key={trip.id} className="rounded-2xl bg-surface-container-lowest px-4 py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-headline text-lg font-bold text-on-surface">{trip.title}</p>
                              <p className="text-sm text-secondary dark:text-gray-300">{trip.location}</p>
                            </div>
                            <span className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white">
                              {trip.membershipRole || 'guest'}
                            </span>
                          </div>
                          <p className="mt-3 text-sm text-secondary dark:text-gray-300">
                            {trip.members.length} thành viên, {trip.invitationCount} lời mời đang chờ.
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] bg-surface-container-low p-6">
                    <p className="font-headline text-2xl font-black tracking-[-0.03em] text-on-surface">Lời mời dành cho email này</p>
                    <div className="mt-5 space-y-3">
                      {pendingInvitations.length === 0 && (
                        <div className="rounded-2xl bg-surface-container-lowest px-4 py-4 text-sm text-secondary dark:text-gray-300">
                          Hiện chưa có lời mời chuyến đi nào chờ xử lý.
                        </div>
                      )}
                      {pendingInvitations.map((invitation) => (
                        <div key={invitation.id} className="rounded-2xl bg-surface-container-lowest px-4 py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-headline text-lg font-bold text-on-surface">{invitation.tripTitle}</p>
                              <p className="text-sm text-secondary dark:text-gray-300">
                                Vai trò đề xuất: <span className="font-semibold text-on-surface">{invitation.role}</span>
                              </p>
                              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-secondary dark:text-gray-300">
                                Nhận lúc {formatLocalDateTime(invitation.createdAt)}
                              </p>
                            </div>
                            {invitation.status === 'pending' && (
                              <div className="flex gap-2">
                                <button onClick={async () => {
                                  try {
                                    await acceptInvitation(invitation.id);
                                  } catch (error) {
                                    showToast({
                                      tone: 'error',
                                      title: 'Không thể nhận quyền',
                                      message: error instanceof Error ? error.message : 'Lời mời chưa được xác nhận.',
                                    });
                                  }
                                }} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white">
                                  Nhận quyền
                                </button>
                                <button onClick={async () => {
                                  try {
                                    await declineInvitation(invitation.id);
                                  } catch (error) {
                                    showToast({
                                      tone: 'error',
                                      title: 'Không thể từ chối lời mời',
                                      message: error instanceof Error ? error.message : 'Lời mời vẫn chưa được cập nhật.',
                                    });
                                  }
                                }} className="rounded-xl border border-outline-variant px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-secondary dark:text-gray-300">
                                  Từ chối
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 border-t border-outline-variant/40 pt-5">
                      <p className="font-headline text-xl font-black tracking-[-0.03em] text-on-surface">Lời mời sổ tay</p>
                      <div className="mt-4 space-y-3">
                        {pendingNotebookInvitations.length === 0 && (
                          <div className="rounded-2xl bg-surface-container-lowest px-4 py-4 text-sm text-secondary dark:text-gray-300">
                            Hiện chưa có lời mời sổ tay nào chờ xử lý.
                          </div>
                        )}
                        {pendingNotebookInvitations.map((invitation) => (
                          <div key={invitation.id} className="rounded-2xl bg-surface-container-lowest px-4 py-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="font-headline text-lg font-bold text-on-surface">{invitation.notebookName}</p>
                                <p className="text-sm text-secondary dark:text-gray-300">
                                  Vai trò đề xuất: <span className="font-semibold text-on-surface">{invitation.role}</span>
                                </p>
                                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-secondary dark:text-gray-300">
                                  Nhận lúc {formatLocalDateTime(invitation.createdAt)}
                                </p>
                              </div>
                              {invitation.status === 'pending' && (
                                <div className="flex gap-2">
                                  <button onClick={async () => {
                                    try {
                                      await acceptNotebookInvitation(invitation.id);
                                      showToast({ tone: 'success', title: 'Đã nhận quyền sổ tay' });
                                    } catch (error) {
                                      showToast({
                                        tone: 'error',
                                        title: 'Không thể nhận quyền sổ tay',
                                        message: error instanceof Error ? error.message : 'Lời mời chưa được xác nhận.',
                                      });
                                    }
                                  }} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white">
                                    Nhận quyền
                                  </button>
                                  <button onClick={async () => {
                                    try {
                                      await declineNotebookInvitation(invitation.id);
                                    } catch (error) {
                                      showToast({
                                        tone: 'error',
                                        title: 'Không thể từ chối lời mời sổ tay',
                                        message: error instanceof Error ? error.message : 'Lời mời vẫn chưa được cập nhật.',
                                      });
                                    }
                                  }} className="rounded-xl border border-outline-variant px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-secondary dark:text-gray-300">
                                    Từ chối
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-[1.75rem] bg-surface-container-low p-6">
                  <p className="font-headline text-2xl font-black tracking-[-0.03em] text-on-surface">Tự động chấp thuận lời mời</p>
                  <p className="mt-2 text-sm text-secondary dark:text-gray-300 leading-relaxed">
                    Khi bật, mọi lời mời sẽ được tự động chấp thuận khi hệ thống phát hiện. Tắt nếu bạn muốn xem xét thủ công từng lời mời.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setAutoAcceptTripInvites(!autoAcceptTripInvites)}
                      className={`rounded-2xl border px-4 py-4 text-left font-bold transition ${autoAcceptTripInvites ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant/60 bg-surface-container-lowest text-secondary dark:text-gray-300'}`}
                    >
                      {autoAcceptTripInvites ? '✓ Tự động nhận lời mời chuyến đi' : 'Tắt — Duyệt thủ công chuyến đi'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutoAcceptNotebookInvites(!autoAcceptNotebookInvites)}
                      className={`rounded-2xl border px-4 py-4 text-left font-bold transition ${autoAcceptNotebookInvites ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant/60 bg-surface-container-lowest text-secondary dark:text-gray-300'}`}
                    >
                      {autoAcceptNotebookInvites ? '✓ Tự động nhận lời mời sổ tay' : 'Tắt — Duyệt thủ công sổ tay'}
                    </button>
                  </div>
                </div>
              </motion.section>
            )}

            {activeSection === 'appearance' && (
              <motion.section key="appearance" variants={sectionVariants} initial="hidden" animate="visible" exit="exit" className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-[0_18px_40px_rgba(0,0,0,0.06)] md:p-8">
                <p className="font-label text-xs font-bold uppercase tracking-[0.24em] text-secondary dark:text-gray-300">Giao diện</p>
                <h2 className="mt-2 mb-8 font-headline text-3xl font-black tracking-[-0.04em] text-on-surface">Bố cục dày thông tin hơn, ít khoảng trống lãng phí hơn</h2>

                {deferredPrompt && (
                  <div className="mb-8 rounded-[1.75rem] bg-tertiary/10 p-6 border border-tertiary/20 flex flex-col md:flex-row gap-6 items-center justify-between shadow-sm">
                    <div>
                      <h3 className="font-headline font-black text-xl tracking-tight text-tertiary mb-2">Cài đặt Ứng dụng (App)</h3>
                      <p className="text-on-surface-variant text-sm font-medium leading-relaxed">Thêm Bunbietbay Trips vào màn hình chính của điện thoại hoặc máy tính để trải nghiệm trơn tru.</p>
                    </div>
                    <button onClick={handleInstallClick} className="density-button rounded-2xl bg-tertiary text-on-tertiary font-bold tracking-wide whitespace-nowrap shadow-md hover:shadow-lg transition-all active:scale-95">
                      Cài đặt ngay
                    </button>
                  </div>
                )}

                <div className="grid gap-8 xl:grid-cols-2">
                  <div>
                    <label className="mb-3 block font-label text-xs font-bold uppercase tracking-[0.22em] text-secondary dark:text-gray-300">Chế độ hiển thị</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['light', 'dark', 'system'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setThemeMode(mode)}
                          className={`rounded-2xl border px-4 py-4 font-bold transition ${themeMode === mode ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant/60 bg-surface-container-low text-secondary dark:text-gray-300'}`}
                        >
                          {mode === 'system' ? 'Hệ thống' : mode === 'light' ? 'Sáng' : 'Tối'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-3 block font-label text-xs font-bold uppercase tracking-[0.22em] text-secondary dark:text-gray-300">Mật độ hiển thị</label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['cozy', 'compact'] as const).map((density) => (
                        <button
                          key={density}
                          type="button"
                          onClick={() => setUiDensity(density)}
                          className={`rounded-2xl border px-4 py-4 font-bold transition ${uiDensity === density ? 'border-primary bg-slate-950 text-white' : 'border-outline-variant/60 bg-surface-container-low text-secondary dark:text-gray-300'}`}
                        >
                          {density === 'cozy' ? 'Rộng rãi' : 'Gọn hơn'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <label className="mb-3 block font-label text-xs font-bold uppercase tracking-[0.22em] text-secondary dark:text-gray-300">Bộ màu chủ đạo</label>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {themePresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setThemePresetId(preset.id)}
                        className={`rounded-[1.5rem] border p-4 text-left transition ${themePresetId === preset.id ? 'border-primary bg-primary/5' : 'border-outline-variant/60 bg-surface-container-low'}`}
                      >
                        <div className="mb-3 flex gap-2">
                          <span className="h-8 flex-1 rounded-xl" style={{ backgroundColor: preset.primary }} />
                          <span className="h-8 flex-1 rounded-xl" style={{ backgroundColor: preset.primaryContainer }} />
                          <span className="h-8 flex-1 rounded-xl" style={{ backgroundColor: preset.secondaryContainer }} />
                        </div>
                        <p className="font-headline text-lg font-bold text-on-surface">{preset.name}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-8 grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setLanguage('vi')}
                    className={`rounded-2xl border px-4 py-4 font-bold transition ${language === 'vi' ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant/60 bg-surface-container-low text-secondary dark:text-gray-300'}`}
                  >
                    Tiếng Việt
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`rounded-2xl border px-4 py-4 font-bold transition ${language === 'en' ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant/60 bg-surface-container-low text-secondary dark:text-gray-300'}`}
                  >
                    English
                  </button>
                </div>
              </motion.section>
            )}

            {activeSection === 'reminders' && (
              <motion.section key="reminders" variants={sectionVariants} initial="hidden" animate="visible" exit="exit" className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-[0_18px_40px_rgba(0,0,0,0.06)] md:p-8">
                <p className="font-label text-xs font-bold uppercase tracking-[0.24em] text-secondary dark:text-gray-300">Nhắc việc</p>
                <h2 className="mt-2 font-headline text-3xl font-black tracking-[-0.04em] text-on-surface">Bật nhắc việc chuyến đi và xin quyền thông báo</h2>

                <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="rounded-[1.75rem] bg-slate-950 p-6 text-white">
                    <p className="font-label text-xs uppercase tracking-[0.24em] text-teal-200">Notification status</p>
                    <p className="mt-3 font-headline text-3xl font-black tracking-[-0.04em]">
                      {notificationPermission === 'granted'
                        ? 'Đã được cấp quyền'
                        : notificationPermission === 'denied'
                          ? 'Đang bị chặn'
                          : notificationPermission === 'unsupported'
                            ? 'Thiết bị không hỗ trợ'
                            : 'Chưa xin quyền'}
                    </p>
                    <p className="mt-4 text-sm leading-7 text-slate-300">
                      Trên web, thông báo phụ thuộc vào quyền của trình duyệt và tab đang hoạt động. Trên desktop, trải nghiệm ổn định hơn khi app đang mở.
                    </p>
                  </div>

                  <div className="grid gap-4">
                    <button
                      type="button"
                      onClick={() => setRemindersEnabled(!remindersEnabled)}
                      className={`rounded-2xl border px-4 py-4 text-left font-bold transition ${remindersEnabled ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant/60 bg-surface-container-low text-secondary dark:text-gray-300'}`}
                    >
                      {remindersEnabled ? 'Đang bật nhắc việc chuyến đi' : 'Đang tắt nhắc việc chuyến đi'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { void requestNotificationPermission(); }}
                      className="rounded-2xl border border-outline-variant/60 bg-surface-container-low px-4 py-4 text-left font-bold text-on-surface transition hover:border-primary"
                    >
                      Xin quyền gửi thông báo ngay bây giờ
                    </button>
                    <div>
                      <label className="mb-2 block font-label text-xs font-bold uppercase tracking-[0.22em] text-secondary dark:text-gray-300">Nhắc trước bao lâu</label>
                      <select
                        value={reminderLeadMinutes}
                        onChange={(event) => setReminderLeadMinutes(Number(event.target.value))}
                        className="w-full rounded-2xl border border-outline-variant/60 bg-surface-container-low px-4 py-4 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      >
                        <option value={30}>30 phút</option>
                        <option value={60}>1 giờ</option>
                        <option value={120}>2 giờ</option>
                        <option value={360}>6 giờ</option>
                        <option value={1440}>1 ngày</option>
                      </select>
                    </div>
                  </div>
                </div>
              </motion.section>
            )}

            {activeSection === 'shortcuts' && (
              <motion.section key="shortcuts" variants={sectionVariants} initial="hidden" animate="visible" exit="exit" className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-[0_18px_40px_rgba(0,0,0,0.06)] md:p-8">
                <p className="font-label text-xs font-bold uppercase tracking-[0.24em] text-secondary dark:text-gray-300">Shortcuts</p>
                <h2 className="mt-2 font-headline text-3xl font-black tracking-[-0.04em] text-on-surface">Bổ sung thêm nhiều phím tắt thao tác nhanh</h2>
                <div className="mt-8 grid gap-3 lg:grid-cols-2">
                  {SHORTCUTS.map(([combo, label]) => (
                    <div key={combo} className="flex items-center justify-between rounded-2xl bg-surface-container-low px-4 py-4">
                      <span className="text-sm font-medium text-on-surface">{label}</span>
                      <kbd className="rounded-xl bg-slate-950 px-3 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white">{combo}</kbd>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {activeSection === 'data' && (
              <motion.section key="data" variants={sectionVariants} initial="hidden" animate="visible" exit="exit" className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-[0_18px_40px_rgba(0,0,0,0.06)] md:p-8">
                <p className="font-label text-xs font-bold uppercase tracking-[0.24em] text-secondary dark:text-gray-300">Dữ liệu</p>
                <h2 className="mt-2 font-headline text-3xl font-black tracking-[-0.04em] text-on-surface">Backup, ảnh, dữ liệu cục bộ</h2>

                <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="rounded-[1.75rem] bg-surface-container-low p-6">
                    <p className="font-headline text-2xl font-black tracking-[-0.03em] text-on-surface">Ảnh và lưu trữ</p>
                    <p className="mt-4 text-sm text-secondary dark:text-gray-300">
                      {photoStorageSummary.totalCount} ảnh, gồm {photoStorageSummary.remoteCount} ảnh cloud và {photoStorageSummary.embeddedCount} ảnh local.
                    </p>
                    <p className="mt-2 text-sm text-secondary dark:text-gray-300">Dung lượng ảnh local ước tính: {formatBytes(photoStorageSummary.estimatedEmbeddedBytes)}.</p>
                    {shouldWarnAboutLocalPhotoStorage && (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-100 px-4 py-3 text-sm text-amber-900">
                        Ảnh local đã vượt khoảng {formatBytes(EMBEDDED_PHOTO_WARNING_BYTES)}. Nên dùng Cloudinary cho ảnh mới nếu bạn làm việc trên nhiều máy.
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4">
                    <button type="button" onClick={exportBackup} className="rounded-2xl bg-slate-950 px-4 py-4 font-headline text-lg font-bold text-white transition hover:opacity-95">
                      Xuất backup JSON hiện tại
                    </button>
                    <label className={`flex cursor-pointer items-center justify-center rounded-2xl border px-4 py-4 font-semibold ${isRemoteMode ? 'cursor-not-allowed border-outline-variant/60 bg-surface-container-low text-secondary dark:text-gray-300 opacity-60' : 'border-outline-variant/60 bg-surface-container-low text-on-surface'}`}>
                      Nhập backup vào local workspace
                      <input type="file" accept="application/json" className="hidden" disabled={isRemoteMode} onChange={(event) => { void importBackup(event); }} />
                    </label>
                    {isDesktopApp && (
                      <>
                        <button
                          type="button"
                          onClick={() => { void window.desktopApi?.openDataDirectory(); }}
                          className="rounded-2xl border border-outline-variant/60 bg-surface-container-low px-4 py-4 font-semibold text-on-surface transition hover:border-primary"
                        >
                          Mở thư mục dữ liệu ứng dụng
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const shouldClear = await confirm({
                              title: 'Xóa toàn bộ dữ liệu cục bộ',
                              message: 'Thao tác này sẽ xóa workspace local trên máy này và tải lại ứng dụng. Dữ liệu cloud không bị ảnh hưởng.',
                              confirmLabel: 'Xóa dữ liệu',
                              cancelLabel: 'Giữ lại',
                              tone: 'danger',
                            });
                            if (!shouldClear) {
                              return;
                            }

                            void clearPersistedState().then(() => window.location.reload());
                          }}
                          className="rounded-2xl border border-error px-4 py-4 font-semibold text-error transition hover:bg-error-container"
                        >
                          Xóa toàn bộ dữ liệu cục bộ
                        </button>
                      </>
                    )}
                    {dataDirectory && (
                      <div className="rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-secondary dark:text-gray-300 break-all">
                        {dataDirectory}
                      </div>
                    )}
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
