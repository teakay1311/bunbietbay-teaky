import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icons } from './Icons';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useSettings } from '../context/SettingsContext';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export function TopNav({ hideNavLinks = false }: { hideNavLinks?: boolean }) {
  const { language } = useSettings();
  
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-xl border-none">
      <div className="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-8">
          <span className="text-2xl font-bold tracking-tighter text-teal-900 dark:text-teal-50 font-headline">Bunbietbay & Teakay's Trips</span>
          {!hideNavLinks && (
            <nav className="hidden md:flex gap-6">
              <Link to="/trips" className="text-teal-700 dark:text-teal-300 font-semibold border-b-2 border-teal-700 dark:border-teal-300 pb-1 font-headline">
                {language === 'vi' ? 'Chuyến đi của tôi' : 'My Trips'}
              </Link>
            </nav>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Link to="/settings" className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-lg transition-all active:scale-95 duration-200 text-teal-900 dark:text-teal-100">
            <Icons.Settings className="w-5 h-5" />
          </Link>
          <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-primary-container">
            <img alt="User profile avatar" className="h-full w-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAjwOJoLBnX2JUwc6BEa1Cn1c3_UWWgZ7Afkm8Fu91xEhtIyApn6Ixv7fFndNqHZ-c4nDmsVjUFlQOPQrYsWPJ3CzKGevXo9czk8AlAIj31yc6SZ1563yCVcLFUL6-mUm5BJ5b7zI_eHID_1OtdT0AUUGQGYMOrYMhq8lbcfETnLjaWLOLtv3UTPraASuYiqtD1qGrBnUFXm2ihpNGJLzOY2cmIsi8Go6KgtC4wLXigJzz4m7idh74Oc-O2bq1JK4DAlS7sTpE7eVs" />
          </div>
        </div>
      </div>
    </header>
  );
}

export function BottomNav({ tripId }: { tripId: string }) {
  const location = useLocation();
  const { language } = useSettings();
  
  const navItems = [
    { path: `/trips/${tripId}/overview`, icon: Icons.LayoutDashboard, label: language === 'vi' ? 'Tổng quan' : 'Overview' },
    { path: `/trips/${tripId}/schedule`, icon: Icons.Calendar, label: language === 'vi' ? 'Lịch trình' : 'Schedule' },
    { path: `/trips/${tripId}/expenses`, icon: Icons.Banknote, label: language === 'vi' ? 'Chi tiêu' : 'Expenses' },
    { path: `/trips/${tripId}/members`, icon: Icons.Users, label: language === 'vi' ? 'Thành viên' : 'Members' },
    { path: `/trips/${tripId}/places`, icon: Icons.Bookmark, label: language === 'vi' ? 'Địa điểm' : 'Places' },
    { path: `/trips/${tripId}/packing`, icon: Icons.Package, label: language === 'vi' ? 'Hành lý' : 'Packing' },
    { path: `/trips/${tripId}/photos`, icon: Icons.Image, label: language === 'vi' ? 'Thư viện' : 'Photos' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-2 pb-8 pt-4 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-xl z-50 rounded-t-3xl shadow-[0_-12px_24px_rgba(0,0,0,0.06)] md:max-w-xl md:left-1/2 md:-translate-x-1/2 md:mb-6 md:rounded-3xl">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center px-6 py-2 transition-all duration-300 ease-out active:scale-90",
              isActive 
                ? "bg-teal-100 dark:bg-teal-900/40 text-teal-900 dark:text-teal-100 rounded-2xl" 
                : "text-slate-400 dark:text-slate-500 hover:text-teal-600 dark:hover:text-teal-300"
            )}
          >
            <Icon className={cn("w-6 h-6 mb-1", isActive && "fill-current")} />
            <span className="font-label text-[10px] uppercase tracking-widest font-bold">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Layout({ children, hideNavLinks = false, tripId }: { children: ReactNode, hideNavLinks?: boolean, tripId?: string }) {
  return (
    <div className="min-h-screen bg-surface font-body text-on-surface pb-32">
      <TopNav hideNavLinks={hideNavLinks} />
      <main className="max-w-7xl mx-auto px-6 pt-28">
        {children}
      </main>
      {tripId && <BottomNav tripId={tripId} />}
    </div>
  );
}
