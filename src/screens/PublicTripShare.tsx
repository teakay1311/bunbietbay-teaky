import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Icons } from '../components/Icons';
import { formatLocalDate } from '../utils/date';

type PublicShareData = { expiresAt: string; scopes: string[]; trip: { title: string; location: string; startDate: string; endDate: string; image?: string }; activities: Array<{ id: string; date: string; time: string; title: string; location: string; note?: string; durationMinutes?: number }>; places: Array<{ id: string; name: string; type: string; address?: string; rating?: number; note?: string }>; photos: Array<{ id: string; url: string; album: string; takenOn?: string; place?: string }> };

export function PublicTripShare() {
  const { token = '' } = useParams();
  const [data, setData] = useState<PublicShareData | null>();
  useEffect(() => {
    let active = true;
    if (!supabase) {
      setData(null);
      return () => { active = false; };
    }
    void supabase.rpc('get_public_trip_share', { p_token: token }).then(({ data: value, error }) => { if (active) setData(error ? null : value as PublicShareData | null); });
    return () => { active = false; };
  }, [token]);
  useEffect(() => {
    const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex,nofollow';
    const referrer = document.createElement('meta'); referrer.name = 'referrer'; referrer.content = 'no-referrer';
    document.head.append(robots, referrer);
    return () => { robots.remove(); referrer.remove(); };
  }, []);
  if (data === undefined) return <div className="flex min-h-dvh items-center justify-center bg-surface"><Icons.Loader2 className="size-8 animate-spin text-primary" /><span className="sr-only">Đang tải chuyến đi</span></div>;
  if (!data) return <div className="flex min-h-dvh items-center justify-center bg-surface p-6 text-center"><div><Icons.Lock className="mx-auto size-10 text-secondary" /><h1 className="mt-4 font-headline text-2xl font-bold">Link không còn khả dụng</h1><p className="mt-2 text-secondary">Link có thể đã hết hạn hoặc bị thu hồi.</p></div></div>;
  return <main className="min-h-dvh bg-surface pb-16 text-on-surface"><header className="bg-primary px-5 py-10 text-on-primary"><div className="mx-auto max-w-5xl"><p className="text-sm font-semibold opacity-80">Chuyến đi được chia sẻ</p><h1 className="mt-2 font-headline text-3xl font-extrabold md:text-4xl">{data.trip.title}</h1><p className="mt-2">{data.trip.location} · {formatLocalDate(data.trip.startDate, {})} – {formatLocalDate(data.trip.endDate, {})}</p></div></header><div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
    {data.scopes.includes('itinerary') && <section><h2 className="font-headline text-2xl font-bold">Lịch trình</h2><div className="mt-4 space-y-3">{data.activities.map((activity) => <article key={activity.id} className="rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-4"><p className="text-sm font-bold text-primary">{formatLocalDate(activity.date, {})} · {activity.time}</p><h3 className="mt-1 font-headline text-lg font-bold">{activity.title}</h3><p className="mt-1 text-sm text-secondary">{activity.location}</p>{activity.note && <p className="mt-2 text-sm">{activity.note}</p>}</article>)}</div></section>}
    {data.scopes.includes('places') && <section><h2 className="font-headline text-2xl font-bold">Địa điểm</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{data.places.map((place) => <article key={place.id} className="rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-4"><h3 className="font-headline text-lg font-bold">{place.name}</h3>{place.address && <p className="mt-1 text-sm text-secondary">{place.address}</p>}{place.note && <p className="mt-2 text-sm">{place.note}</p>}</article>)}</div></section>}
    {data.scopes.includes('photos') && <section><h2 className="font-headline text-2xl font-bold">Ảnh</h2><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">{data.photos.map((photo) => <img key={photo.id} src={photo.url} alt={photo.place || photo.album} loading="lazy" decoding="async" className="aspect-square w-full rounded-xl object-cover" />)}</div></section>}
    <footer className="border-t border-outline-variant pt-5 text-xs text-secondary">Link chỉ đọc · Hết hạn {new Date(data.expiresAt).toLocaleString('vi-VN')}</footer>
  </div></main>;
}
