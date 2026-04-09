import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { FormEvent } from 'react';
import { Layout } from '../components/Layout';
import { Icons } from '../components/Icons';
import { useAppContext, CURRENCIES, Currency } from '../context/AppContext';
import { useSettings } from '../context/SettingsContext';
import { cn } from '../components/Layout';
import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { FormattedNumberInput } from '../components/FormattedNumberInput';
import { formatLocalDate } from '../utils/date';

export function MyTrips() {
  const { trips, addTrip, editTrip } = useAppContext();
  const { language } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenAddTripModal = () => {
      setEditingTripId(null);
      setIsAddOpen(true);
    };

    window.addEventListener('openAddTripModal', handleOpenAddTripModal);
    return () => window.removeEventListener('openAddTripModal', handleOpenAddTripModal);
  }, []);

  useEffect(() => {
    const state = location.state as { openAddTripModal?: boolean } | null;
    if (!state?.openAddTripModal) return;

    setEditingTripId(null);
    setIsAddOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const handleAddTrip = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    if (editingTripId) {
      editTrip(editingTripId, {
        title: formData.get('title') as string,
        location: formData.get('location') as string,
        startDate: formData.get('startDate') as string,
        endDate: formData.get('endDate') as string,
        budget: Number(formData.get('budget')),
        baseCurrency: formData.get('baseCurrency') as Currency,
        status: 'upcoming' // If it was a draft, make it upcoming
      });
      setEditingTripId(null);
    } else {
      addTrip({
        title: formData.get('title') as string,
        location: formData.get('location') as string,
        startDate: formData.get('startDate') as string,
        endDate: formData.get('endDate') as string,
        budget: Number(formData.get('budget')),
        baseCurrency: formData.get('baseCurrency') as Currency,
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBNwBnWoBo158dem-P8xSIbQ_85ZKdImaXbi_voQtZ9bp37lJlYlqChi6ExeK1ltAGJUUd2xmp266HL6l9zi3-gLznGgpzVZODbSjLzi2BuctK67XYi7GMn7IyNUfZUjJSz8wTMC0r6BNuLzmjajej_QmccAkbZmhqKP1M71Zy1fGDnqrkvSz_VPsP7HbVMNZ0pF4JgSWIx_4yRzPx-szCsEjRXvAEITiwemzOndLNpT1huf4AvIMenEMU2mwSzjpf6PPRfe1iYo9M', // Default image
      });
    }
    setIsAddOpen(false);
  };

  const editingTrip = trips.find(t => t.id === editingTripId);

  return (
    <Layout>
      <section className="mb-16">
        <div className="relative overflow-hidden rounded-xl bg-primary h-[300px] flex items-center p-12">
          <div className="absolute right-0 top-0 w-1/2 h-full opacity-20 pointer-events-none">
            <img alt="Travel abstract" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBNwBnWoBo158dem-P8xSIbQ_85ZKdImaXbi_voQtZ9bp37lJlYlqChi6ExeK1ltAGJUUd2xmp266HL6l9zi3-gLznGgpzVZODbSjLzi2BuctK67XYi7GMn7IyNUfZUjJSz8wTMC0r6BNuLzmjajej_QmccAkbZmhqKP1M71Zy1fGDnqrkvSz_VPsP7HbVMNZ0pF4JgSWIx_4yRzPx-szCsEjRXvAEITiwemzOndLNpT1huf4AvIMenEMU2mwSzjpf6PPRfe1iYo9M" />
          </div>
          <div className="relative z-10 max-w-lg">
            <h1 className="text-on-primary text-4xl font-extrabold tracking-tight mb-6 font-headline leading-tight">
              {language === 'vi' ? 'Chuyến hành trình tiếp theo của bạn bắt đầu tại đây.' : 'Your next journey begins here.'}
            </h1>
            <button onClick={() => { setEditingTripId(null); setIsAddOpen(true); }} className="group flex items-center gap-3 bg-gradient-to-r from-primary to-primary-container text-white px-8 py-4 rounded-lg font-bold text-lg shadow-[0_12px_24px_rgba(0,0,0,0.2)] hover:scale-[1.02] transition-transform active:scale-95">
              <Icons.PlusCircle className="w-6 h-6" />
              {language === 'vi' ? 'Tạo chuyến đi mới' : 'Create new trip'}
            </button>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="font-label text-xs uppercase tracking-[0.2em] text-secondary font-extrabold">{language === 'vi' ? 'Bộ sưu tập' : 'Collection'}</span>
            <h2 className="text-3xl font-bold text-primary font-headline mt-1">{language === 'vi' ? 'Chuyến đi của tôi' : 'My Trips'}</h2>
          </div>
          <div className="flex gap-2">
            <button disabled title="Tính năng này chưa được hỗ trợ" className="p-2 rounded-full bg-surface-container-high text-on-surface transition-colors disabled:cursor-not-allowed disabled:opacity-50">
              <Icons.Filter className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {trips.map((trip) => {
            if (trip.status === 'draft') {
              return (
                <div key={trip.id} onClick={() => { setEditingTripId(trip.id); setIsAddOpen(true); }} className="bg-surface-container-low rounded-xl p-6 border-2 border-dashed border-outline-variant flex flex-col items-center justify-center text-center opacity-70 group hover:opacity-100 transition-opacity cursor-pointer">
                  <Icons.FileEdit className="w-10 h-10 text-outline mb-4" />
                  <h3 className="text-lg font-bold font-headline mb-2">Bản nháp: {trip.title}</h3>
                  <p className="font-label text-xs text-outline mb-6">Chưa hoàn thiện thông tin điểm đến và ngân sách</p>
                  <button className="font-label text-[10px] font-extrabold uppercase tracking-widest text-primary border-b-2 border-primary pb-1">Tiếp tục chỉnh sửa</button>
                </div>
              );
            }
            return (
            <Link key={trip.id} to={`/trips/${trip.id}/schedule`} className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_12px_24px_rgba(0,0,0,0.06)] hover:translate-y-[-4px] transition-all duration-300 group block">
              <div className="flex justify-between items-start mb-6">
                <div className="h-16 w-16 rounded-lg bg-secondary-container flex items-center justify-center text-primary overflow-hidden">
                  <img alt={trip.title} className="h-full w-full object-cover" src={trip.image} />
                </div>
                <span className={cn(
                  "font-label text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest",
                  trip.status === 'upcoming' ? "bg-tertiary-fixed text-on-tertiary-fixed" : "bg-surface-container-high text-outline"
                )}>
                  {trip.status === 'upcoming' ? 'Sắp tới' : 'Đã xong'}
                </span>
              </div>
              <h3 className="text-xl font-bold font-headline mb-1 text-on-surface group-hover:text-primary transition-colors">{trip.title}</h3>
              <div className="flex items-center gap-1 text-secondary mb-6">
                <Icons.MapPin className="w-4 h-4" />
                <span className="font-label text-sm font-medium">{trip.location}</span>
              </div>
              <div className="space-y-4 pt-4 border-t border-surface-container">
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="font-label text-[10px] uppercase text-outline font-bold tracking-widest">Thời gian</span>
                    <span className="font-headline font-semibold text-sm">
                      {formatLocalDate(trip.startDate, { day: '2-digit', month: '2-digit' })} - {formatLocalDate(trip.endDate, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex -space-x-2">
                    {trip.members.slice(0, 2).map(member => (
                      <div key={member.id} className="w-7 h-7 rounded-full border-2 border-white bg-slate-200 overflow-hidden">
                        <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {trip.members.length > 2 && (
                      <div className="w-7 h-7 rounded-full border-2 border-white bg-primary-container text-white flex items-center justify-center text-[10px] font-bold">
                        +{trip.members.length - 2}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="font-label text-[10px] uppercase text-outline font-bold tracking-widest">Ngân sách</span>
                    <span className="font-headline font-bold text-primary">{trip.budget.toLocaleString('vi-VN')}{CURRENCIES[trip.baseCurrency || 'VND'].symbol}</span>
                  </div>
                  <div className="h-2 w-full bg-surface-variant rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full shadow-inner", trip.spent > trip.budget ? "bg-error" : "bg-tertiary")} 
                      style={{ width: `${Math.min((trip.spent / trip.budget) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <div className={cn("flex justify-between text-[10px] font-label font-bold", trip.spent > trip.budget ? "text-error" : "text-outline")}>
                    <span>Đã chi: {trip.spent.toLocaleString('vi-VN')}{CURRENCIES[trip.baseCurrency || 'VND'].symbol}</span>
                    <span>{trip.spent > trip.budget ? `Vượt mức ${Math.round(((trip.spent - trip.budget) / trip.budget) * 100)}%` : `${Math.round((trip.spent / trip.budget) * 100)}%`}</span>
                  </div>
                </div>
              </div>
            </Link>
            );
          })}
        </div>
      </section>

      <button onClick={() => { setEditingTripId(null); setIsAddOpen(true); }} className="md:hidden fixed right-6 bottom-8 w-14 h-14 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-90 transition-transform">
        <Icons.Plus className="w-6 h-6" />
      </button>

      <Modal isOpen={isAddOpen} onClose={() => { setIsAddOpen(false); setEditingTripId(null); }} title={editingTripId ? "Chỉnh sửa chuyến đi" : "Tạo chuyến đi mới"}>
        <form onSubmit={handleAddTrip} className="space-y-4">
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Tên chuyến đi</label>
            <input required name="title" type="text" defaultValue={editingTrip?.title} placeholder="VD: Mùa thu Hà Nội" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Địa điểm</label>
            <input required name="location" type="text" defaultValue={editingTrip?.location} placeholder="VD: Hà Nội, Việt Nam" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Ngày đi</label>
              <input required name="startDate" type="date" defaultValue={editingTrip?.startDate} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Ngày về</label>
              <input required name="endDate" type="date" defaultValue={editingTrip?.endDate} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Ngân sách dự kiến</label>
              <FormattedNumberInput required name="budget" defaultValue={editingTrip?.budget} placeholder="VD: 5.000.000" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Tiền tệ chính</label>
              <select name="baseCurrency" defaultValue={editingTrip?.baseCurrency || "VND"} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
                {Object.entries(CURRENCIES).map(([code, { name }]) => (
                  <option key={code} value={code}>{code} - {name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="pt-4">
            <button type="submit" className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold hover:opacity-90 transition-opacity">
              {editingTripId ? "Lưu thay đổi" : "Tạo chuyến đi"}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
