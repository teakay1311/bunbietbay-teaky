import { useParams } from 'react-router-dom';
import type { FormEvent } from 'react';
import { Layout } from '../components/Layout';
import { Icons } from '../components/Icons';
import { useAppContext, SavedPlace } from '../context/AppContext';
import { useState } from 'react';
import { Modal } from '../components/Modal';

export function TripPlaces() {
  const { id } = useParams();
  const { trips, savedPlaces, addSavedPlace, deleteSavedPlace } = useAppContext();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const trip = trips.find(t => t.id === id);
  const places = savedPlaces.filter(p => p.tripId === id);

  if (!trip) return <Layout><div>Trip not found</div></Layout>;

  const handleAddPlace = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addSavedPlace({
      tripId: trip.id,
      name: formData.get('name') as string,
      type: formData.get('type') as any,
      phone: formData.get('phone') as string,
      address: formData.get('address') as string,
      rating: Number(formData.get('rating')),
      note: formData.get('note') as string,
    });
    setIsAddOpen(false);
  };

  return (
    <Layout tripId={trip.id}>
      <div className="flex justify-between items-end mb-8">
        <div>
          <p className="font-label text-xs uppercase tracking-[0.2em] text-secondary font-bold mb-2">Lưu trữ thông tin</p>
          <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary">Địa điểm & Liên hệ</h1>
        </div>
        <button onClick={() => setIsAddOpen(true)} className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-opacity">
          <Icons.Plus className="w-5 h-5" />
          Thêm địa điểm
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {places.map(place => (
          <div key={place.id} className="bg-surface-container-lowest p-6 rounded-2xl editorial-shadow group relative">
            <button onClick={() => deleteSavedPlace(place.id)} className="absolute top-4 right-4 p-2 text-secondary hover:text-error hover:bg-error-container rounded-lg transition-colors opacity-0 group-hover:opacity-100">
              <Icons.Trash2 className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary-container text-primary flex items-center justify-center">
                {place.type === 'hotel' && <Icons.Hotel className="w-6 h-6" />}
                {place.type === 'restaurant' && <Icons.Utensils className="w-6 h-6" />}
                {place.type === 'other' && <Icons.MapPin className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="font-headline font-bold text-xl text-on-surface">{place.name}</h3>
                <div className="flex items-center gap-1 text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Icons.Star key={i} className={`w-3 h-3 ${i < (place.rating || 0) ? 'fill-current' : 'text-outline-variant'}`} />
                  ))}
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              {place.phone && (
                <div className="flex items-center gap-3 text-secondary">
                  <Icons.Phone className="w-4 h-4" />
                  <span className="font-body text-sm">{place.phone}</span>
                </div>
              )}
              {place.address && (
                <div className="flex items-start gap-3 text-secondary">
                  <Icons.MapPin className="w-4 h-4 mt-0.5" />
                  <span className="font-body text-sm">{place.address}</span>
                </div>
              )}
              {place.note && (
                <div className="mt-4 p-3 bg-surface-container-low rounded-xl">
                  <p className="text-sm italic text-on-surface-variant">"{place.note}"</p>
                </div>
              )}
            </div>
          </div>
        ))}
        {places.length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-outline-variant rounded-2xl">
            <Icons.Bookmark className="w-12 h-12 mx-auto text-secondary mb-4 opacity-50" />
            <p className="text-secondary font-medium">Chưa có địa điểm nào được lưu.</p>
          </div>
        )}
      </div>

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Thêm địa điểm lưu trữ">
        <form onSubmit={handleAddPlace} className="space-y-4">
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Tên địa điểm</label>
            <input required name="name" type="text" placeholder="VD: Khách sạn ABC..." className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Loại</label>
              <select required name="type" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
                <option value="hotel">Khách sạn / Lưu trú</option>
                <option value="restaurant">Nhà hàng / Quán ăn</option>
                <option value="other">Khác</option>
              </select>
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Đánh giá (1-5)</label>
              <input name="rating" type="number" min="1" max="5" defaultValue="5" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Số điện thoại</label>
            <input name="phone" type="tel" placeholder="VD: 0901234567" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Địa chỉ / Link Google Maps</label>
            <input name="address" type="text" placeholder="Nhập địa chỉ hoặc dán link Maps..." className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Ghi chú</label>
            <textarea name="note" rows={3} placeholder="Ghi chú thêm (VD: pass wifi, giờ check-in)..." className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"></textarea>
          </div>
          <div className="pt-4">
            <button type="submit" className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold hover:opacity-90 transition-opacity">
              Lưu địa điểm
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
