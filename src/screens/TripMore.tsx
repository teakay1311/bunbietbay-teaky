import { Link, useParams } from 'react-router-dom';
import { Icons } from '../components/Icons';

const items = [
  { path: 'memories', label: 'Kỷ niệm', description: 'Ảnh, album và nhật ký', icon: Icons.Image },
  { path: 'collaborate', label: 'Cộng tác', description: 'Nhiệm vụ, bình chọn và thông báo', icon: Icons.MessageCircle },
  { path: 'prepare?tab=team', label: 'Thành viên', description: 'Nhóm và quyền truy cập', icon: Icons.Users },
  { path: 'settings', label: 'Thiết lập chuyến đi', description: 'Thông tin, lịch sử và thao tác quản lý', icon: Icons.Settings },
];

export function TripMore() {
  const { id } = useParams();
  return (
    <div className="mx-auto max-w-3xl pb-16">
      <p className="mb-2 text-sm font-semibold text-secondary">Không gian chuyến đi</p>
      <h1 className="text-balance font-headline text-3xl font-extrabold md:text-5xl">Thêm</h1>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {items.map(({ path, label, description, icon: Icon }) => (
          <Link key={path} to={`/trips/${id}/${path}`} className="flex min-h-28 items-center gap-4 rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-5 hover:border-primary">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
            <span><strong className="block font-headline text-lg">{label}</strong><span className="mt-1 block text-pretty text-sm text-secondary">{description}</span></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
