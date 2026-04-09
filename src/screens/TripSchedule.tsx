import { useParams } from 'react-router-dom';
import type { FormEvent } from 'react';
import { Layout } from '../components/Layout';
import { Icons } from '../components/Icons';
import { useAppContext } from '../context/AppContext';
import { useEffect, useState, useMemo } from 'react';
import { Modal } from '../components/Modal';
import { Activity } from '../context/AppContext';
import { formatLocalDate, normalizeTimeForInput, parseLocalDate } from '../utils/date';

export function TripSchedule() {
  const { id } = useParams();
  const { trips, activities, setCurrentTripId, deleteActivity, addActivity, editActivity } = useAppContext();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  const handleAddActivity = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    if (editingActivity) {
      editActivity(editingActivity.id, {
        date: formData.get('date') as string,
        time: formData.get('time') as string,
        title: formData.get('title') as string,
        location: formData.get('location') as string,
        type: formData.get('type') as any,
        note: formData.get('note') as string,
        mapUrl: formData.get('mapUrl') as string,
      });
      setEditingActivity(null);
    } else {
      addActivity({
        tripId: id!,
        date: formData.get('date') as string,
        time: formData.get('time') as string,
        title: formData.get('title') as string,
        location: formData.get('location') as string,
        type: formData.get('type') as any,
        note: formData.get('note') as string,
        mapUrl: formData.get('mapUrl') as string,
      });
    }
    setIsAddOpen(false);
  };
  
  useEffect(() => {
    if (id) setCurrentTripId(id);
  }, [id, setCurrentTripId]);

  const trip = trips.find(t => t.id === id);
  
  // Extract unique dates from activities for this trip
  const tripActivities = useMemo(() => activities.filter(a => a.tripId === id), [activities, id]);
  const uniqueDates = useMemo(() => {
    const dates = [...new Set<string>(tripActivities.map(a => a.date))];
    return dates.sort((a, b) => parseLocalDate(a).getTime() - parseLocalDate(b).getTime());
  }, [tripActivities]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (uniqueDates.length > 0 && (!selectedDate || !uniqueDates.includes(selectedDate))) {
      setSelectedDate(uniqueDates[0]);
      return;
    }

    if (uniqueDates.length === 0 && selectedDate !== null) {
      setSelectedDate(null);
    }
  }, [uniqueDates, selectedDate]);

  if (!trip) return <Layout><div>Trip not found</div></Layout>;

  const filteredActivities = tripActivities.filter(a => a.date === selectedDate);

  const formatDateLabel = (dateString: string) => {
    return formatLocalDate(dateString, { day: '2-digit', month: '2-digit' });
  };

  const formatFullDate = (dateString: string) => {
    return `Ngày ${uniqueDates.indexOf(dateString) + 1}: ${formatLocalDate(dateString, { day: '2-digit', month: 'long' })}`;
  };

  return (
    <Layout tripId={trip.id}>
      <section className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="font-label text-sm uppercase tracking-widest text-secondary font-bold mb-2 block">Hành trình sắp tới</span>
            <h1 className="font-headline text-4xl font-extrabold tracking-tight text-primary">{trip.title}</h1>
            <p className="text-on-surface-variant mt-2 flex items-center gap-2">
              <Icons.CalendarDays className="w-4 h-4" />
              {formatLocalDate(trip.startDate, { day: '2-digit', month: 'short' })} - {formatLocalDate(trip.endDate, { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <button onClick={() => { setEditingActivity(null); setIsAddOpen(true); }} className="editorial-gradient text-white px-8 py-4 rounded-xl font-bold flex items-center gap-3 shadow-lg hover:opacity-90 transition-all active:scale-95">
            <Icons.Plus className="w-5 h-5" />
            Thêm hoạt động
          </button>
        </div>
      </section>

      {uniqueDates.length > 0 ? (
        <>
          <div className="flex gap-4 overflow-x-auto no-scrollbar mb-8 pb-2">
            {uniqueDates.map((date, index) => (
              <button 
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`flex-shrink-0 px-6 py-2 rounded-full font-bold transition-colors ${
                  selectedDate === date 
                    ? 'bg-primary text-white' 
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                }`}
              >
                Ngày {index + 1} ({formatDateLabel(date)})
              </button>
            ))}
          </div>

          <div className="space-y-12 relative">
            <div className="sticky top-24 z-10 py-2 bg-surface/80 backdrop-blur-sm">
              <h2 className="font-headline text-2xl font-bold text-secondary flex items-center gap-3">
                <span className="w-8 h-[2px] bg-outline-variant"></span>
                {selectedDate && formatFullDate(selectedDate)}
              </h2>
            </div>

            <div className="absolute left-[39px] top-20 bottom-0 w-[2px] bg-surface-container-highest -z-10"></div>

            <div className="space-y-8 ml-4 pl-12">
              {filteredActivities.length > 0 ? (
                filteredActivities.map((activity) => (
                  <article key={activity.id} className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0_12px_24px_rgba(0,0,0,0.04)] relative group border-l-4 border-primary/20 hover:border-primary transition-all">
                    <div className="absolute -left-[33px] top-6 w-4 h-4 rounded-full bg-primary border-4 border-surface ring-4 ring-surface"></div>
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-label text-xs font-bold uppercase tracking-widest text-primary bg-primary-container/20 px-3 py-1 rounded-full">{activity.time}</span>
                          {activity.type === 'flight' && <Icons.PlaneLanding className="w-5 h-5 text-secondary" />}
                          {activity.type === 'hotel' && <Icons.Hotel className="w-5 h-5 text-secondary" />}
                          {activity.type === 'restaurant' && <Icons.Utensils className="w-5 h-5 text-secondary" />}
                        </div>
                        <h3 className="font-headline text-xl font-bold text-on-surface mb-1">{activity.title}</h3>
                        <p className="text-secondary flex items-center gap-1 mb-4">
                          <Icons.MapPin className="w-4 h-4" />
                          {activity.location}
                          {activity.mapUrl && (
                            <a href={activity.mapUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-primary hover:underline text-xs font-bold flex items-center gap-1">
                              <Icons.Map className="w-3 h-3" /> Bản đồ
                            </a>
                          )}
                        </p>
                        
                        {activity.image ? (
                          <div className="grid grid-cols-2 gap-4 mt-2">
                            <img alt={activity.title} className="w-full h-32 object-cover rounded-xl" src={activity.image} />
                            <div className="bg-surface-container-low p-4 rounded-xl flex items-center">
                              <p className="text-on-surface-variant text-sm italic">"{activity.note}"</p>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-surface-container-low p-4 rounded-xl">
                            <p className="text-on-surface-variant text-sm italic">"{activity.note}"</p>
                          </div>
                        )}
                      </div>
                      <div className="flex md:flex-col gap-2">
                        <button onClick={() => { setEditingActivity(activity); setIsAddOpen(true); }} className="p-2 hover:bg-surface-container-high rounded-lg text-secondary hover:text-primary transition-colors">
                          <Icons.Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => deleteActivity(activity.id)}
                          className="p-2 hover:bg-error-container hover:text-error rounded-lg text-secondary transition-colors"
                        >
                          <Icons.Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="py-8 text-center text-secondary italic">
                  Chưa có hoạt động nào trong ngày này.
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="py-20 text-center bg-surface-container-lowest rounded-3xl border-2 border-dashed border-outline-variant">
          <Icons.Calendar className="w-16 h-16 text-outline mx-auto mb-4" />
          <h3 className="font-headline text-xl font-bold text-on-surface mb-2">Chưa có lịch trình</h3>
          <p className="text-secondary mb-6">Hãy bắt đầu thêm các hoạt động cho chuyến đi của bạn.</p>
        </div>
      )}

      <div className="mt-12 ml-4 pl-12">
        <button onClick={() => { setEditingActivity(null); setIsAddOpen(true); }} className="w-full py-8 border-2 border-dashed border-outline-variant rounded-2xl flex flex-col items-center justify-center gap-2 text-secondary hover:border-primary hover:text-primary transition-all group">
          <Icons.PlusCircle className="w-8 h-8 group-hover:scale-110 transition-transform" />
          <span className="font-bold">Thêm hoạt động mới cho ngày này</span>
        </button>
      </div>

      <Modal isOpen={isAddOpen} onClose={() => { setIsAddOpen(false); setEditingActivity(null); }} title={editingActivity ? "Sửa hoạt động" : "Thêm hoạt động"}>
        <form onSubmit={handleAddActivity} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Ngày</label>
              <input required name="date" type="date" defaultValue={editingActivity?.date || selectedDate || ''} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Giờ</label>
              <input required name="time" type="time" defaultValue={normalizeTimeForInput(editingActivity?.time || '')} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Tên hoạt động</label>
            <input required name="title" type="text" defaultValue={editingActivity?.title || ''} placeholder="VD: Ăn trưa tại nhà hàng..." className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Địa điểm</label>
            <input required name="location" type="text" defaultValue={editingActivity?.location || ''} placeholder="VD: 123 Đường ABC..." className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Link Google Maps (Tuỳ chọn)</label>
            <input name="mapUrl" type="url" defaultValue={editingActivity?.mapUrl || ''} placeholder="https://maps.google.com/..." className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm" />
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Loại hoạt động</label>
            <select required name="type" defaultValue={editingActivity?.type || 'activity'} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
              <option value="activity">Hoạt động chung</option>
              <option value="flight">Chuyến bay / Di chuyển</option>
              <option value="hotel">Khách sạn / Lưu trú</option>
              <option value="restaurant">Ăn uống</option>
            </select>
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Ghi chú</label>
            <textarea name="note" rows={3} defaultValue={editingActivity?.note || ''} placeholder="Ghi chú thêm..." className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"></textarea>
          </div>
          <div className="pt-4">
            <button type="submit" className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold hover:opacity-90 transition-opacity">
              {editingActivity ? "Lưu thay đổi" : "Thêm hoạt động"}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
