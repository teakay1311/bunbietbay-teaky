import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useFeedback } from '../context/FeedbackContext';
import { formatLocalDateTime } from '../utils/date';
import { useSettings } from '../context/SettingsContext';

export function TripSettings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { trips, activityLogs, editTrip, deleteTrip } = useAppContext();
  const { confirm, showToast } = useFeedback();
  const { tripNotificationPreferences, getEffectiveTripReminders, setTripNotificationPreferences, resetTripNotificationPreferences } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [notificationDraft, setNotificationDraft] = useState({ useDefaults: true, enabled: true, activityLeadMinutes: 120, tripStartLeadMinutes: 1440 });
  const trip = trips.find((item) => item.id === id);
  useEffect(() => {
    if (!trip) return;
    const current = tripNotificationPreferences[trip.id];
    const effective = getEffectiveTripReminders(trip.id);
    setNotificationDraft({
      useDefaults: current?.useDefaults ?? true,
      enabled: effective.enabled,
      activityLeadMinutes: effective.activityLeadMinutes,
      tripStartLeadMinutes: effective.tripStartLeadMinutes,
    });
  }, [getEffectiveTripReminders, trip, tripNotificationPreferences]);
  if (!trip) return <p>Không tìm thấy chuyến đi.</p>;

  const logs = activityLogs.filter((log) => log.tripId === trip.id).slice(0, 8);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      setIsSaving(true);
      await editTrip(trip.id, {
        title: String(data.get('title') || '').trim(),
        location: String(data.get('location') || '').trim(),
        startDate: String(data.get('startDate') || ''),
        endDate: String(data.get('endDate') || ''),
        budget: Number(data.get('budget')),
        status: data.get('status') as typeof trip.status,
        themeColor: String(data.get('themeColor') || '') || undefined,
      });
      showToast({ tone: 'success', title: 'Đã lưu thiết lập chuyến đi' });
    } catch (error) {
      showToast({ tone: 'error', title: 'Không thể lưu', message: error instanceof Error ? error.message : 'Hãy thử lại.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl pb-16">
      <header className="mb-8">
        <p className="mb-2 text-sm font-semibold text-secondary">Quản lý chuyến đi</p>
        <h1 className="text-balance font-headline text-3xl font-extrabold md:text-5xl">Thiết lập</h1>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-5 md:p-6">
          <fieldset disabled={!trip.permissions.canManageTrip} className="space-y-4 disabled:opacity-70">
          <Field label="Tên chuyến đi"><input name="title" required defaultValue={trip.title} /></Field>
          <Field label="Địa điểm"><input name="location" required defaultValue={trip.location} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ngày bắt đầu"><input name="startDate" type="date" required defaultValue={trip.startDate} /></Field>
            <Field label="Ngày kết thúc"><input name="endDate" type="date" required defaultValue={trip.endDate} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ngân sách"><input name="budget" type="number" min="1" required defaultValue={trip.budget} /></Field>
            <Field label="Trạng thái"><select name="status" defaultValue={trip.status}><option value="draft">Bản nháp</option><option value="upcoming">Sắp tới</option><option value="completed">Hoàn thành</option></select></Field>
          </div>
          <Field label="Màu trang trí chuyến đi"><input name="themeColor" type="color" defaultValue={trip.themeColor || '#0ea5e9'} /></Field>
          <button type="submit" disabled={isSaving || !trip.permissions.canManageTrip} className="min-h-11 rounded-xl bg-primary px-5 font-semibold text-on-primary disabled:opacity-50">{isSaving ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
          </fieldset>
        </form>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-5">
            <h2 className="font-headline text-xl font-bold">Quyền truy cập</h2>
            <p className="mt-2 text-sm text-secondary">{trip.members.length} thành viên đang hoạt động · Vai trò của bạn: {trip.membershipRole ?? 'khách'}</p>
            <Link to={`/trips/${trip.id}/prepare?tab=team`} className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-outline-variant px-4 text-sm font-semibold">Quản lý nhóm</Link>
          </section>
          <section className="rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-5">
            <h2 className="font-headline text-xl font-bold">Nhắc việc của tôi</h2>
            <label className="mt-4 flex min-h-11 items-center gap-3 text-sm font-semibold">
              <input type="checkbox" checked={notificationDraft.useDefaults} onChange={(event) => setNotificationDraft((current) => ({ ...current, useDefaults: event.target.checked }))} />
              Dùng mặc định tài khoản
            </label>
            {!notificationDraft.useDefaults && <div className="mt-3 space-y-3">
              <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={notificationDraft.enabled} onChange={(event) => setNotificationDraft((current) => ({ ...current, enabled: event.target.checked }))} />Bật nhắc việc</label>
              <label className="block text-sm font-semibold">Nhắc trước hoạt động<select value={notificationDraft.activityLeadMinutes} onChange={(event) => setNotificationDraft((current) => ({ ...current, activityLeadMinutes: Number(event.target.value) }))} className="mt-2 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3"><option value={30}>30 phút</option><option value={60}>1 giờ</option><option value={120}>2 giờ</option><option value={360}>6 giờ</option><option value={1440}>1 ngày</option></select></label>
              <label className="block text-sm font-semibold">Nhắc trước chuyến đi<select value={notificationDraft.tripStartLeadMinutes} onChange={(event) => setNotificationDraft((current) => ({ ...current, tripStartLeadMinutes: Number(event.target.value) }))} className="mt-2 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3"><option value={360}>6 giờ</option><option value={720}>12 giờ</option><option value={1440}>1 ngày</option><option value={2880}>2 ngày</option></select></label>
            </div>}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={async () => {
                try {
                  await setTripNotificationPreferences(trip.id, notificationDraft);
                  showToast({ tone: 'success', title: 'Đã lưu nhắc việc cho chuyến đi' });
                } catch (error) {
                  showToast({ tone: 'error', title: 'Không thể lưu nhắc việc', message: error instanceof Error ? error.message : 'Hãy thử lại.' });
                }
              }} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary">Lưu nhắc việc</button>
              {!notificationDraft.useDefaults && <button type="button" onClick={async () => {
                try {
                  await resetTripNotificationPreferences(trip.id);
                  showToast({ tone: 'success', title: 'Đã dùng lại mặc định tài khoản' });
                } catch (error) {
                  showToast({ tone: 'error', title: 'Không thể đặt lại', message: error instanceof Error ? error.message : 'Hãy thử lại.' });
                }
              }} className="min-h-11 rounded-xl border border-outline-variant px-4 text-sm font-semibold">Đặt lại mặc định</button>}
            </div>
          </section>
          <section className="rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-5">
            <h2 className="font-headline text-xl font-bold">Hoạt động gần đây</h2>
            <div className="mt-4 space-y-3">{logs.length ? logs.map((log) => <div key={log.id}><p className="text-sm font-medium">{log.summary}</p><p className="text-xs text-secondary">{formatLocalDateTime(log.createdAt)}</p></div>) : <p className="text-sm text-secondary">Chưa có hoạt động.</p>}</div>
          </section>
          {trip.permissions.canDeleteTrip && <button type="button" onClick={async () => {
            const approved = await confirm({ title: 'Xóa chuyến đi?', message: 'Toàn bộ dữ liệu liên quan sẽ bị xóa. Thao tác này không thể hoàn tác.', confirmLabel: 'Xóa chuyến đi', tone: 'danger' });
            if (!approved) return;
            await deleteTrip(trip.id);
            navigate('/trips');
          }} className="min-h-11 w-full rounded-xl border border-error px-4 font-semibold text-error">Xóa chuyến đi</button>}
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactElement }) {
  return <label className="block text-sm font-semibold text-secondary"><span className="mb-2 block">{label}</span><span className="[&>*]:min-h-11 [&>*]:w-full [&>*]:rounded-xl [&>*]:border [&>*]:border-outline-variant [&>*]:bg-surface [&>*]:px-3 [&>*]:text-on-surface">{children}</span></label>;
}
