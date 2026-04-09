import { useParams } from 'react-router-dom';
import type { FormEvent } from 'react';
import { Layout } from '../components/Layout';
import { Icons } from '../components/Icons';
import { useAppContext, CURRENCIES, CalculatedMember } from '../context/AppContext';
import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { formatLocalDate, getLocalDateString, getLocalDateStringWithOffset } from '../utils/date';

export function TripOverview() {
  const { id } = useParams();
  const { trips, setCurrentTripId, addMemberToTrip, editMember, addExpense, activities, updateTripReview } = useAppContext();
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<CalculatedMember | null>(null);
  const [isMemberInfoOpen, setIsMemberInfoOpen] = useState(false);
  const [isEditMemberOpen, setIsEditMemberOpen] = useState(false);

  const handleAddMember = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addMemberToTrip(id!, {
      name: formData.get('name') as string,
      role: formData.get('role') as string,
      avatar: formData.get('avatar') as string || `https://api.dicebear.com/7.x/notionists/svg?seed=${formData.get('name')}`,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      birthdate: formData.get('birthdate') as string,
    });
    setIsAddMemberOpen(false);
  };

  const handleEditMember = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedMember) return;
    const formData = new FormData(e.currentTarget);
    editMember(selectedMember.id, {
      name: formData.get('name') as string,
      role: formData.get('role') as string,
      avatar: formData.get('avatar') as string || selectedMember.avatar,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      birthdate: formData.get('birthdate') as string,
    });
    setIsEditMemberOpen(false);
    setIsMemberInfoOpen(false);
  };
  
  useEffect(() => {
    if (id) setCurrentTripId(id);
  }, [id, setCurrentTripId]);

  const trip = trips.find(t => t.id === id);
  if (!trip) return <Layout><div>Trip not found</div></Layout>;

  const remaining = trip.budget - trip.spent;
  const spentPercentage = Math.min((trip.spent / trip.budget) * 100, 100);
  const baseCurrencySymbol = CURRENCIES[trip.baseCurrency || 'VND'].symbol;

  // Calculate debts
  const debtors = trip.members.filter(m => m.balance < -1).map(m => ({ ...m, amount: Math.abs(m.balance) })).sort((a, b) => b.amount - a.amount);
  const creditors = trip.members.filter(m => m.balance > 1).map(m => ({ ...m, amount: m.balance })).sort((a, b) => b.amount - a.amount);

  const transactions = [];
  let d = 0, c = 0;
  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];
    const amount = Math.min(debtor.amount, creditor.amount);

    transactions.push({ debtor, creditor, amount, id: `${debtor.id}-${creditor.id}-${amount}` });

    debtors[d].amount -= amount;
    creditors[c].amount -= amount;

    if (debtors[d].amount < 1) d++;
    if (creditors[c].amount < 1) c++;
  }

  const handleSettleDebt = (debtorId: string, creditorId: string, amount: number, creditorName: string) => {
    addExpense({
      tripId: trip.id,
      date: getLocalDateString(),
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      title: `Thanh toán nợ cho ${creditorName}`,
      category: 'Khác',
      amount: amount,
      originalAmount: amount,
      currency: trip.baseCurrency || 'VND',
      exchangeRate: 1,
      paidBy: debtorId,
      participants: [creditorId],
      note: 'Chuyển khoản thanh toán',
      isSettlement: true,
    });
  };

  const budgetWarning = spentPercentage >= 100 ? 'Vượt ngân sách!' : spentPercentage >= 90 ? 'Sắp hết ngân sách!' : null;

  // Upcoming activities (today or tomorrow)
  const today = getLocalDateString();
  const tomorrow = getLocalDateStringWithOffset(1);
  const upcomingActivities = activities.filter(a => a.tripId === trip.id && (a.date === today || a.date === tomorrow));

  const handleReviewSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updateTripReview(trip.id, {
      transport: Number(formData.get('transport')),
      accommodation: Number(formData.get('accommodation')),
      food: Number(formData.get('food')),
      entertainment: Number(formData.get('entertainment')),
      memory: formData.get('memory') as string,
    });
    setIsReviewOpen(false);
  };

  return (
    <Layout tripId={trip.id}>
      <div className="flex flex-col gap-2 mb-6">
        {budgetWarning && (
          <div className="bg-error text-on-error px-4 py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 animate-in slide-in-from-top-4 shadow-lg">
            <Icons.AlertTriangle className="w-5 h-5" />
            {budgetWarning} Bạn đã chi tiêu {spentPercentage.toFixed(1)}% ngân sách.
          </div>
        )}
        {upcomingActivities.length > 0 && (
          <div className="bg-primary text-on-primary px-4 py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 animate-in slide-in-from-top-4 shadow-lg">
            <Icons.Calendar className="w-5 h-5" />
            Bạn có {upcomingActivities.length} hoạt động sắp diễn ra trong hôm nay/ngày mai!
          </div>
        )}
      </div>
      <div className="relative mb-12 flex flex-col md:flex-row items-end gap-6">
        <div className="w-full md:w-2/3">
          <p className="font-label text-xs uppercase tracking-[0.2em] text-secondary font-bold mb-2">Chi tiết chuyến đi</p>
          <h1 className="font-headline text-5xl font-extrabold tracking-tighter text-primary">{trip.title}</h1>
          <p className="text-on-surface-variant mt-4 max-w-md leading-relaxed flex items-center gap-2">
            <Icons.MapPin className="w-4 h-4" />
            {trip.location}
          </p>
        </div>
        <div className="w-full md:w-1/3 bg-surface-container-lowest p-6 rounded-xl shadow-[0_12px_24px_rgba(0,0,0,0.06)]">
          <p className="font-label text-[10px] uppercase tracking-widest font-bold text-secondary mb-1">Tổng ngân sách</p>
          <p className="font-headline text-3xl font-bold text-primary">{trip.budget.toLocaleString('vi-VN')}{baseCurrencySymbol}</p>
          <div className="mt-4 w-full h-1 bg-surface-variant rounded-full overflow-hidden">
            <div className="h-full bg-tertiary rounded-full shadow-inner" style={{ width: `${spentPercentage}%` }}></div>
          </div>
          <p className="font-label text-[10px] mt-2 text-on-surface-variant">Còn lại: {remaining.toLocaleString('vi-VN')}{baseCurrencySymbol}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-7 space-y-6">
          {trip.review && (
            <div className="bg-surface-container-lowest p-6 md:p-8 rounded-2xl editorial-shadow relative overflow-hidden mb-8">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10"></div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="font-headline text-2xl font-bold text-primary flex items-center gap-2">
                    <Icons.Star className="w-6 h-6 fill-current" />
                    Đánh giá chuyến đi
                  </h2>
                  <p className="text-secondary text-sm mt-1">Cảm nhận và kỷ niệm của bạn về hành trình này.</p>
                </div>
                <button onClick={() => setIsReviewOpen(true)} className="p-2 text-secondary hover:text-primary hover:bg-primary-container rounded-lg transition-colors">
                  <Icons.Edit2 className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Di chuyển', score: trip.review.transport, icon: Icons.Plane },
                  { label: 'Nơi ở', score: trip.review.accommodation, icon: Icons.Hotel },
                  { label: 'Ăn uống', score: trip.review.food, icon: Icons.Utensils },
                  { label: 'Vui chơi', score: trip.review.entertainment, icon: Icons.Ticket },
                ].map(item => (
                  <div key={item.label} className="bg-surface-container-low p-4 rounded-xl text-center">
                    <item.icon className="w-6 h-6 mx-auto text-secondary mb-2" />
                    <p className="font-label text-[10px] uppercase font-bold text-secondary mb-1">{item.label}</p>
                    <div className="flex justify-center gap-1 text-amber-500">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Icons.Star key={i} className={`w-3 h-3 ${i < item.score ? 'fill-current' : 'text-outline-variant'}`} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {trip.review.memory && (
                <div className="bg-primary-container/30 p-6 rounded-xl border-l-4 border-primary">
                  <p className="italic text-on-surface-variant leading-relaxed">"{trip.review.memory}"</p>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <h2 className="font-headline text-xl font-bold text-on-surface">Thành viên ({trip.members.length})</h2>
            <button onClick={() => setIsAddMemberOpen(true)} className="flex items-center gap-2 text-primary font-label text-xs font-bold uppercase tracking-wider hover:bg-primary/10 px-3 py-2 rounded-lg transition-colors">
              <Icons.UserPlus className="w-4 h-4" /> Thêm mới
            </button>
          </div>
          
          <div className="space-y-4">
            {trip.members.map((member) => (
              <div 
                key={member.id} 
                onClick={() => { setSelectedMember(member); setIsMemberInfoOpen(true); }}
                className={`bg-surface-container-lowest p-6 rounded-xl flex items-center justify-between group hover:bg-white transition-colors duration-300 cursor-pointer ${member.balance < 0 ? 'border-l-4 border-error/20' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <img alt={member.name} className="w-12 h-12 rounded-full object-cover" src={member.avatar} />
                  <div>
                    <h3 className="font-headline font-bold text-on-surface group-hover:text-primary transition-colors">{member.name}</h3>
                    <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-tighter font-bold">{member.role}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-label text-[10px] text-secondary uppercase font-bold mb-1">Đã chi</p>
                  <p className="font-headline font-bold text-on-surface">{member.spent.toLocaleString('vi-VN')}{baseCurrencySymbol}</p>
                  <span className={`text-[11px] font-medium ${member.balance >= 0 ? 'text-tertiary' : 'text-error'}`}>
                    {member.balance >= 0 ? '+' : '-'} {Math.abs(member.balance).toLocaleString('vi-VN')}{baseCurrencySymbol}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="lg:col-span-5 space-y-6">
          <div className="sticky top-24">
            <div className="bg-primary text-on-primary p-8 rounded-3xl overflow-hidden relative shadow-2xl">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary-container opacity-20 rounded-full blur-2xl"></div>
              <h2 className="font-headline text-2xl font-bold mb-6">Ai trả ai?</h2>
              
              <div className="space-y-6">
                {transactions.length > 0 ? transactions.map((t) => (
                  <div key={t.id} className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl backdrop-blur-md">
                    <div className="flex -space-x-3">
                      <img alt={t.debtor.name} className="w-8 h-8 rounded-full border-2 border-primary bg-white" src={t.debtor.avatar} />
                      <Icons.ArrowRight className="w-5 h-5 text-white/50 pt-1" />
                      <img alt={t.creditor.name} className="w-8 h-8 rounded-full border-2 border-primary bg-white" src={t.creditor.avatar} />
                    </div>
                    <div className="flex-1">
                      <p className="font-body text-sm"><span className="font-bold">{t.debtor.name}</span> trả <span className="font-bold">{t.creditor.name}</span></p>
                      <p className="font-label text-lg font-bold">{t.amount.toLocaleString('vi-VN')}{baseCurrencySymbol}</p>
                    </div>
                    <button 
                      onClick={() => handleSettleDebt(t.debtor.id, t.creditor.id, t.amount, t.creditor.name)}
                      className="bg-white text-primary px-3 py-1.5 rounded-lg font-label text-[10px] font-extrabold uppercase hover:bg-surface-container transition-colors active:scale-95"
                    >
                      Trả ngay
                    </button>
                  </div>
                )) : (
                  <div className="text-center py-8 text-white/80 italic">
                    Tuyệt vời! Không ai nợ ai cả.
                  </div>
                )}
              </div>

              <div className="mt-10">
                <button 
                  onClick={() => setIsReviewOpen(true)}
                  className="w-full bg-secondary-container text-on-secondary-container py-4 rounded-xl font-headline font-bold text-sm tracking-wide mb-3"
                >
                  {trip.review ? 'Sửa đánh giá chuyến đi' : 'Đánh giá chuyến đi'}
                </button>
                <button disabled title="Tính năng này chưa được hỗ trợ" className="w-full bg-primary text-on-primary py-4 rounded-xl font-headline font-bold text-sm tracking-wide disabled:cursor-not-allowed disabled:opacity-60">
                  Chốt quyết toán chuyến đi
                </button>
              </div>
            </div>

            <div className="mt-6 p-6 bg-surface-container-low rounded-2xl">
              <div className="flex items-center gap-3 mb-3">
                <Icons.LineChart className="w-5 h-5 text-primary" />
                <span className="font-label text-[10px] uppercase font-bold text-secondary">Phân tích chi tiêu</span>
              </div>
              <p className="text-sm leading-relaxed text-on-surface-variant italic">"Chi phí lớn nhất tập trung vào **Di chuyển (45%)** và **Lưu trú (30%)**. An và Tú hiện đang âm ngân sách nhiều nhất do chưa thanh toán các khoản chung."</p>
            </div>
          </div>
        </aside>
      </div>

      <Modal isOpen={isAddMemberOpen} onClose={() => setIsAddMemberOpen(false)} title="Thêm thành viên mới">
        <form onSubmit={handleAddMember} className="space-y-4">
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Tên thành viên</label>
            <input required name="name" type="text" placeholder="VD: Nguyễn Văn A" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Vai trò</label>
            <input required name="role" type="text" defaultValue="Thành viên" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Avatar URL (Tuỳ chọn)</label>
            <input name="avatar" type="url" placeholder="https://..." className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            <p className="text-[10px] text-secondary mt-1">Để trống để dùng avatar mặc định.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Số điện thoại</label>
              <input name="phone" type="tel" placeholder="09..." className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Ngày sinh</label>
              <input name="birthdate" type="date" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Email</label>
            <input name="email" type="email" placeholder="email@example.com" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div className="pt-4">
            <button type="submit" className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold hover:opacity-90 transition-opacity">
              Thêm thành viên
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isMemberInfoOpen} onClose={() => setIsMemberInfoOpen(false)} title="Thông tin thành viên">
        {selectedMember && (
          <div className="space-y-6">
            <div className="flex items-center gap-6">
              <img src={selectedMember.avatar} alt={selectedMember.name} className="w-24 h-24 rounded-full object-cover border-4 border-surface-container-high" />
              <div>
                <h3 className="font-headline text-2xl font-bold text-primary">{selectedMember.name}</h3>
                <p className="font-label text-xs uppercase tracking-widest text-secondary font-bold">{selectedMember.role}</p>
              </div>
            </div>
            
            <div className="bg-surface-container-lowest p-6 rounded-xl space-y-4">
              <div className="flex items-center gap-3">
                <Icons.Phone className="w-5 h-5 text-secondary" />
                <span className="font-body text-on-surface">{selectedMember.phone || 'Chưa cập nhật'}</span>
              </div>
              <div className="flex items-center gap-3">
                <Icons.Mail className="w-5 h-5 text-secondary" />
                <span className="font-body text-on-surface">{selectedMember.email || 'Chưa cập nhật'}</span>
              </div>
              <div className="flex items-center gap-3">
                <Icons.Calendar className="w-5 h-5 text-secondary" />
                <span className="font-body text-on-surface">{selectedMember.birthdate ? formatLocalDate(selectedMember.birthdate, { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chưa cập nhật'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-container-low p-4 rounded-xl text-center">
                <p className="font-label text-[10px] uppercase font-bold text-secondary mb-1">Đã chi tiêu</p>
                <p className="font-headline text-xl font-bold text-primary">{selectedMember.spent.toLocaleString('vi-VN')}{baseCurrencySymbol}</p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-xl text-center">
                <p className="font-label text-[10px] uppercase font-bold text-secondary mb-1">Số dư</p>
                <p className={`font-headline text-xl font-bold ${selectedMember.balance >= 0 ? 'text-tertiary' : 'text-error'}`}>
                  {selectedMember.balance >= 0 ? '+' : '-'}{Math.abs(selectedMember.balance).toLocaleString('vi-VN')}{baseCurrencySymbol}
                </p>
              </div>
            </div>

            <div className="pt-4 flex gap-4">
              <button onClick={() => { setIsMemberInfoOpen(false); setIsEditMemberOpen(true); }} className="flex-1 bg-primary text-on-primary py-3 rounded-xl font-bold hover:opacity-90 transition-opacity">
                Chỉnh sửa
              </button>
              <button onClick={() => setIsMemberInfoOpen(false)} className="flex-1 bg-surface-container-high text-on-surface py-3 rounded-xl font-bold hover:bg-surface-variant transition-colors">
                Đóng
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isEditMemberOpen} onClose={() => setIsEditMemberOpen(false)} title="Chỉnh sửa thành viên">
        {selectedMember && (
          <form onSubmit={handleEditMember} className="space-y-4">
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Tên thành viên</label>
              <input required name="name" type="text" defaultValue={selectedMember.name} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Vai trò</label>
              <input required name="role" type="text" defaultValue={selectedMember.role} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Avatar URL</label>
              <input name="avatar" type="url" defaultValue={selectedMember.avatar} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-label text-xs font-bold text-secondary mb-1">Số điện thoại</label>
                <input name="phone" type="tel" defaultValue={selectedMember.phone || ''} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
              </div>
              <div>
                <label className="block font-label text-xs font-bold text-secondary mb-1">Ngày sinh</label>
                <input name="birthdate" type="date" defaultValue={selectedMember.birthdate || ''} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
              </div>
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Email</label>
              <input name="email" type="email" defaultValue={selectedMember.email || ''} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div className="pt-4">
              <button type="submit" className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold hover:opacity-90 transition-opacity">
                Lưu thay đổi
              </button>
            </div>
          </form>
        )}
      </Modal>
      <Modal isOpen={isReviewOpen} onClose={() => setIsReviewOpen(false)} title="Đánh giá chuyến đi">
        <form onSubmit={handleReviewSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {[
              { name: 'transport', label: 'Di chuyển' },
              { name: 'accommodation', label: 'Nơi ở' },
              { name: 'food', label: 'Ăn uống' },
              { name: 'entertainment', label: 'Vui chơi' },
            ].map(item => (
              <div key={item.name}>
                <label className="block font-label text-xs font-bold text-secondary mb-1">{item.label} (1-5 sao)</label>
                <input required name={item.name} type="number" min="1" max="5" defaultValue={(trip.review as any)?.[item.name] || 5} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
              </div>
            ))}
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Chia sẻ cảm nhận / Kỷ niệm</label>
            <textarea name="memory" rows={4} defaultValue={trip.review?.memory || ''} placeholder="Kỷ niệm đáng nhớ nhất của bạn là gì?" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"></textarea>
          </div>
          <div className="pt-4">
            <button type="submit" className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold hover:opacity-90 transition-opacity">
              Lưu đánh giá
            </button>
          </div>
        </form>
      </Modal>

    </Layout>
  );
}
