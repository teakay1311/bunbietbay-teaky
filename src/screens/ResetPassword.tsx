import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icons } from '../components/Icons';
import { useAuth } from '../context/AuthContext';

export function ResetPassword() {
  const {
    session,
    isAuthLoading,
    isPasswordRecovery,
    authError,
    clearAuthFeedback,
    updatePassword,
    signOut,
    cancelPasswordRecovery,
  } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [stage, setStage] = useState<'editing' | 'submitting' | 'signout-error' | 'complete'>('editing');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    clearAuthFeedback();

    if (password.length < 6) {
      setLocalError('Mật khẩu mới cần có ít nhất 6 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Xác nhận mật khẩu chưa khớp.');
      return;
    }

    setStage('submitting');
    try {
      await updatePassword(password);
      setPassword('');
      setConfirmPassword('');
      try {
        await signOut();
        setStage('complete');
      } catch {
        setLocalError('Mật khẩu đã được đổi nhưng chưa thể đăng xuất mọi thiết bị. Hãy thử lại thao tác đăng xuất.');
        setStage('signout-error');
      }
    } catch {
      // AuthContext already exposes localized feedback for auth failures.
      setStage('editing');
    }
  };

  const retrySignOut = async () => {
    setLocalError(null);
    clearAuthFeedback();
    setStage('submitting');
    try {
      await signOut();
      setStage('complete');
    } catch {
      setLocalError('Vẫn chưa thể đăng xuất mọi thiết bị. Vui lòng kiểm tra kết nối và thử lại.');
      setStage('signout-error');
    }
  };

  const cancelRecovery = async () => {
    setLocalError(null);
    clearAuthFeedback();
    setStage('submitting');
    try {
      await cancelPasswordRecovery();
      navigate('/login', { replace: true });
    } catch {
      setStage('editing');
    }
  };

  if (isAuthLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-surface px-6 text-on-surface">
        <p className="text-secondary">Đang xác thực liên kết đặt lại mật khẩu…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface px-6 py-10 text-on-surface">
      <section className="w-full max-w-md rounded-[2rem] border-2 border-[#0b1213] bg-surface-container-lowest p-7 shadow-[4px_4px_0_rgba(11,18,19,0.14)] dark:border-[#fff4e6] dark:shadow-[4px_4px_0_rgba(255,244,230,0.12)] sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="font-label text-xs font-bold uppercase tracking-[0.3em] text-secondary dark:text-gray-300">Bunbietbay Trips</p>
            <h1 className="mt-3 font-headline text-3xl font-black tracking-[-0.03em]">
              {stage === 'complete' ? 'Mật khẩu đã được đổi' : 'Đặt mật khẩu mới'}
            </h1>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:text-white">
            {stage === 'complete' ? <Icons.Check className="h-6 w-6" /> : <Icons.Lock className="h-6 w-6" />}
          </div>
        </div>

        {stage === 'complete' ? (
          <div>
            <p className="text-on-surface-variant">Mọi phiên đăng nhập đã được thu hồi. Hãy đăng nhập lại bằng mật khẩu mới.</p>
            <Link to="/login" className="density-button mt-6 flex w-full items-center justify-center rounded-2xl bg-slate-950 font-headline text-lg font-bold text-white transition hover:opacity-95">
              Đăng nhập bằng mật khẩu mới
            </Link>
          </div>
        ) : !session || !isPasswordRecovery ? (
          <div>
            <div className="rounded-2xl bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
              Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy yêu cầu một email mới.
            </div>
            <Link to="/login" className="density-button mt-6 flex w-full items-center justify-center rounded-2xl bg-slate-950 font-headline text-lg font-bold text-white transition hover:opacity-95">
              Quay lại đăng nhập
            </Link>
          </div>
        ) : stage === 'signout-error' ? (
          <div>
            <div className="rounded-2xl bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
              {localError || authError || 'Không thể đăng xuất mọi thiết bị.'}
            </div>
            <button
              type="button"
              onClick={() => { void retrySignOut(); }}
              className="density-button mt-6 w-full rounded-2xl bg-slate-950 font-headline text-lg font-bold text-white transition hover:opacity-95"
            >
              Thử đăng xuất lại
            </button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(event) => { void handleSubmit(event); }}>
            {(localError || authError) && (
              <div className="rounded-2xl bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
                {localError || authError}
              </div>
            )}

            <div>
              <label htmlFor="new-password" className="mb-2 block font-label text-xs font-bold uppercase tracking-[0.2em] text-secondary dark:text-gray-300">Mật khẩu mới</label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                className="density-control w-full rounded-2xl border border-[#0b1213]/60 bg-surface-container-lowest text-base text-on-surface outline-none transition placeholder:text-secondary/80 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-[#fff4e6]/55"
              />
            </div>

            <div>
              <label htmlFor="confirm-new-password" className="mb-2 block font-label text-xs font-bold uppercase tracking-[0.2em] text-secondary dark:text-gray-300">Xác nhận mật khẩu</label>
              <input
                id="confirm-new-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                className="density-control w-full rounded-2xl border border-[#0b1213]/60 bg-surface-container-lowest text-base text-on-surface outline-none transition placeholder:text-secondary/80 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-[#fff4e6]/55"
              />
            </div>

            <button
              type="submit"
              disabled={stage === 'submitting' || !password || !confirmPassword}
              className="density-button w-full rounded-2xl bg-slate-950 font-headline text-lg font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {stage === 'submitting' ? 'Đang cập nhật và đăng xuất…' : 'Lưu mật khẩu mới'}
            </button>

            <button
              type="button"
              disabled={stage === 'submitting'}
              onClick={() => { void cancelRecovery(); }}
              className="density-button w-full rounded-2xl border border-outline-variant/60 bg-surface-container-low font-semibold text-on-surface transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Hủy khôi phục
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
