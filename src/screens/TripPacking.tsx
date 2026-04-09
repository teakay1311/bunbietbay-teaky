import { useParams } from 'react-router-dom';
import type { FormEvent } from 'react';
import { Layout } from '../components/Layout';
import { Icons } from '../components/Icons';
import { useAppContext, PackingItem } from '../context/AppContext';
import { useState } from 'react';
import { Modal } from '../components/Modal';

export function TripPacking() {
  const { id } = useParams();
  const { trips, packingItems, addPackingItem, togglePackingItem, deletePackingItem } = useAppContext();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const trip = trips.find(t => t.id === id);
  const items = packingItems.filter(p => p.tripId === id);

  if (!trip) return <Layout><div>Trip not found</div></Layout>;

  const handleAddItem = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addPackingItem({
      tripId: trip.id,
      name: formData.get('name') as string,
      category: formData.get('category') as any,
      assigneeId: formData.get('assigneeId') as string || undefined,
      isPacked: false,
    });
    setIsAddOpen(false);
  };

  const categories = [
    { id: 'clothes', label: 'Quần áo', icon: Icons.Shirt },
    { id: 'toiletries', label: 'Đồ cá nhân', icon: Icons.Droplets },
    { id: 'electronics', label: 'Đồ điện tử', icon: Icons.Laptop },
    { id: 'documents', label: 'Giấy tờ', icon: Icons.FileText },
    { id: 'other', label: 'Khác', icon: Icons.Package },
  ];

  return (
    <Layout tripId={trip.id}>
      <div className="flex justify-between items-end mb-8">
        <div>
          <p className="font-label text-xs uppercase tracking-[0.2em] text-secondary font-bold mb-2">Chuẩn bị</p>
          <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary">Hành lý & Đồ đạc</h1>
        </div>
        <button onClick={() => setIsAddOpen(true)} className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-opacity">
          <Icons.Plus className="w-5 h-5" />
          Thêm đồ
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map(cat => {
          const catItems = items.filter(i => i.category === cat.id);
          if (catItems.length === 0) return null;
          
          const packedCount = catItems.filter(i => i.isPacked).length;
          const progress = (packedCount / catItems.length) * 100;

          return (
            <div key={cat.id} className="bg-surface-container-lowest p-6 rounded-2xl editorial-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary-container text-primary flex items-center justify-center">
                  <cat.icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-headline font-bold text-lg text-on-surface">{cat.label}</h3>
                  <p className="text-xs text-secondary font-medium">{packedCount}/{catItems.length} đã chuẩn bị</p>
                </div>
              </div>
              
              <div className="h-1.5 w-full bg-surface-variant rounded-full overflow-hidden mb-4">
                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }}></div>
              </div>

              <div className="space-y-2">
                {catItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between group">
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      <input 
                        type="checkbox" 
                        checked={item.isPacked} 
                        onChange={() => togglePackingItem(item.id)}
                        className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary transition-all cursor-pointer"
                      />
                      <span className={`font-body text-sm transition-all ${item.isPacked ? 'line-through text-outline' : 'text-on-surface'}`}>
                        {item.name}
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      {item.assigneeId && (
                        <img 
                          src={trip.members.find(m => m.id === item.assigneeId)?.avatar} 
                          alt="Assignee" 
                          className="w-6 h-6 rounded-full border border-surface"
                          title={trip.members.find(m => m.id === item.assigneeId)?.name}
                        />
                      )}
                      <button onClick={() => deletePackingItem(item.id)} className="p-1.5 text-secondary hover:text-error hover:bg-error-container rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                        <Icons.Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-outline-variant rounded-2xl">
            <Icons.Package className="w-12 h-12 mx-auto text-secondary mb-4 opacity-50" />
            <p className="text-secondary font-medium">Chưa có đồ đạc nào cần chuẩn bị.</p>
          </div>
        )}
      </div>

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Thêm đồ cần chuẩn bị">
        <form onSubmit={handleAddItem} className="space-y-4">
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Tên đồ đạc</label>
            <input required name="name" type="text" placeholder="VD: Áo khoác, Hộ chiếu..." className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Danh mục</label>
            <select required name="category" defaultValue="clothes" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Người phụ trách (Tuỳ chọn)</label>
            <select name="assigneeId" defaultValue="" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
              <option value="">Không phân công</option>
              {trip.members.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="pt-4">
            <button type="submit" className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold hover:opacity-90 transition-opacity">
              Thêm đồ
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
