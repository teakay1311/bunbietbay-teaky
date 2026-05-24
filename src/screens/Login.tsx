import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Icons } from '../components/Icons';
import { useAuth } from '../context/AuthContext';

type AccessMethod = 'password' | 'otp';
type PasswordMode = 'signin' | 'signup' | 'reset';

export function Login() {
  const {
    session,
    isCodeSent,
    isAuthLoading,
    authError,
    authNotice,
    pendingInvitations,
    clearAuthFeedback,
    signInWithPassword,
    signUpWithPassword,
    sendLoginCode,
    verifyLoginCode,
    sendPasswordReset,
  } = useAuth();
  const [accessMethod, setAccessMethod] = useState<AccessMethod>('password');
  const [passwordMode, setPasswordMode] = useState<PasswordMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [token, setToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const invitationHint = useMemo(() => {
    if (pendingInvitations.length === 0) {
      return null;
    }

    return pendingInvitations[0];
  }, [pendingInvitations]);

  useEffect(() => {
    setLocalError(null);
    clearAuthFeedback();
  }, [accessMethod, passwordMode, clearAuthFeedback]);

  if (session) {
    return <Navigate to="/trips" replace />;
  }

  const isOtpMode = accessMethod === 'otp';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    setIsSubmitting(true);

    try {
      if (isOtpMode) {
        if (isCodeSent) {
          await verifyLoginCode(email, token);
        } else {
          await sendLoginCode(email);
        }
        return;
      }

      if (passwordMode === 'reset') {
        await sendPasswordReset(email);
        return;
      }

      if (password.trim().length < 6) {
        setLocalError('Mật khẩu cần có ít nhất 6 ký tự.');
        return;
      }

      if (passwordMode === 'signup') {
        if (password !== confirmPassword) {
          setLocalError('Xác nhận mật khẩu chưa khớp.');
          return;
        }

        await signUpWithPassword(email, password);
        return;
      }

      await signInWithPassword(email, password);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(0,107,125,0.18),_transparent_34%),linear-gradient(160deg,_var(--color-surface)_0%,_var(--color-surface-container-low)_46%,_var(--color-background)_100%)] px-6 py-8 text-on-surface">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl grid-cols-1 overflow-hidden rounded-[2rem] border border-outline-variant/35 bg-surface-container-lowest/90 shadow-[0_30px_80px_rgba(2,33,39,0.12)] backdrop-blur-xl lg:grid-cols-[1.12fr_0.88fr]">
        <section className="relative overflow-hidden px-6 pt-4 pb-10 lg:px-8 lg:pt-6 lg:pb-14 bg-cover bg-center rounded-[2rem] md:rounded-[none] md:rounded-l-[2rem]" style={{ backgroundImage: "url('/login-bg.png')" }}>
          <div className="absolute inset-y-0 right-0 hidden w-px bg-gradient-to-b from-transparent via-outline-variant/50 to-transparent lg:block" />
          <div className="relative z-10 flex h-[100%] flex-col justify-start">
            <div className="max-w-xl bg-surface/85 backdrop-blur-3xl p-6 lg:p-8 rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-white/5">
              <p className="font-label text-xs font-extrabold uppercase tracking-[0.35em] text-primary dark:text-white">Bunbietbay & Teakay's Trips</p>
              <h1 className="mt-5 max-w-xl font-headline text-4xl lg:text-5xl font-black leading-[1.05] tracking-[-0.04em] text-on-surface drop-shadow-sm">
                Hành trình trọn vẹn, kỷ niệm lưu giữ mãi mãi.
              </h1>
              <p className="mt-5 max-w-lg text-base lg:text-lg leading-relaxed text-on-surface-variant font-medium">
                Tổ chức chuyến bay, lên lịch trình, chia sẻ chi phí và lưu giữ ảnh cùng bạn bè chỉ trong một ứng dụng duy nhất.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center bg-[linear-gradient(180deg,_rgba(0,81,95,0.06),_rgba(0,81,95,0.01))] px-6 py-10 lg:px-10">
          <div className="mx-auto w-full max-w-md">
            <div className="rounded-[2rem] bg-surface-container-lowest p-7 shadow-[0_20px_40px_rgba(0,0,0,0.08)]">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="font-label text-xs font-bold uppercase tracking-[0.3em] text-secondary dark:text-gray-300">Đăng nhập</p>
                  <h2 className="mt-3 font-headline text-3xl font-black tracking-[-0.03em] text-on-surface">
                    {isOtpMode
                      ? (isCodeSent ? 'Nhập mã xác thực' : 'Đăng nhập bằng OTP email')
                      : passwordMode === 'signup'
                        ? 'Tạo tài khoản bằng mật khẩu'
                        : passwordMode === 'reset'
                          ? 'Khôi phục mật khẩu'
                          : 'Đăng nhập bằng mật khẩu'}
                  </h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:text-white">
                  {isOtpMode ? <Icons.Mail className="h-6 w-6" /> : <Icons.Lock className="h-6 w-6" />}
                </div>
              </div>

              <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-surface-container-low p-1">
                <button
                  type="button"
                  onClick={() => setAccessMethod('password')}
                  className={`rounded-[1rem] px-4 py-3 text-sm font-bold transition ${!isOtpMode ? 'bg-slate-950 text-white' : 'text-secondary dark:text-gray-300'}`}
                >
                  Mật khẩu
                </button>
                <button
                  type="button"
                  onClick={() => setAccessMethod('otp')}
                  className={`rounded-[1rem] px-4 py-3 text-sm font-bold transition ${isOtpMode ? 'bg-slate-950 text-white' : 'text-secondary dark:text-gray-300'}`}
                >
                  OTP email
                </button>
              </div>

              {!isOtpMode && (
                <div className="mb-5 flex flex-wrap gap-2">
                  {([
                    ['signin', 'Đăng nhập'],
                    ['signup', 'Tạo tài khoản'],
                    ['reset', 'Quên mật khẩu'],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPasswordMode(mode)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${passwordMode === mode ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-secondary dark:text-gray-300'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {(localError || authError) && (
                <div className="mb-5 rounded-2xl bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
                  {localError || authError}
                </div>
              )}

              {authNotice && (
                <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-on-surface">
                  {authNotice}
                </div>
              )}

              {invitationHint && (
                <div className="mb-5 rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-900 dark:border-teal-900/40 dark:bg-teal-950/40 dark:text-teal-100">
                  Bạn đang có lời mời vào <strong>{invitationHint.tripTitle}</strong>. Đăng nhập đúng email được mời để nhận quyền.
                </div>
              )}

              <form className="space-y-4" onSubmit={(event) => { void handleSubmit(event); }}>
                <div>
                  <label className="mb-2 block font-label text-xs font-bold uppercase tracking-[0.2em] text-secondary dark:text-gray-300">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="density-control w-full rounded-2xl border border-outline-variant/60 bg-surface-container-low text-base text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {!isOtpMode && passwordMode !== 'reset' && (
                  <div>
                    <label className="mb-2 block font-label text-xs font-bold uppercase tracking-[0.2em] text-secondary dark:text-gray-300">Mật khẩu</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Tối thiểu 6 ký tự"
                      className="density-control w-full rounded-2xl border border-outline-variant/60 bg-surface-container-low text-base text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                )}

                {!isOtpMode && passwordMode === 'signup' && (
                  <div>
                    <label className="mb-2 block font-label text-xs font-bold uppercase tracking-[0.2em] text-secondary dark:text-gray-300">Xác nhận mật khẩu</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Nhập lại mật khẩu"
                      className="density-control w-full rounded-2xl border border-outline-variant/60 bg-surface-container-low text-base text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                )}

                {isOtpMode && isCodeSent && (
                  <div>
                    <label className="mb-2 block font-label text-xs font-bold uppercase tracking-[0.2em] text-secondary dark:text-gray-300">Mã xác thực</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={token}
                      onChange={(event) => setToken(event.target.value)}
                      placeholder="123456"
                      className="density-control w-full rounded-2xl border border-outline-variant/60 bg-surface-container-low text-base text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    isSubmitting
                    || isAuthLoading
                    || !email.trim()
                    || (!isOtpMode && passwordMode !== 'reset' && !password.trim())
                    || (passwordMode === 'signup' && !confirmPassword.trim())
                    || (isOtpMode && isCodeSent && !token.trim())
                  }
                  className="density-button w-full rounded-2xl bg-slate-950 font-headline text-lg font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isOtpMode
                    ? (isCodeSent ? 'Xác nhận và vào ứng dụng' : 'Gửi mã xác thực')
                    : passwordMode === 'signup'
                      ? 'Tạo tài khoản'
                      : passwordMode === 'reset'
                        ? 'Gửi email đặt lại mật khẩu'
                        : 'Đăng nhập'}
                </button>

                {isOtpMode && isCodeSent && (
                  <button
                    type="button"
                    onClick={() => {
                      setToken('');
                      setIsSubmitting(true);
                      void sendLoginCode(email).finally(() => setIsSubmitting(false));
                    }}
                    className="density-button w-full rounded-2xl border border-outline-variant/60 font-semibold text-secondary dark:text-gray-300 transition hover:border-primary hover:text-primary dark:text-white"
                  >
                    Gửi lại mã
                  </button>
                )}
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
