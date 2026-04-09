import { useParams } from 'react-router-dom';
import type { FormEvent } from 'react';
import { Layout } from '../components/Layout';
import { Icons } from '../components/Icons';
import { useAppContext } from '../context/AppContext';
import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { Member } from '../context/AppContext';
import { formatLocalDate } from '../utils/date';

const CUTE_AVATARS = [
  'https://api.dicebear.com/7.x/notionists/svg?seed=Mimi',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Coco',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Lola',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Buster',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Garfield',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Felix',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Salem',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Oreo',
];

export function TripMembers() {
  const { id } = useParams();
  const { trips, setCurrentTripId, addMemberToTrip } = useAppContext();
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(CUTE_AVATARS[0]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const handleAddMember = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addMemberToTrip(id!, {
      name: formData.get('name') as string,
      role: formData.get('role') as string,
      avatar: selectedAvatar,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      birthdate: formData.get('birthdate') as string,
    });
    setIsAddMemberOpen(false);
  };
  
  useEffect(() => {
    if (id) setCurrentTripId(id);
  }, [id, setCurrentTripId]);

  const trip = trips.find(t => t.id === id);
  if (!trip) return <Layout><div>Trip not found</div></Layout>;

  return (
    <Layout tripId={trip.id}>
      <section className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="font-label text-xs uppercase tracking-[0.2em] text-secondary font-bold mb-2 block">Thành viên chuyến đi</span>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-primary font-headline">{trip.title}</h1>
          </div>
          <button onClick={() => setIsAddMemberOpen(true)} className="bg-primary text-on-primary px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-all flex items-center gap-2 editorial-shadow">
            <Icons.UserPlus className="w-5 h-5" />
            Mời thành viên
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {trip.members.map((member) => (
          <div key={member.id} onClick={() => setSelectedMember(member)} className="bg-surface-container-lowest p-6 rounded-xl editorial-shadow flex items-center gap-4 group hover:translate-y-[-4px] transition-all duration-300 cursor-pointer">
            <img alt={member.name} className="w-16 h-16 rounded-full object-cover border-2 border-primary/10 bg-surface-container" src={member.avatar} />
            <div>
              <h3 className="font-headline font-bold text-xl text-on-surface group-hover:text-primary transition-colors">{member.name}</h3>
              <p className="font-label text-xs text-on-surface-variant uppercase tracking-wider font-bold mt-1">{member.role}</p>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={!!selectedMember} onClose={() => setSelectedMember(null)} title="Thông tin thành viên">
        {selectedMember && (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              <img alt={selectedMember.name} className="w-32 h-32 rounded-full object-cover border-4 border-primary/20 bg-surface-container" src={selectedMember.avatar} />
              <div className="text-center">
                <h3 className="font-headline font-bold text-3xl text-on-surface">{selectedMember.name}</h3>
                <p className="font-label text-sm text-primary uppercase tracking-wider font-bold mt-1">{selectedMember.role}</p>
              </div>
            </div>
            <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
              {selectedMember.phone && (
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Icons.Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-label text-xs font-bold text-secondary">Số điện thoại</p>
                    <p className="font-body font-medium">{selectedMember.phone}</p>
                  </div>
                </div>
              )}
              {selectedMember.email && (
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Icons.Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-label text-xs font-bold text-secondary">Email</p>
                    <p className="font-body font-medium">{selectedMember.email}</p>
                  </div>
                </div>
              )}
              {selectedMember.birthdate && (
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Icons.Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-label text-xs font-bold text-secondary">Ngày sinh</p>
                    <p className="font-body font-medium">{formatLocalDate(selectedMember.birthdate, { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isAddMemberOpen} onClose={() => setIsAddMemberOpen(false)} title="Thêm thành viên mới">
        <form onSubmit={handleAddMember} className="space-y-4">
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-2">Chọn Avatar</label>
            <div className="grid grid-cols-4 gap-2">
              {CUTE_AVATARS.map((avatar, idx) => (
                <img 
                  key={idx} 
                  src={avatar} 
                  alt={`Avatar ${idx}`} 
                  className={`w-14 h-14 rounded-full cursor-pointer border-2 transition-all ${selectedAvatar === avatar ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-transparent hover:border-primary/50'}`}
                  onClick={() => setSelectedAvatar(avatar)}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Tên thành viên</label>
            <input required name="name" type="text" placeholder="VD: Nguyễn Văn A" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Vai trò</label>
            <input required name="role" type="text" defaultValue="Thành viên" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Số điện thoại</label>
              <input name="phone" type="tel" placeholder="VD: 0901234567" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Ngày sinh</label>
              <input name="birthdate" type="date" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Email</label>
            <input name="email" type="email" placeholder="VD: email@example.com" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div className="pt-4">
            <button type="submit" className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold hover:opacity-90 transition-opacity">
              Thêm thành viên
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
