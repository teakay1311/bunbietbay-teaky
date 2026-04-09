import { useParams } from 'react-router-dom';
import type { ChangeEvent, FormEvent } from 'react';
import { Layout } from '../components/Layout';
import { Icons } from '../components/Icons';
import { useAppContext, CURRENCIES, Currency } from '../context/AppContext';
import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { FormattedNumberInput } from '../components/FormattedNumberInput';
import { Expense } from '../context/AppContext';
import { formatLocalDate, getLocalDateString } from '../utils/date';

export function TripExpenses() {
  const { id } = useParams();
  const { trips, expenses, setCurrentTripId, addExpense, deleteExpense, editExpense } = useAppContext();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const trip = trips.find(t => t.id === id);
  const baseCurrency = trip?.baseCurrency || 'VND';
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(baseCurrency);
  const [exchangeRate, setExchangeRate] = useState<number>(1);

  useEffect(() => {
    if (isAddOpen) {
      if (editingExpense) {
        setSelectedCurrency(editingExpense.currency || baseCurrency);
        setExchangeRate(editingExpense.exchangeRate || 1);
      } else {
        setSelectedCurrency(baseCurrency);
        setExchangeRate(1);
      }
    }
  }, [isAddOpen, editingExpense, baseCurrency]);

  const handleCurrencyChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newCurrency = e.target.value as Currency;
    setSelectedCurrency(newCurrency);
    if (newCurrency === baseCurrency) {
      setExchangeRate(1);
    } else {
      // Default rate from CURRENCIES relative to VND. If base is not VND, we'd need cross rates, but let's assume base is usually VND for now, or just use the default rate.
      // A better way: rate = CURRENCIES[newCurrency].defaultRateToVND / CURRENCIES[baseCurrency].defaultRateToVND
      const rate = CURRENCIES[newCurrency].defaultRateToVND / CURRENCIES[baseCurrency].defaultRateToVND;
      setExchangeRate(rate);
    }
  };

  const handleAddExpense = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const participants = formData.getAll('participants') as string[];
    const originalAmount = Number(formData.get('originalAmount'));
    const rate = selectedCurrency === baseCurrency ? 1 : Number(formData.get('exchangeRate'));
    const amount = originalAmount * rate;
    
    if (editingExpense) {
      editExpense(editingExpense.id, {
        date: formData.get('date') as string,
        title: formData.get('title') as string,
        category: formData.get('category') as string,
        amount: amount,
        originalAmount: originalAmount,
        currency: selectedCurrency,
        exchangeRate: rate,
        paidBy: formData.get('paidBy') as string,
        participants: participants.length > 0 ? participants : trip!.members.map(m => m.id),
        note: formData.get('note') as string,
        receiptImage: formData.get('receiptImage') as string,
      });
      setEditingExpense(null);
    } else {
      addExpense({
        tripId: id!,
        date: formData.get('date') as string,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        title: formData.get('title') as string,
        category: formData.get('category') as string,
        amount: amount,
        originalAmount: originalAmount,
        currency: selectedCurrency,
        exchangeRate: rate,
        paidBy: formData.get('paidBy') as string,
        participants: participants.length > 0 ? participants : trip!.members.map(m => m.id),
        note: formData.get('note') as string,
        receiptImage: formData.get('receiptImage') as string,
      });
    }
    setIsAddOpen(false);
  };
  
  useEffect(() => {
    if (id) setCurrentTripId(id);
  }, [id, setCurrentTripId]);

  if (!trip) return <Layout><div>Trip not found</div></Layout>;

  const baseCurrencySymbol = CURRENCIES[trip.baseCurrency || 'VND'].symbol;
  const remaining = trip.budget - trip.spent;
  const spentPercentage = Math.min((trip.spent / trip.budget) * 100, 100);
  const avgPerPerson = trip.budget / trip.members.length;

  const tripExpenses = expenses.filter(e => e.tripId === trip.id && !e.isSettlement);
  const filteredExpenses = tripExpenses.filter(expense => {
    const query = searchQuery.toLowerCase();
    return expense.title.toLowerCase().includes(query) || 
           expense.category.toLowerCase().includes(query) || 
           (expense.note && expense.note.toLowerCase().includes(query));
  });

  return (
    <Layout tripId={trip.id}>
      <section className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="font-label text-xs uppercase tracking-[0.2em] text-secondary font-bold mb-2 block">Chuyến đi hiện tại</span>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-primary font-headline">{trip.title}</h1>
            <p className="text-on-surface-variant mt-2 flex items-center gap-2">
              <Icons.CalendarDays className="w-4 h-4" />
              {formatLocalDate(trip.startDate, { day: '2-digit', month: 'short' })} — {formatLocalDate(trip.endDate, { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div className="flex gap-3">
            <button disabled title="Tính năng này chưa được hỗ trợ" className="bg-surface-container-high text-on-surface px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50">
              <Icons.Receipt className="w-5 h-5" />
              Xuất báo cáo
            </button>
            <button onClick={() => { setEditingExpense(null); setIsAddOpen(true); }} className="bg-primary text-on-primary px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-all flex items-center gap-2 editorial-shadow">
              <Icons.Plus className="w-5 h-5" />
              Thêm chi tiêu
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-12">
        <div className="bg-surface-container-lowest p-6 rounded-xl editorial-shadow relative overflow-hidden group">
          <div className="relative z-10">
            <h3 className="font-label text-[10px] uppercase tracking-widest font-bold text-secondary mb-2 md:mb-4">Tổng Ngân Sách</h3>
            <div className="text-2xl md:text-3xl font-extrabold text-primary font-headline tracking-tight truncate" title={`${trip.budget.toLocaleString('vi-VN')}${baseCurrencySymbol}`}>{trip.budget.toLocaleString('vi-VN')}{baseCurrencySymbol}</div>
            <p className="text-xs text-on-surface-variant mt-2">Dự kiến cho {trip.members.length} người</p>
          </div>
          <Icons.Wallet className="absolute -bottom-4 -right-4 w-20 h-20 md:w-24 md:h-24 text-primary/5 rotate-12 group-hover:scale-110 transition-transform" />
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl editorial-shadow relative overflow-hidden group">
          <div className="relative z-10">
            <h3 className="font-label text-[10px] uppercase tracking-widest font-bold text-secondary mb-2 md:mb-4">Đã Chi Tiêu</h3>
            <div className="text-2xl md:text-3xl font-extrabold text-tertiary font-headline tracking-tight truncate" title={`${trip.spent.toLocaleString('vi-VN')}${baseCurrencySymbol}`}>{trip.spent.toLocaleString('vi-VN')}{baseCurrencySymbol}</div>
            <div className="mt-4 h-1.5 w-full bg-surface-variant rounded-full overflow-hidden">
              <div className="h-full bg-tertiary" style={{ width: `${spentPercentage}%` }}></div>
            </div>
          </div>
          <Icons.Banknote className="absolute -bottom-4 -right-4 w-20 h-20 md:w-24 md:h-24 text-tertiary/5 rotate-12 group-hover:scale-110 transition-transform" />
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl editorial-shadow relative overflow-hidden group">
          <div className="relative z-10">
            <h3 className="font-label text-[10px] uppercase tracking-widest font-bold text-secondary mb-2 md:mb-4">Còn Lại</h3>
            <div className="text-2xl md:text-3xl font-extrabold text-primary-container font-headline tracking-tight truncate" title={`${remaining.toLocaleString('vi-VN')}${baseCurrencySymbol}`}>{remaining.toLocaleString('vi-VN')}{baseCurrencySymbol}</div>
            <p className="text-xs text-on-surface-variant mt-2">{((remaining / trip.budget) * 100).toFixed(1)}% ngân sách</p>
          </div>
          <Icons.PiggyBank className="absolute -bottom-4 -right-4 w-20 h-20 md:w-24 md:h-24 text-primary-container/5 rotate-12 group-hover:scale-110 transition-transform" />
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl editorial-shadow relative overflow-hidden group">
          <div className="relative z-10">
            <h3 className="font-label text-[10px] uppercase tracking-widest font-bold text-secondary mb-2 md:mb-4">TB mỗi người</h3>
            <div className="text-2xl md:text-3xl font-extrabold text-on-surface font-headline tracking-tight truncate" title={`${avgPerPerson.toLocaleString('vi-VN')}${baseCurrencySymbol}`}>{avgPerPerson.toLocaleString('vi-VN')}{baseCurrencySymbol}</div>
            <p className="text-xs text-on-surface-variant mt-2">Chia cho {trip.members.length} thành viên</p>
          </div>
          <Icons.Users className="absolute -bottom-4 -right-4 w-20 h-20 md:w-24 md:h-24 text-on-surface/5 rotate-12 group-hover:scale-110 transition-transform" />
        </div>
      </section>

      <section className="bg-surface-container-low rounded-3xl p-1 overflow-hidden">
        <div className="bg-surface-container-lowest rounded-[1.4rem] overflow-hidden">
          <div className="p-6 border-b border-surface-variant/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/50 backdrop-blur-sm">
            <h2 className="text-xl font-bold font-headline text-primary">Danh sách Chi tiêu</h2>
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                <input 
                  type="search" 
                  data-search-input="true"
                  placeholder="Tìm kiếm chi tiêu..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                />
              </div>
              <button disabled title="Tính năng này chưa được hỗ trợ" className="p-2 rounded-lg transition-colors text-secondary disabled:cursor-not-allowed disabled:opacity-50">
                <Icons.Filter className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-6 py-4 font-label text-[10px] uppercase tracking-widest font-bold text-secondary">Ngày</th>
                  <th className="px-6 py-4 font-label text-[10px] uppercase tracking-widest font-bold text-secondary">Nội dung</th>
                  <th className="px-6 py-4 font-label text-[10px] uppercase tracking-widest font-bold text-secondary text-right">Số tiền</th>
                  <th className="px-6 py-4 font-label text-[10px] uppercase tracking-widest font-bold text-secondary">Danh mục</th>
                  <th className="px-6 py-4 font-label text-[10px] uppercase tracking-widest font-bold text-secondary">Người chi</th>
                  <th className="px-6 py-4 font-label text-[10px] uppercase tracking-widest font-bold text-secondary">Người tham gia</th>
                  <th className="px-6 py-4 font-label text-[10px] uppercase tracking-widest font-bold text-secondary">Hoá đơn</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant/20">
                {filteredExpenses.map((expense) => {
                  const payer = trip.members.find(m => m.id === expense.paidBy);
                  const getCategoryStyle = (cat: string) => {
                    switch(cat) {
                      case 'Di chuyển': return { bg: 'bg-secondary-container', text: 'text-on-secondary-container', icon: Icons.Plane };
                      case 'Ăn uống': return { bg: 'bg-tertiary-fixed-dim', text: 'text-on-tertiary-fixed-variant', icon: Icons.Utensils };
                      case 'Lưu trú': return { bg: 'bg-primary-fixed', text: 'text-on-primary-fixed-variant', icon: Icons.Hotel };
                      case 'Giải trí': return { bg: 'bg-outline-variant/30', text: 'text-on-surface-variant', icon: Icons.Ticket };
                      default: return { bg: 'bg-surface-variant', text: 'text-on-surface', icon: Icons.Banknote };
                    }
                  };
                  const catStyle = getCategoryStyle(expense.category);
                  const CatIcon = catStyle.icon;

                  return (
                    <tr key={expense.id} className="hover:bg-surface-container-lowest group transition-colors">
                      <td className="px-6 py-5 align-middle">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-on-surface">{formatLocalDate(expense.date, { day: '2-digit', month: 'short' })}</span>
                          <span className="text-[10px] text-secondary">{expense.time}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 align-middle">
                        <div className="font-medium text-on-surface">{expense.title}</div>
                        <div className="text-xs text-secondary italic">{expense.note}</div>
                      </td>
                      <td className="px-6 py-5 align-middle text-right">
                        <div className="font-bold text-primary">
                          {(expense.originalAmount ?? expense.amount).toLocaleString('vi-VN')}
                          {CURRENCIES[expense.currency || baseCurrency].symbol}
                        </div>
                        {expense.currency && expense.currency !== baseCurrency && (
                          <div className="text-[10px] text-secondary">
                            ≈ {expense.amount.toLocaleString('vi-VN')}{baseCurrencySymbol}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5 align-middle">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${catStyle.bg} ${catStyle.text} text-xs font-semibold`}>
                          <CatIcon className="w-3.5 h-3.5" /> {expense.category}
                        </span>
                      </td>
                      <td className="px-6 py-5 align-middle">
                        <div className="flex items-center gap-2">
                          {payer && <img alt={payer.name} className="w-6 h-6 rounded-full" src={payer.avatar} />}
                          <span className="text-sm">{payer?.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 align-middle">
                        <div className="flex -space-x-2">
                          {expense.participants.slice(0, 3).map(pId => {
                            const p = trip.members.find(m => m.id === pId);
                            return p ? <img key={p.id} alt={p.name} className="w-6 h-6 rounded-full border-2 border-white" src={p.avatar} /> : null;
                          })}
                          {expense.participants.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-surface-container-high border-2 border-white flex items-center justify-center text-[8px] font-bold">
                              +{expense.participants.length - 3}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 align-middle">
                        {expense.receiptImage ? (
                          <a href={expense.receiptImage} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-container transition-colors" title="Xem hoá đơn">
                            <Icons.Image className="w-5 h-5" />
                          </a>
                        ) : (
                          <span className="text-secondary/50">-</span>
                        )}
                      </td>
                      <td className="px-6 py-5 align-middle text-right flex justify-end gap-2">
                        <button onClick={() => { setEditingExpense(expense); setIsAddOpen(true); }} className="p-2 text-secondary hover:text-primary hover:bg-primary-container rounded-lg transition-colors">
                          <Icons.Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteExpense(expense.id)} className="p-2 text-secondary hover:text-error hover:bg-error-container rounded-lg transition-colors">
                          <Icons.Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-6 bg-surface-container-low/30 border-t border-surface-variant/20 flex justify-between items-center">
            <span className="text-sm text-secondary">Hiển thị {filteredExpenses.length} trong số {tripExpenses.length} chi tiêu</span>
            <div className="flex gap-2">
              <button className="p-2 w-8 h-8 flex items-center justify-center rounded bg-surface border border-outline-variant/30 text-secondary disabled:opacity-50" disabled>
                <Icons.ChevronLeft className="w-4 h-4" />
              </button>
              <button className="p-2 w-8 h-8 flex items-center justify-center rounded bg-primary text-on-primary font-bold text-xs">1</button>
              <button disabled title="Tính năng này chưa được hỗ trợ" className="p-2 w-8 h-8 flex items-center justify-center rounded bg-surface border border-outline-variant/30 text-secondary disabled:cursor-not-allowed disabled:opacity-50">
                <Icons.ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <Modal isOpen={isAddOpen} onClose={() => { setIsAddOpen(false); setEditingExpense(null); }} title={editingExpense ? "Sửa chi tiêu" : "Thêm chi tiêu"}>
        <form onSubmit={handleAddExpense} className="space-y-4">
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Nội dung chi tiêu</label>
            <input required name="title" type="text" defaultValue={editingExpense?.title || ''} placeholder="VD: Ăn trưa..." className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Số tiền</label>
              <FormattedNumberInput required name="originalAmount" defaultValue={editingExpense?.originalAmount || editingExpense?.amount || ''} placeholder="VD: 500.000" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Tiền tệ</label>
              <select name="currency" value={selectedCurrency} onChange={handleCurrencyChange} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
                {Object.entries(CURRENCIES).map(([code, { name }]) => (
                  <option key={code} value={code}>{code} - {name}</option>
                ))}
              </select>
            </div>
          </div>
          {selectedCurrency !== baseCurrency && (
            <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30">
              <label className="block font-label text-xs font-bold text-secondary mb-1">Tỉ giá (1 {selectedCurrency} = ? {baseCurrency})</label>
              <input required name="exchangeRate" type="number" step="0.0001" value={exchangeRate} onChange={(e) => setExchangeRate(Number(e.target.value))} className="w-full px-4 py-2 rounded-lg bg-surface border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
              <p className="text-[10px] text-secondary mt-1">Tỉ giá tham khảo, bạn có thể điều chỉnh.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Ngày</label>
              <input required name="date" type="date" defaultValue={editingExpense?.date || getLocalDateString()} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Danh mục</label>
              <select required name="category" defaultValue={editingExpense?.category || 'Ăn uống'} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
                <option value="Ăn uống">Ăn uống</option>
                <option value="Di chuyển">Di chuyển</option>
                <option value="Lưu trú">Lưu trú</option>
                <option value="Giải trí">Giải trí</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
          </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Người trả tiền</label>
              <select required name="paidBy" defaultValue={editingExpense?.paidBy || ''} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
                {trip.members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Chia cho ai? (Mặc định: Tất cả)</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {trip.members.map(m => (
                <label key={m.id} className="flex items-center gap-2 bg-surface-container-low px-3 py-2 rounded-lg cursor-pointer hover:bg-surface-container-high transition-colors">
                  <input type="checkbox" name="participants" value={m.id} defaultChecked={editingExpense ? editingExpense.participants.includes(m.id) : true} className="rounded text-primary focus:ring-primary" />
                  <span className="text-sm">{m.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Ghi chú</label>
            <input name="note" type="text" defaultValue={editingExpense?.note || ''} placeholder="Ghi chú thêm..." className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Link Hình ảnh / Hoá đơn</label>
            <input name="receiptImage" type="url" defaultValue={editingExpense?.receiptImage || ''} placeholder="https://..." className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm" />
          </div>
          <div className="pt-4">
            <button type="submit" className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold hover:opacity-90 transition-opacity">
              {editingExpense ? "Lưu thay đổi" : "Thêm chi tiêu"}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
