import { useEffect, useMemo, useState, useRef, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Icons } from '../components/Icons';
import { useSettings } from '../context/SettingsContext';
import { clearPersistedState } from '../utils/persistence';
import { EMBEDDED_PHOTO_WARNING_BYTES, formatBytes, getPhotoStorageSummary, shouldWarnAboutEmbeddedStorage } from '../utils/photoStorage';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { useFeedback } from '../context/FeedbackContext';
import { useNotebook } from '../context/NotebookContext';
import { createWorkspaceBackupV8, prepareWorkspaceBackup } from '../utils/workspaceBackup';
import { motion, AnimatePresence } from 'motion/react';
import { usePwaInstallPrompt } from '../features/settings/usePwaInstallPrompt';
import { resizeImageFileToDataUrl } from '../utils/avatarImage';

type SectionKey = 'account' | 'appearance' | 'reminders' | 'shortcuts' | 'data';

const SECTION_ROUTES: Record<SectionKey, string> = {
  account: 'profile',
  appearance: 'preferences',
  reminders: 'notifications',
  data: 'data',
  shortcuts: 'shortcuts',
};

const ROUTE_SECTIONS: Record<string, SectionKey> = Object.fromEntries(
  Object.entries(SECTION_ROUTES).map(([section, route]) => [route, section]),
) as Record<string, SectionKey>;

const SECTIONS: Array<{ key: SectionKey; label: string; icon: keyof typeof Icons }> = [
  { key: 'account', label: 'Tài khoản', icon: 'Mail' },
  { key: 'appearance', label: 'Tùy chỉnh', icon: 'LayoutDashboard' },
  { key: 'reminders', label: 'Thông báo', icon: 'Calendar' },
  { key: 'shortcuts', label: 'Phím tắt', icon: 'Command' },
  { key: 'data', label: 'Dữ liệu', icon: 'FileText' },
];

const SHORTCUTS = [
  ['Ctrl/Cmd + N', 'Tạo chuyến đi mới'],
  ['Ctrl/Cmd + ,', 'Mở Tài khoản'],
  ['Ctrl/Cmd + K', 'Mở command palette'],
  ['/', 'Focus ô tìm kiếm trong màn hình hiện tại'],
  ['G rồi S', 'Đi đến Lịch trình'],
  ['G rồi O', 'Đi đến Trang chủ chuyến đi'],
  ['G rồi E', 'Đi đến Chi tiêu'],
  ['G rồi M', 'Đi đến Thành viên'],
  ['G rồi P', 'Đi đến Địa điểm'],
  ['G rồi H', 'Đi đến Chuẩn bị'],
  ['G rồi I', 'Đi đến Kỷ niệm'],
  ['Ctrl/Cmd + Shift + M', 'Mời thành viên bằng email'],
  ['Esc', 'Đóng modal đang mở'],
  ['?', 'Mở bảng trợ giúp phím tắt'],
];

export function Settings() {
  const navigate = useNavigate();
  const { section } = useParams();
  const {
    themeMode,
    setThemeMode,
    themePresetId,
    setThemePresetId,
    themePresets,
    uiDensity,
    setUiDensity,
    remindersEnabled,
    setRemindersEnabled,
    reminderLeadMinutes,
    setReminderLeadMinutes,
    tripStartLeadMinutes,
    setTripStartLeadMinutes,
    setIsPrivacyMode,
    notificationPermission,
    requestNotificationPermission,
    isPreferencesSyncing,
    preferencesSyncError,
    preferences,
    tripNotificationPreferences,
    replaceLocalTripNotificationPreferences,
  } = useSettings();
  const {
    session,
    isConfigured,
    authError,
    authNotice,
    signOut,
    updateMyProfile,
    updatePassword,
    clearAuthFeedback,
  } = useAuth();
  const {
    photos,
    snapshot,
    currentUserProfile,
    replacePersistedState,
    isRemoteMode,
  } = useAppContext();
  const { notebooks, notebookPlaces, replaceLocalNotebookState } = useNotebook();
  const { showToast, confirm } = useFeedback();
  const activeSection = ROUTE_SECTIONS[section ?? 'profile'] ?? 'account';
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
  const { canInstall, install } = usePwaInstallPrompt();
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleInstallClick = () => { void install(); };
  const [dataDirectory, setDataDirectory] = useState<string | null>(null);

  const isDesktopApp = Boolean(window.desktopApi?.isDesktopApp);
  const photoStorageSummary = useMemo(() => getPhotoStorageSummary(photos), [photos]);
  const shouldWarnAboutLocalPhotoStorage = useMemo(() => shouldWarnAboutEmbeddedStorage(photos), [photos]);
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
    const backup = createWorkspaceBackupV8({
      workspace: snapshot,
      library: {
        notebooks: notebooks.map(({ id, name, type, createdBy, createdAt, updatedAt }) => ({ id, name, type, createdBy, createdAt, updatedAt })),
        places: notebookPlaces,
      },
      preferences,
      tripNotificationPreferences: Object.values(tripNotificationPreferences),
    });
    const backupBlob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
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
      const prepared = prepareWorkspaceBackup(JSON.parse(rawContent));
      replacePersistedState(prepared.workspace);
      if (prepared.library) replaceLocalNotebookState(prepared.library.notebooks, prepared.library.places);
      if (prepared.preferences) {
        setThemeMode(prepared.preferences.themeMode);
        setThemePresetId(prepared.preferences.themePresetId);
        setUiDensity(prepared.preferences.uiDensity);
        setIsPrivacyMode(prepared.preferences.isPrivacyMode);
        setRemindersEnabled(prepared.preferences.remindersEnabled);
        setReminderLeadMinutes(prepared.preferences.activityLeadMinutes);
        setTripStartLeadMinutes(prepared.preferences.tripStartLeadMinutes);
      }
      replaceLocalTripNotificationPreferences(prepared.tripNotificationPreferences);
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
        message: error instanceof Error ? error.message : 'Hãy kiểm tra lại file JSON trước khi thử lại.',
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
      ...snapshot,
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
      const optimizedBase64 = await resizeImageFileToDataUrl(file);
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
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { ease: 'easeOut', duration: 0.18 } },
    exit: { opacity: 0, transition: { duration: 0.15 } },
  } as const;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-10">
      <div className="mb-5 flex flex-col gap-2">
        <p className="font-label text-[11px] font-extrabold uppercase tracking-[0.18em] text-secondary dark:text-gray-300 md:text-xs md:tracking-[0.3em]">Thiết lập hệ thống</p>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <h1 className="text-balance font-headline text-2xl font-black text-primary dark:text-white md:text-5xl">Tài khoản và tùy chỉnh</h1>
            <p className="mt-2 hidden text-sm leading-6 text-secondary dark:text-gray-300 md:block">
              Quản lý hồ sơ cá nhân, giao diện, nhắc việc, dữ liệu và phím tắt theo từng nhóm rõ ràng.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white md:rounded-[1.75rem] md:px-5 md:py-4">
            <p className="font-label text-[10px] uppercase tracking-[0.18em] text-teal-200 md:text-[11px] md:tracking-[0.24em]">Chế độ hiện tại</p>
            <p className="mt-1 font-headline text-lg font-bold md:mt-2 md:text-2xl">{session ? 'Tài khoản đang kết nối' : isConfigured ? 'Có thể đăng nhập' : 'Dữ liệu trên thiết bị'}</p>
          </div>
        </div>
      </div>

      {(isPreferencesSyncing || preferencesSyncError) && (
        <div role={preferencesSyncError ? 'alert' : 'status'} className={`mb-6 rounded-xl border px-4 py-3 text-sm ${preferencesSyncError ? 'border-error/40 bg-error-container text-on-error-container' : 'border-outline-variant bg-surface-container-low text-secondary'}`}>
          {preferencesSyncError ? `Không thể đồng bộ tùy chỉnh: ${preferencesSyncError}` : 'Đang đồng bộ tùy chỉnh tài khoản…'}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="min-w-0 md:sticky md:top-8 md:self-start">
          <label className="block md:hidden">
            <span className="sr-only">Chọn khu vực tài khoản</span>
            <select value={activeSection} onChange={(event) => navigate(`/account/${SECTION_ROUTES[event.target.value as SectionKey]}`)} className="min-h-11 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 font-semibold">
              {SECTIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          <div className="hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-2 md:block">
            {SECTIONS.map((section) => {
              const Icon = Icons[section.icon];
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => navigate(`/account/${SECTION_ROUTES[section.key]}`)}
                  aria-current={activeSection === section.key ? 'page' : undefined}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-colors ${activeSection === section.key ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-container-low'}`}
                >
                  <Icon className="size-5" />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          <AnimatePresence mode="wait">
            {activeSection === 'account' && (
              <motion.section key="account" variants={sectionVariants} initial="hidden" animate="visible" exit="exit" className="rounded-2xl bg-surface-container-lowest p-4 shadow-[0_12px_28px_rgba(0,0,0,0.05)] md:rounded-[2rem] md:p-8 md:shadow-[0_18px_40px_rgba(0,0,0,0.06)]">
                <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="font-label text-[11px] font-bold uppercase tracking-[0.16em] text-secondary dark:text-gray-300 md:text-xs md:tracking-[0.24em]">Tài khoản</p>
                    <h2 className="mt-2 font-headline text-2xl font-black text-on-surface md:text-3xl md:tracking-[-0.04em]">Đăng ký, đăng nhập, hồ sơ cá nhân</h2>
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
                  <div className="mb-6 grid gap-4 md:mb-8 md:gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-2xl bg-slate-950 p-4 text-white md:rounded-[1.75rem] md:p-6">
                      <p className="font-label text-[10px] uppercase tracking-[0.18em] text-teal-200 md:text-xs md:tracking-[0.24em]">Bắt đầu với tài khoản</p>
                      <h3 className="mt-2 font-headline text-xl font-black md:mt-3 md:text-3xl md:tracking-[-0.04em]">Tạo tài khoản mật khẩu hoặc đăng nhập nhanh</h3>
                      <p className="mt-3 max-w-md text-sm leading-6 text-slate-300 md:mt-4 md:leading-7">
                        Đăng nhập chính dùng email và mật khẩu để không phải mở email mỗi lần. Mã OTP qua email vẫn là phương án dự phòng.
                      </p>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 md:space-y-4 md:rounded-[1.75rem] md:p-6">
                      <p className="text-sm leading-6 text-secondary dark:text-gray-300 md:leading-7">
                        Khi đăng nhập, cùng một tài khoản dùng được trên nhiều máy và lời mời theo email sẽ xuất hiện trong Hộp thư.
                      </p>
                      <Link
                        to="/login"
                        className="density-button block rounded-2xl bg-slate-950 text-center font-headline text-base font-bold text-white transition hover:opacity-95 md:text-lg"
                      >
                        Mở màn hình đăng nhập / đăng ký
                      </Link>
                    </div>
                  </div>
                )}

                <div className="grid gap-8 xl:grid-cols-[0.92fr_1.08fr]">
                    <div className="min-w-0 rounded-2xl bg-surface-container-low p-4 md:rounded-[1.75rem] md:p-6">
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
                        <p className="truncate font-headline text-xl font-black text-on-surface md:text-2xl md:tracking-[-0.03em]">{profileForm.displayName || 'Chưa có tên hiển thị'}</p>
                        <p className="mt-1 text-sm text-secondary dark:text-gray-300 truncate">{currentUserProfile?.email || 'Chế độ local trên máy này'}</p>
                      </div>
                    </div>
                    <div className="mt-6 grid gap-3">
                      <div className="rounded-2xl bg-surface-container-lowest px-4 py-3 text-sm text-secondary dark:text-gray-300">
                        {session ? 'Tài khoản này được dùng để truy cập cùng một không gian trên nhiều máy.' : 'Hiện dữ liệu chỉ ở trên thiết bị. Khi đăng nhập, hồ sơ và quyền sẽ gắn với email.'}
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
                      {!session && isConfigured && (
                        <Link
                          to="/login"
                          className="rounded-2xl bg-slate-950 px-4 py-3 text-center font-semibold text-white transition hover:opacity-95"
                        >
                          Đăng nhập tài khoản cloud
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6 min-w-0">
                    <form onSubmit={saveProfile} className="grid gap-4 rounded-2xl bg-surface-container-low p-4 md:grid-cols-2 md:rounded-[1.75rem] md:p-6">
                      <div className="md:col-span-2 min-w-0">
                        <label className="mb-2 block font-label text-xs font-bold uppercase tracking-[0.22em] text-secondary dark:text-gray-300">Tên hiển thị</label>
                        <input
                          aria-label="Tên hiển thị"
                          value={profileForm.displayName}
                          onChange={(event) => setProfileForm((current) => ({ ...current, displayName: event.target.value }))}
                          className="density-control w-full min-w-0 max-w-full rounded-2xl border border-outline-variant/60 bg-surface-container-lowest outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="md:col-span-2 min-w-0">
                        <label className="mb-2 block font-label text-xs font-bold uppercase tracking-[0.18em] text-secondary dark:text-gray-300 md:tracking-[0.22em]">Ảnh đại diện</label>
                        {profileForm.avatar.startsWith('data:image/') ? (
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest px-4 py-3">
                              <img src={profileForm.avatar} alt="Avatar preview" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-on-surface">Ảnh local đã chọn</p>
                                <p className="text-xs text-secondary dark:text-gray-300">Bấm Lưu để cập nhật hồ sơ.</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              aria-label="Tải ảnh đại diện lên"
                              onClick={() => avatarInputRef.current?.click()}
                              disabled={isUploadingAvatar}
                              className="density-button flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-surface-container-high px-4 py-3 font-semibold text-on-surface transition hover:bg-surface-container-highest disabled:opacity-50"
                            >
                              <Icons.Upload className="h-5 w-5" />
                              {isUploadingAvatar ? 'Đang tải...' : 'Đổi ảnh'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setProfileForm((current) => ({ ...current, avatar: '' }))}
                              className="rounded-2xl border border-outline-variant/60 px-4 py-3 font-semibold text-secondary transition hover:border-error hover:text-error"
                            >
                              Xóa
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              aria-label="Đường dẫn ảnh đại diện"
                              value={profileForm.avatar}
                              onChange={(event) => setProfileForm((current) => ({ ...current, avatar: event.target.value }))}
                              placeholder="https://..."
                              className="density-control min-w-0 max-w-full flex-1 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest px-4 py-3 text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                            />
                            <button
                              type="button"
                              aria-label="Tải ảnh đại diện lên"
                              onClick={() => avatarInputRef.current?.click()}
                              disabled={isUploadingAvatar}
                              className="density-button flex shrink-0 items-center gap-2 rounded-2xl bg-surface-container-high px-4 py-3 font-semibold text-on-surface transition hover:bg-surface-container-highest disabled:opacity-50"
                            >
                              <Icons.Upload className="h-5 w-5" />
                              <span className="hidden sm:inline">{isUploadingAvatar ? 'Đang tải...' : 'Tải lên'}</span>
                            </button>
                          </div>
                        )}
                        <input
                          aria-label="Tệp ảnh đại diện"
                          type="file"
                          accept="image/*"
                          ref={avatarInputRef}
                          onChange={(e) => { void handleAvatarUpload(e); }}
                          className="hidden"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="mb-2 block font-label text-xs font-bold uppercase tracking-[0.18em] text-secondary dark:text-gray-300 md:tracking-[0.22em]">Số điện thoại</label>
                        <input
                          aria-label="Số điện thoại"
                          value={profileForm.phone}
                          onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))}
                          className="density-control w-full min-w-0 max-w-full rounded-2xl border border-outline-variant/60 bg-surface-container-lowest outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="mb-2 block font-label text-xs font-bold uppercase tracking-[0.18em] text-secondary dark:text-gray-300 md:tracking-[0.22em]">Ngày sinh</label>
                        <input
                          aria-label="Ngày sinh"
                          type="date"
                          value={profileForm.birthdate}
                          onChange={(event) => setProfileForm((current) => ({ ...current, birthdate: event.target.value }))}
                          className="density-control w-full min-w-0 max-w-full rounded-2xl border border-outline-variant/60 bg-surface-container-lowest outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="md:col-span-2 min-w-0">
                        <label className="mb-2 block font-label text-xs font-bold uppercase tracking-[0.18em] text-secondary dark:text-gray-300 md:tracking-[0.22em]">Giới thiệu ngắn</label>
                        <textarea
                          aria-label="Giới thiệu ngắn"
                          rows={4}
                          value={profileForm.bio}
                          onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))}
                          className="density-control w-full min-w-0 max-w-full rounded-2xl border border-outline-variant/60 bg-surface-container-lowest outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <button type="submit" disabled={isSavingProfile} className="density-button w-full rounded-2xl bg-slate-950 font-headline text-base font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto md:text-lg">
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

            {activeSection === 'appearance' && (
              <motion.section key="appearance" variants={sectionVariants} initial="hidden" animate="visible" exit="exit" className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-[0_18px_40px_rgba(0,0,0,0.06)] md:p-8">
                <p className="font-label text-xs font-bold uppercase tracking-[0.24em] text-secondary dark:text-gray-300">Giao diện</p>
                <h2 className="mt-2 mb-8 font-headline text-3xl font-black tracking-[-0.04em] text-on-surface">Bố cục dày thông tin hơn, ít khoảng trống lãng phí hơn</h2>

                {canInstall && (
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

                <p className="mt-8 rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-secondary">Ngôn ngữ hiện tại: Tiếng Việt. Tùy chọn tiếng Anh sẽ xuất hiện khi toàn bộ giao diện được dịch đầy đủ.</p>
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
                      <label className="mb-2 block text-xs font-bold text-secondary">Nhắc trước hoạt động</label>
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
                    <div>
                      <label className="mb-2 block text-xs font-bold text-secondary">Nhắc trước khi chuyến đi bắt đầu</label>
                      <select value={tripStartLeadMinutes} onChange={(event) => setTripStartLeadMinutes(Number(event.target.value))} className="w-full rounded-2xl border border-outline-variant/60 bg-surface-container-low px-4 py-4 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20">
                        <option value={360}>6 giờ</option>
                        <option value={720}>12 giờ</option>
                        <option value={1440}>1 ngày</option>
                        <option value={2880}>2 ngày</option>
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
