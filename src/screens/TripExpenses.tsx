import { useParams } from 'react-router-dom';
import type { ChangeEvent, FormEvent } from 'react';

import { Icons } from '../components/Icons';
import { useAppContext, CURRENCIES, Currency } from '../context/AppContext';
import { useFeedback } from '../context/FeedbackContext';
import { useEffect, useState, useMemo, useRef } from 'react';
import { Modal } from '../components/Modal';
import { FormattedNumberInput } from '../components/FormattedNumberInput';
import { CategorySelectWithCreate } from '../components/CategorySelectWithCreate';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Check } from 'lucide-react';
import { Expense } from '../context/AppContext';
import { formatLocalDate, getLocalDateString, normalizeTimeForInput } from '../utils/date';
import { useSettings, useFormatMoney } from '../context/SettingsContext';
import { LinkifyText } from '../components/LinkifyText';
import { getErrorMessage } from '../utils/errorMessage';
import { motion, AnimatePresence } from 'framer-motion';
import { SortSelect } from '../components/SortSelect';
import { chainComparators, compareDate, compareNumber, compareText, stableSort, type SortOption } from '../utils/listSort';
import { EXPENSE_CATEGORY_OPTIONS, mergeCategoryOptions } from '../utils/tripCategories';

const EXPENSE_PRESETS = [
  { icon: '☕', label: 'Cafe', category: 'Ăn uống', title: 'Cafe' },
  { icon: '🍳', label: 'Ăn sáng', category: 'Ăn uống', title: 'Ăn sáng' },
  { icon: '🚕', label: 'Taxi / Grab', category: 'Di chuyển', title: 'Taxi / Grab' },
  { icon: '⛽', label: 'Đổ xăng', category: 'Di chuyển', title: 'Đổ xăng' },
  { icon: '🏨', label: 'Phòng', category: 'Lưu trú', title: 'Tiền phòng' },
  { icon: '🎟️', label: 'Mua vé', category: 'Giải trí', title: 'Mua vé' },
];

type ExpenseSortKey = 'dateDesc' | 'dateAsc' | 'amountDesc' | 'amountAsc' | 'categoryAsc' | 'payerAsc' | 'titleAsc';

const EXPENSE_SORT_OPTIONS: Array<SortOption<ExpenseSortKey>> = [
  { value: 'dateDesc', label: 'Ngày mới nhất' },
  { value: 'dateAsc', label: 'Ngày cũ nhất' },
  { value: 'amountDesc', label: 'Số tiền cao nhất' },
  { value: 'amountAsc', label: 'Số tiền thấp nhất' },
  { value: 'categoryAsc', label: 'Danh mục A-Z' },
  { value: 'payerAsc', label: 'Người trả A-Z' },
  { value: 'titleAsc', label: 'Tên A-Z' },
];

export function TripExpenses() {
  const { id } = useParams();
  const { trips, expenses, setCurrentTripId, addExpense, deleteExpense, editExpense, editTrip, undoLastAction } = useAppContext();
  const { showToast, confirm } = useFeedback();
  const { uiDensity } = useSettings();
  const formatMoney = useFormatMoney();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [payerFilter, setPayerFilter] = useState<string>('all');
  const [participantFilter, setParticipantFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<ExpenseSortKey>('dateDesc');
  const [activeTab, setActiveTab] = useState<'list' | 'balances' | 'charts'>('list');
  const [settlementMemberId, setSettlementMemberId] = useState<string | null>(null);
  const [isBudgetSettingsOpen, setIsBudgetSettingsOpen] = useState(false);

  const trip = trips.find(t => t.id === id);
  const baseCurrency = trip?.baseCurrency || 'VND';
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(baseCurrency);
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const applyTemplate = (title: string, category: string) => {
    if (!formRef.current) return;
    const titleInput = formRef.current.elements.namedItem('title') as HTMLInputElement;
    const categorySelect = formRef.current.elements.namedItem('category') as HTMLSelectElement;
    if (titleInput) titleInput.value = title;
    if (categorySelect) {
      categorySelect.value = category;
      categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

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

  const getExchangeRateToBaseCurrency = (currency: Currency) => {
    if (currency === baseCurrency) {
      return 1;
    }

    return trip?.exchangeRates?.[currency]
      ?? CURRENCIES[currency].defaultRateToVND / CURRENCIES[baseCurrency].defaultRateToVND;
  };

  const handleCurrencyChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newCurrency = e.target.value as Currency;
    setSelectedCurrency(newCurrency);
    setExchangeRate(getExchangeRateToBaseCurrency(newCurrency));
  };

  const handleAddExpense = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) {
      return;
    }

    const formData = new FormData(e.currentTarget);
    const participants = formData.getAll('participants') as string[];
    const originalAmount = Number(formData.get('originalAmount'));
    const rate = selectedCurrency === baseCurrency ? 1 : Number(formData.get('exchangeRate'));
    const amount = originalAmount * rate;
    if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
      setSubmitError('Số tiền phải lớn hơn 0.');
      return;
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      setSubmitError('Tỉ giá không hợp lệ.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setSubmitError('Số tiền quy đổi không hợp lệ.');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      if (editingExpense) {
        await editExpense(editingExpense.id, {
          date: formData.get('date') as string,
          time: editingExpense.time,
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
        await addExpense({
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
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Không thể lưu chi tiêu.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (id) setCurrentTripId(id);
  }, [id, setCurrentTripId]);

  const tripExpensesRaw = useMemo(() => expenses.filter((e) => e.tripId === trip?.id), [expenses, trip?.id]);
  const tripExpensesForDisplay = useMemo(() => tripExpensesRaw.filter((e) => !e.isSettlement), [tripExpensesRaw]);
  const tripExpenses = tripExpensesRaw; // include settlements in balance calculations
  const expenseCategoryOptions = useMemo(() => {
    return mergeCategoryOptions(
      EXPENSE_CATEGORY_OPTIONS,
      [
        ...tripExpensesForDisplay.map((expense) => expense.category),
        ...Object.keys(trip?.categoryBudgets ?? {}),
      ],
    );
  }, [trip?.categoryBudgets, tripExpensesForDisplay]);
  const filteredExpenses = useMemo(() => {
    const filteredList = tripExpensesForDisplay.filter(expense => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = expense.title.toLowerCase().includes(query) ||
        expense.category.toLowerCase().includes(query) ||
        (expense.note && expense.note.toLowerCase().includes(query));
      const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
      const matchesPayer = payerFilter === 'all' || expense.paidBy === payerFilter;
      const matchesParticipant = participantFilter === 'all' || expense.participants.includes(participantFilter);
      return matchesSearch && matchesCategory && matchesPayer && matchesParticipant;
    });
    const memberNameById = new Map<string, string>((trip?.members ?? []).map((member) => [member.id, member.displayName]));
    const fallbackSort = (a: Expense, b: Expense) => compareDate(`${a.date}T${normalizeTimeForInput(a.time)}`, `${b.date}T${normalizeTimeForInput(b.time)}`, 'desc');
    const sortComparator = (a: Expense, b: Expense) => {
      switch (sortBy) {
        case 'dateAsc': return compareDate(`${a.date}T${normalizeTimeForInput(a.time)}`, `${b.date}T${normalizeTimeForInput(b.time)}`, 'asc');
        case 'amountDesc': return compareNumber(a.amount, b.amount, 'desc');
        case 'amountAsc': return compareNumber(a.amount, b.amount, 'asc');
        case 'categoryAsc': return compareText(a.category, b.category, 'asc');
        case 'payerAsc': return compareText(memberNameById.get(a.paidBy) ?? a.paidBy, memberNameById.get(b.paidBy) ?? b.paidBy, 'asc');
        case 'titleAsc': return compareText(a.title, b.title, 'asc');
        case 'dateDesc':
        default: return fallbackSort(a, b);
      }
    };
    return stableSort(filteredList, chainComparators(sortComparator, fallbackSort));
  }, [tripExpensesForDisplay, searchQuery, categoryFilter, payerFilter, participantFilter, sortBy, trip?.members]);
  const filteredExpenseTotal = useMemo(() => filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0), [filteredExpenses]);
  const filteredExpenseAverage = filteredExpenses.length > 0 ? filteredExpenseTotal / filteredExpenses.length : 0;
  const hasActiveExpenseFilters = Boolean(searchQuery.trim()) || categoryFilter !== 'all' || payerFilter !== 'all' || participantFilter !== 'all';
  const tripMembers = trip?.members ?? [];

  const balances = useMemo(() => {
    const bals: Record<string, number> = {};
    tripMembers.forEach(m => bals[m.id] = 0);

    tripExpenses.forEach(expense => {
      const normalizedAmount = expense.amount;

      if (bals[expense.paidBy] !== undefined) {
        bals[expense.paidBy] += normalizedAmount;
      }

      if (expense.participants.length > 0) {
        const splitAmount = normalizedAmount / expense.participants.length;
        expense.participants.forEach(pId => {
          if (bals[pId] !== undefined) {
            bals[pId] -= splitAmount;
          }
        });
      }
    });
    return bals;
  }, [tripExpenses, tripMembers]);

  const detailedBalances = useMemo(() => {
    const curBals: Record<string, Record<string, number>> = {};

    tripExpenses.forEach(expense => {
      const currency = expense.currency || baseCurrency;
      if (!curBals[currency]) {
        curBals[currency] = {};
        tripMembers.forEach(m => curBals[currency][m.id] = 0);
      }
      const amt = expense.originalAmount || expense.amount;

      if (curBals[currency][expense.paidBy] !== undefined) {
        curBals[currency][expense.paidBy] += amt;
      }

      if (expense.participants && expense.participants.length > 0) {
        const split = amt / expense.participants.length;
        expense.participants.forEach(pId => {
          if (curBals[currency][pId] !== undefined) {
            curBals[currency][pId] -= split;
          }
        });
      }
    });

    return curBals;
  }, [tripExpenses, tripMembers, baseCurrency]);

  const chartsData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    const dateTotals: Record<string, number> = {};
    const memberTotals: Record<string, number> = {};

    tripExpensesForDisplay.forEach(exp => {
      const amt = exp.amount;
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + amt;
      dateTotals[exp.date] = (dateTotals[exp.date] || 0) + amt;
      memberTotals[exp.paidBy] = (memberTotals[exp.paidBy] || 0) + amt;
    });

    const pieData = Object.entries(categoryTotals).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const barData = Object.entries(dateTotals)
      .map(([date, value]) => ({ date: formatLocalDate(date, { day: '2-digit', month: '2-digit' }), value, rawDate: date }))
      .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime());

    const memberData = Object.entries(memberTotals).map(([id, value]) => {
      const member = tripMembers.find(m => m.id === id);
      return {
        name: member?.displayName || id,
        value
      };
    }).sort((a, b) => b.value - a.value);

    return { pieData, barData, memberData };
  }, [tripExpensesForDisplay, tripMembers]);

  const categoryBudgetRows = useMemo(() => {
    const budgets = trip?.categoryBudgets ?? {};
    const totals = tripExpensesForDisplay.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.category] = (acc[expense.category] ?? 0) + expense.amount;
      return acc;
    }, {});
    const categories = Array.from(new Set([...expenseCategoryOptions.map((option) => option.value), ...Object.keys(budgets), ...Object.keys(totals)]));
    return categories
      .map((category) => ({
        category,
        budget: budgets[category] ?? 0,
        spent: totals[category] ?? 0,
      }))
      .filter((row) => row.budget > 0 || row.spent > 0);
  }, [expenseCategoryOptions, trip?.categoryBudgets, tripExpensesForDisplay]);

  const saveBudgetSettings = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!trip) return;
    const formData = new FormData(e.currentTarget);
    const categories = expenseCategoryOptions.map((option) => option.value);
    const categoryBudgets = categories.reduce<Record<string, number>>((acc, category) => {
      const amount = Number(formData.get(`budget-${category}`));
      if (Number.isFinite(amount) && amount > 0) {
        acc[category] = amount;
      }
      return acc;
    }, {});
    const exchangeRates = (Object.keys(CURRENCIES) as Currency[]).reduce<Partial<Record<Currency, number>>>((acc, currency) => {
      if (currency === baseCurrency) return acc;
      const rate = Number(formData.get(`rate-${currency}`));
      if (Number.isFinite(rate) && rate > 0) {
        acc[currency] = rate;
      }
      return acc;
    }, {});

    try {
      await editTrip(trip.id, { categoryBudgets, exchangeRates });
      setIsBudgetSettingsOpen(false);
      showToast({ tone: 'success', title: 'Đã lưu cấu hình', message: 'Ngân sách danh mục và tỉ giá đã được cập nhật.' });
    } catch (error) {
      showToast({ tone: 'error', title: 'Không thể lưu cấu hình', message: getErrorMessage(error, 'Không thể lưu ngân sách/tỉ giá.') });
    }
  };

  const canEdit = trip?.permissions?.canEditContent ?? false;
  const canManageTrip = trip?.permissions?.canManageTrip ?? false;
  const baseCurrencySymbol = CURRENCIES[baseCurrency].symbol;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.02 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { ease: 'easeOut', duration: 0.2 } }
  };



  if (!trip) return <div>Trip not found</div>;

  const remaining = trip.budget - trip.spent;
  const safeBudget = trip.budget > 0 ? trip.budget : 0;
  const spentPercentage = safeBudget > 0 ? Math.min((trip.spent / safeBudget) * 100, 100) : 0;
  const avgPerPerson = trip.members.length > 0 ? trip.spent / trip.members.length : 0;

  const COLORS = ['#8A3FFC', '#33B1FF', '#007D79', '#FF7EB3', '#FA4D56', '#F1C21B', '#0043CE'];

  const exportExpensesCsv = () => {
    const header = ['Ngay', 'Thoi gian', 'Noi dung', 'Danh muc', 'So tien goc', 'Tien te', 'Quy doi', 'Nguoi tra', 'Nguoi tham gia', 'Ghi chu'];
    const rows = filteredExpenses.map((expense) => {
      const payer = trip.members.find((member) => member.id === expense.paidBy)?.displayName || expense.paidBy;
      const participants = expense.participants.map((participantId) => trip.members.find((member) => member.id === participantId)?.displayName || participantId).join(', ');
      return [
        expense.date,
        expense.time,
        expense.title,
        expense.category,
        String(expense.originalAmount ?? expense.amount),
        expense.currency || baseCurrency,
        String(expense.amount),
        payer,
        participants,
        expense.note || '',
      ];
    });

    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${trip.title.replace(/\s+/g, '-').toLowerCase()}-expenses.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const printExpenseReport = () => {
    const reportWindow = window.open('', '_blank', 'width=1024,height=768');
    if (!reportWindow) {
      showToast({
        tone: 'info',
        title: 'Không thể mở cửa sổ in',
        message: 'Trình duyệt đã chặn popup. Hãy cho phép popup rồi thử lại.',
      });
      return;
    }

    const escapeHtml = (value: string) => value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

    const title = matchMedia('(max-width: 768px)').matches ? `${trip.title.substring(0, 15)}...` : trip.title;

    reportWindow.document.write(`
      <html>
        <head><title>Expense Report</title></head>
        <body style="font-family: sans-serif; padding: 24px;">
          <h1>${escapeHtml(title)}</h1>
          <p>Tong chi: ${formatMoney(trip.spent, baseCurrencySymbol)}</p>
          <table border="1" cellspacing="0" cellpadding="8" width="100%">
            <thead><tr><th>Ngay</th><th>Noi dung</th><th>Danh muc</th><th>So tien</th><th>Nguoi tra</th></tr></thead>
            <tbody>
              ${filteredExpenses.map((expense) => {
      const payer = trip.members.find((member) => member.id === expense.paidBy)?.displayName || expense.paidBy;
      return `<tr><td>${escapeHtml(expense.date)}</td><td>${escapeHtml(expense.title)}</td><td>${escapeHtml(expense.category)}</td><td>${formatMoney(expense.originalAmount ?? expense.amount, CURRENCIES[expense.currency || baseCurrency].symbol)}</td><td>${escapeHtml(payer)}</td></tr>`;
    }).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  };



  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="pb-10">
      <motion.section variants={itemVariants} className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="font-label text-xs uppercase tracking-[0.2em] text-secondary dark:text-gray-300 font-bold mb-2 block">Chuyến đi hiện tại</span>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-on-surface font-headline">{trip.title}</h1>
            <p className="text-on-surface-variant mt-2 flex items-center gap-2">
              <Icons.CalendarDays className="w-4 h-4" />
              {formatLocalDate(trip.startDate, { day: '2-digit', month: 'short' })} — {formatLocalDate(trip.endDate, { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div className="flex gap-3">
            {canManageTrip && (
              <button onClick={() => setIsBudgetSettingsOpen(true)} className="bg-surface-container-high text-on-surface px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 hover:bg-surface-container-highest">
                <Icons.Settings className="w-5 h-5" />
                Ngân sách & tỉ giá
              </button>
            )}
            <button onClick={exportExpensesCsv} className="bg-surface-container-high text-on-surface px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 hover:bg-surface-container-highest">
              <Icons.Receipt className="w-5 h-5" />
              Xuất CSV
            </button>
            <button onClick={printExpenseReport} className="bg-surface-container-high text-on-surface px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 hover:bg-surface-container-highest">
              <Icons.FileText className="w-5 h-5" />
              In PDF
            </button>
            {canEdit && (
              <button onClick={() => { setEditingExpense(null); setIsAddOpen(true); }} className="bg-primary text-on-primary px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-all flex items-center gap-2 editorial-shadow">
                <Icons.Plus className="w-5 h-5" />
                Thêm chi tiêu
              </button>
            )}
          </div>
        </div>
      </motion.section>

      {spentPercentage >= 90 && (
        <motion.div variants={itemVariants} className={`mb-8 p-4 rounded-xl flex items-start gap-4 editorial-shadow ${spentPercentage >= 100 ? 'bg-error-container text-on-error-container' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'}`}>
          {spentPercentage >= 100 ? <Icons.AlertTriangle className="w-6 h-6 flex-shrink-0 text-error" /> : <Icons.AlertCircle className="w-6 h-6 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />}
          <div>
            <h4 className="font-bold font-headline mb-1">
              {spentPercentage >= 100 ? 'Đã vượt ngân sách dự kiến!' : 'Sắp chạm ngưỡng ngân sách'}
            </h4>
            <p className="text-sm opacity-90">
              {spentPercentage >= 100
                ? `Chuyến đi đã chi tiêu vượt ${formatMoney(Math.abs(remaining), baseCurrencySymbol)} ban đầu.`
                : `Bạn đã chi tiêu ${spentPercentage.toFixed(1)}% ngân sách tổng quát của chuyến đi.`}
            </p>
          </div>
        </motion.div>
      )}

      <motion.section variants={itemVariants} className={uiDensity === 'compact' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10 density-stack' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-12'}>
        <div className={uiDensity === 'compact' ? 'bg-surface-container-lowest p-4 rounded-xl editorial-shadow relative overflow-hidden group density-card' : 'bg-surface-container-lowest p-6 rounded-xl editorial-shadow relative overflow-hidden group density-card'}>
          <div className="relative z-10">
            <h3 className="font-label text-[10px] uppercase tracking-widest font-bold text-secondary dark:text-gray-300 mb-2 md:mb-4">Tổng Ngân Sách</h3>
            <div className="text-2xl md:text-3xl font-extrabold text-on-surface font-headline tracking-tight truncate" title={`${formatMoney(trip.budget, baseCurrencySymbol)}`}>{formatMoney(trip.budget, baseCurrencySymbol)}</div>
            <p className="text-xs text-on-surface-variant mt-2">Dự kiến cho {trip.members.length} người</p>
          </div>
          <Icons.Wallet className="absolute -bottom-4 -right-4 w-20 h-20 md:w-24 md:h-24 text-primary dark:text-white/5 rotate-12 group-hover:scale-110 transition-transform" />
        </div>

        <div className={uiDensity === 'compact' ? 'bg-surface-container-lowest p-4 rounded-xl editorial-shadow relative overflow-hidden group density-card' : 'bg-surface-container-lowest p-6 rounded-xl editorial-shadow relative overflow-hidden group density-card'}>
          <div className="relative z-10">
            <h3 className="font-label text-[10px] uppercase tracking-widest font-bold text-secondary dark:text-gray-300 mb-2 md:mb-4">Đã Chi Tiêu</h3>
            <div className={`text-2xl md:text-3xl font-extrabold font-headline tracking-tight truncate ${spentPercentage >= 100 ? 'text-error' : spentPercentage >= 90 ? 'text-warning text-yellow-600 dark:text-yellow-400' : 'text-tertiary'}`} title={`${formatMoney(trip.spent, baseCurrencySymbol)}`}>{formatMoney(trip.spent, baseCurrencySymbol)}</div>
            <div className="mt-4 h-1.5 w-full bg-surface-variant rounded-full overflow-hidden">
              <div className={`h-full transition-all ${spentPercentage >= 100 ? 'bg-error' : spentPercentage >= 90 ? 'bg-yellow-500' : 'bg-tertiary'}`} style={{ width: `${spentPercentage}%` }}></div>
            </div>
          </div>
          <Icons.Banknote className="absolute -bottom-4 -right-4 w-20 h-20 md:w-24 md:h-24 text-tertiary/5 rotate-12 group-hover:scale-110 transition-transform" />
        </div>

        <div className={uiDensity === 'compact' ? 'bg-surface-container-lowest p-4 rounded-xl editorial-shadow relative overflow-hidden group density-card' : 'bg-surface-container-lowest p-6 rounded-xl editorial-shadow relative overflow-hidden group density-card'}>
          <div className="relative z-10">
            <h3 className="font-label text-[10px] uppercase tracking-widest font-bold text-secondary dark:text-gray-300 mb-2 md:mb-4">Còn Lại</h3>
            <div className="text-2xl md:text-3xl font-extrabold text-primary dark:text-white-container font-headline tracking-tight truncate" title={`${formatMoney(remaining, baseCurrencySymbol)}`}>{formatMoney(remaining, baseCurrencySymbol)}</div>
            <p className="text-xs text-on-surface-variant mt-2">{safeBudget > 0 ? ((remaining / safeBudget) * 100).toFixed(1) : '0.0'}% ngân sách</p>
          </div>
          <Icons.PiggyBank className="absolute -bottom-4 -right-4 w-20 h-20 md:w-24 md:h-24 text-primary dark:text-white-container/5 rotate-12 group-hover:scale-110 transition-transform" />
        </div>

        <div className={uiDensity === 'compact' ? 'bg-surface-container-lowest p-4 rounded-xl editorial-shadow relative overflow-hidden group density-card' : 'bg-surface-container-lowest p-6 rounded-xl editorial-shadow relative overflow-hidden group density-card'}>
          <div className="relative z-10">
            <h3 className="font-label text-[10px] uppercase tracking-widest font-bold text-secondary dark:text-gray-300 mb-2 md:mb-4">TB mỗi người</h3>
            <div className="text-2xl md:text-3xl font-extrabold text-on-surface font-headline tracking-tight truncate" title={`${formatMoney(avgPerPerson, baseCurrencySymbol)}`}>{formatMoney(avgPerPerson, baseCurrencySymbol)}</div>
            <p className="text-xs text-on-surface-variant mt-2">Chia cho {trip.members.length} thành viên</p>
          </div>
          <Icons.Users className="absolute -bottom-4 -right-4 w-20 h-20 md:w-24 md:h-24 text-on-surface/5 rotate-12 group-hover:scale-110 transition-transform" />
        </div>
      </motion.section>

      {categoryBudgetRows.length > 0 && (
        <motion.section variants={itemVariants} className="mb-10 rounded-3xl bg-surface-container-lowest p-5 editorial-shadow ring-1 ring-outline/10">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-label text-[10px] font-bold uppercase tracking-[0.22em] text-secondary dark:text-gray-300">Category budgets</p>
              <h2 className="mt-1 font-headline text-xl font-bold text-on-surface">Theo dõi ngân sách từng danh mục</h2>
            </div>
            {canEdit && (
              <button type="button" onClick={() => setIsBudgetSettingsOpen(true)} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary transition hover:opacity-90">
                Cấu hình
              </button>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {categoryBudgetRows.map((row) => {
              const pct = row.budget > 0 ? Math.min((row.spent / row.budget) * 100, 999) : 0;
              const isOver = row.budget > 0 && row.spent > row.budget;
              const isNear = row.budget > 0 && pct >= 85 && !isOver;
              return (
                <div key={row.category} className="rounded-2xl bg-surface-container-low p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="truncate font-headline text-base font-bold text-on-surface">{row.category}</p>
                    {row.budget > 0 && (
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${isOver ? 'bg-error-container text-on-error-container' : isNear ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' : 'bg-primary/10 text-primary dark:text-white'}`}>
                        {pct.toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-secondary dark:text-gray-300">
                    {formatMoney(row.spent, baseCurrencySymbol)}
                    {row.budget > 0 ? ` / ${formatMoney(row.budget, baseCurrencySymbol)}` : ' đã chi'}
                  </p>
                  {row.budget > 0 && (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-variant">
                      <div className={`h-full ${isOver ? 'bg-error' : isNear ? 'bg-yellow-500' : 'bg-tertiary'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.section>
      )}

      <motion.div variants={itemVariants} className="flex gap-4 mb-6 relative z-10 w-full overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveTab('list')} className={`px-6 py-2.5 font-bold rounded-2xl transition-all whitespace-nowrap ${activeTab === 'list' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'bg-surface-container-high text-secondary dark:text-gray-300 hover:text-on-surface'}`}>
          Danh sách Chi tiêu
        </button>
        <button onClick={() => setActiveTab('balances')} className={`px-6 py-2.5 font-bold rounded-2xl transition-all whitespace-nowrap ${activeTab === 'balances' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'bg-surface-container-high text-secondary dark:text-gray-300 hover:text-on-surface'}`}>
          <div className="flex items-center gap-2">
            <Icons.ArrowRightLeft className="w-4 h-4" /> Tra soát Công nợ
          </div>
        </button>
        <button onClick={() => setActiveTab('charts')} className={`px-6 py-2.5 font-bold rounded-2xl transition-all whitespace-nowrap ${activeTab === 'charts' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'bg-surface-container-high text-secondary dark:text-gray-300 hover:text-on-surface'}`}>
          <div className="flex items-center gap-2">
            <Icons.PieChart className="w-4 h-4" /> Biểu đồ Chi tiêu
          </div>
        </button>
      </motion.div>

      <motion.section variants={itemVariants} className="bg-surface-container-low rounded-3xl p-1 overflow-hidden">
        <div className="bg-surface-container-lowest rounded-[1.4rem] overflow-hidden">
          {activeTab === 'list' && (
            <>
              <div className="p-6 border-b border-surface-variant/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-container-low/60 backdrop-blur-sm">
                <h2 className="text-xl font-bold font-headline text-on-surface hidden lg:block">Danh sách Chi tiêu</h2>
                <div className="flex flex-wrap gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
                  <div className="relative flex-1 md:w-64">
                    <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary dark:text-gray-300" />
                    <input
                      type="search"
                      data-search-input="true"
                      placeholder="Tìm kiếm chi tiêu..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                    />
                  </div>
                  <select
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                    className="flex-1 md:flex-none rounded-lg bg-surface-container-low border border-outline-variant/50 px-3 py-2 text-sm text-on-surface"
                  >
                    <option value="all">Tất cả danh mục</option>
                    {[...new Set(tripExpensesForDisplay.map((expense) => expense.category))].map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                  <select
                    value={payerFilter}
                    onChange={(event) => setPayerFilter(event.target.value)}
                    className="flex-1 md:flex-none rounded-lg bg-surface-container-low border border-outline-variant/50 px-3 py-2 text-sm text-on-surface"
                  >
                    <option value="all">Mọi người chi</option>
                    {trip.members.map((m) => (
                      <option key={`payer-${m.id}`} value={m.id}>Người chi: {m.displayName}</option>
                    ))}
                  </select>
                  <select
                    value={participantFilter}
                    onChange={(event) => setParticipantFilter(event.target.value)}
                    className="flex-1 md:flex-none rounded-lg bg-surface-container-low border border-outline-variant/50 px-3 py-2 text-sm text-on-surface"
                  >
                    <option value="all">Mọi người nợ</option>
                    {trip.members.map((m) => (
                      <option key={`part-${m.id}`} value={m.id}>Người nợ: {m.displayName}</option>
                    ))}
                  </select>
                  <SortSelect value={sortBy} options={EXPENSE_SORT_OPTIONS} onChange={setSortBy} className="flex-1 md:flex-none border border-outline-variant/50 bg-surface-container-low" />
                  <button className="p-2 rounded-lg transition-colors text-secondary dark:text-gray-300" title="Bộ lọc đang bật">
                    <Icons.Filter className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="border-b border-surface-variant/30 bg-surface-container-low/40 px-6 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="text-sm font-medium text-secondary dark:text-gray-300">
                    Hiển thị {filteredExpenses.length} khoản chi
                    {filteredExpenses.length !== tripExpensesForDisplay.length && ` phù hợp trong tổng ${tripExpensesForDisplay.length} khoản chi`}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:min-w-[520px]">
                    <div className="rounded-xl bg-surface-container-lowest px-3 py-2">
                      <p className="font-label text-[10px] font-bold uppercase tracking-widest text-secondary">Tổng lọc</p>
                      <p className="font-headline font-bold text-on-surface">{formatMoney(filteredExpenseTotal, baseCurrencySymbol)}</p>
                    </div>
                    <div className="rounded-xl bg-surface-container-lowest px-3 py-2">
                      <p className="font-label text-[10px] font-bold uppercase tracking-widest text-secondary">Trung bình</p>
                      <p className="font-headline font-bold text-on-surface">{formatMoney(filteredExpenseAverage, baseCurrencySymbol)}</p>
                    </div>
                    <div className="col-span-2 rounded-xl bg-surface-container-lowest px-3 py-2 sm:col-span-1">
                      <p className="font-label text-[10px] font-bold uppercase tracking-widest text-secondary">Bộ lọc</p>
                      {hasActiveExpenseFilters ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setCategoryFilter('all');
                            setPayerFilter('all');
                            setParticipantFilter('all');
                          }}
                          className="font-bold text-primary dark:text-white"
                        >
                          Xóa bộ lọc
                        </button>
                      ) : (
                        <p className="font-bold text-on-surface">Toàn bộ</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-3 p-4 md:hidden">
                {filteredExpenses.map((expense) => {
                  const payer = (trip?.members ?? []).find(m => m.id === expense.paidBy);
                  return (
                    <motion.div variants={itemVariants} key={`mobile-${expense.id}`} className="rounded-2xl bg-surface-container-low p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-headline text-base font-bold text-on-surface">{expense.title}</p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-secondary dark:text-gray-300">
                            {formatLocalDate(expense.date, { day: '2-digit', month: 'short' })} · {expense.time}
                          </p>
                        </div>
                        <p className="shrink-0 text-right font-headline text-lg font-bold text-primary dark:text-white">
                          {formatMoney(expense.originalAmount ?? expense.amount, CURRENCIES[expense.currency || baseCurrency].symbol)}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-primary/10 px-3 py-1 font-bold text-primary dark:text-white">{expense.category}</span>
                        {payer && <span className="rounded-full bg-surface-container-high px-3 py-1 font-bold text-secondary">Chi bởi {payer.displayName}</span>}
                        <span className="rounded-full bg-surface-container-high px-3 py-1 font-bold text-secondary">{expense.participants.length} người tham gia</span>
                      </div>
                      {expense.note && <p className="mt-3 line-clamp-2 text-sm text-secondary dark:text-gray-300"><LinkifyText text={expense.note} /></p>}
                      {canEdit && (
                        <div className="mt-4 flex justify-end gap-2">
                          <button onClick={() => { setEditingExpense(expense); setIsAddOpen(true); }} className="rounded-lg p-2 text-secondary transition-colors hover:bg-surface-container-high hover:text-primary">
                            <Icons.Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={async () => {
                              const shouldDelete = await confirm({
                                title: 'Xóa khoản chi này',
                                message: 'Khoản chi sẽ bị gỡ khỏi báo cáo chi tiêu của chuyến đi.',
                                confirmLabel: 'Xóa khoản chi',
                                cancelLabel: 'Giữ lại',
                                tone: 'danger',
                              });
                              if (!shouldDelete) return;
                              try {
                                await deleteExpense(expense.id);
                                showToast({ tone: 'info', title: 'Đã xóa khoản chi', action: { label: 'Hoàn tác', onClick: undoLastAction } });
                              } catch (error) {
                                showToast({ tone: 'error', title: 'Không thể xóa chi tiêu', message: getErrorMessage(error, 'Không thể xóa chi tiêu.') });
                              }
                            }}
                            className="rounded-lg p-2 text-secondary transition-colors hover:bg-error-container hover:text-error"
                          >
                            <Icons.Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
                {filteredExpenses.length === 0 && (
                  <div className="py-8 text-center text-sm text-secondary dark:text-gray-300">
                    Không tìm thấy khoản chi phù hợp.
                  </div>
                )}
              </div>
              <div className="hidden overflow-x-auto no-scrollbar md:block">
                <table className="w-full text-left border-collapse min-w-[800px] density-table">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      <th className="px-6 py-4 font-label text-[10px] uppercase tracking-widest font-bold text-secondary dark:text-gray-300">Ngày</th>
                      <th className="px-6 py-4 font-label text-[10px] uppercase tracking-widest font-bold text-secondary dark:text-gray-300">Nội dung</th>
                      <th className="px-6 py-4 font-label text-[10px] uppercase tracking-widest font-bold text-secondary dark:text-gray-300 text-right">Số tiền</th>
                      <th className="px-6 py-4 font-label text-[10px] uppercase tracking-widest font-bold text-secondary dark:text-gray-300">Danh mục</th>
                      <th className="px-6 py-4 font-label text-[10px] uppercase tracking-widest font-bold text-secondary dark:text-gray-300">Người chi</th>
                      <th className="px-6 py-4 font-label text-[10px] uppercase tracking-widest font-bold text-secondary dark:text-gray-300">Người tham gia</th>
                      <th className="px-6 py-4 font-label text-[10px] uppercase tracking-widest font-bold text-secondary dark:text-gray-300">Hoá đơn</th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-variant/20">
                    {filteredExpenses.map((expense) => {
                      const payer = (trip?.members ?? []).find(m => m.id === expense.paidBy);
                      const getCategoryStyle = (cat: string) => {
                        switch (cat) {
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
                        <motion.tr variants={itemVariants} key={expense.id} className="hover:bg-surface-container-lowest group transition-colors transform-gpu" style={{ willChange: 'transform, opacity' }}>
                          <td className="px-6 py-5 align-middle">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-on-surface">{formatLocalDate(expense.date, { day: '2-digit', month: 'short' })}</span>
                              <span className="text-[10px] text-secondary dark:text-gray-300">{expense.time}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 align-middle">
                            <div className="font-headline font-bold text-on-surface mb-1">{expense.title}</div>
                            <div className="text-xs text-secondary dark:text-gray-300 italic"><LinkifyText text={expense.note} /></div>
                          </td>
                          <td className="px-6 py-5 align-middle text-right">
                            <p className="font-headline font-bold text-lg text-primary dark:text-white">
                              {formatMoney(expense.originalAmount ?? expense.amount, CURRENCIES[expense.currency || baseCurrency].symbol)}
                            </p>
                            {expense.currency && expense.currency !== baseCurrency && Math.abs((expense.originalAmount ?? expense.amount) - expense.amount) > 0.01 && (
                              <p className="text-[10px] text-secondary dark:text-gray-300 font-medium whitespace-nowrap text-right">
                                ≈ {formatMoney(expense.amount, baseCurrencySymbol)}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-5 align-middle">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${catStyle.bg} ${catStyle.text} text-xs font-semibold`}>
                              <CatIcon className="w-3.5 h-3.5" /> {expense.category}
                            </span>
                          </td>
                          <td className="px-6 py-5 align-middle">
                            <div className="flex items-center gap-2">
                              {payer && <img alt={payer.displayName} className="w-6 h-6 rounded-full" src={payer.avatar} />}
                              <span className="text-sm">{payer?.displayName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 align-middle">
                            <div className="flex -space-x-2">
                              {expense.participants.slice(0, 3).map(pId => {
                                const p = (trip?.members ?? []).find(m => m.id === pId);
                                return p ? <img key={p.id} alt={p.displayName} className="w-6 h-6 rounded-full border-2 border-surface-container-lowest" src={p.avatar} /> : null;
                              })}
                              {expense.participants.length > 3 && (
                                <div className="w-6 h-6 rounded-full bg-surface-container-high border-2 border-surface-container-lowest flex items-center justify-center text-[8px] font-bold">
                                  +{expense.participants.length - 3}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-5 align-middle">
                            {expense.receiptImage ? (
                              <a href={expense.receiptImage} target="_blank" rel="noopener noreferrer" className="text-primary dark:text-white hover:text-primary dark:text-white-container transition-colors" title="Xem hoá đơn">
                                <Icons.Image className="w-5 h-5" />
                              </a>
                            ) : (
                              <span className="text-secondary dark:text-gray-300/50">-</span>
                            )}
                          </td>
                          <td className="px-6 py-5 align-middle text-right flex justify-end gap-2">
                            {canEdit && (
                              <>
                                <button onClick={() => { setEditingExpense(expense); setIsAddOpen(true); }} className="p-2 text-secondary dark:text-gray-300 hover:text-primary dark:text-white hover:bg-primary-container rounded-lg transition-colors">
                                  <Icons.Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={async () => {
                                  const shouldDelete = await confirm({
                                    title: 'Xóa khoản chi này',
                                    message: 'Khoản chi sẽ bị gỡ khỏi báo cáo chi tiêu của chuyến đi.',
                                    confirmLabel: 'Xóa khoản chi',
                                    cancelLabel: 'Giữ lại',
                                    tone: 'danger',
                                  });
                                  if (!shouldDelete) return;
                                  try {
                                    await deleteExpense(expense.id);
                                    showToast({
                                      tone: 'info',
                                      title: 'Đã xóa khoản chi',
                                      action: { label: 'Hoàn tác', onClick: undoLastAction }
                                    });
                                  } catch (error) {
                                    showToast({
                                      tone: 'error',
                                      title: 'Không thể xóa chi tiêu',
                                      message: getErrorMessage(error, 'Không thể xóa chi tiêu.'),
                                    });
                                  }
                                }} className="p-2 text-secondary dark:text-gray-300 hover:text-error hover:bg-error-container rounded-lg transition-colors">
                                  <Icons.Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </td>
                        </motion.tr>
                      );
                    })}
                    {filteredExpenses.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-16 text-center">
                          <div className="mx-auto max-w-md">
                            <Icons.Search className="mx-auto mb-4 h-10 w-10 text-secondary dark:text-gray-300/60" />
                            <p className="font-headline text-xl font-bold text-on-surface">
                              {searchQuery.trim() ? 'Không tìm thấy khoản chi phù hợp' : 'Chưa có khoản chi nào'}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-secondary dark:text-gray-300">
                              {searchQuery.trim()
                                ? 'Hãy thử từ khóa khác hoặc xóa bộ lọc tìm kiếm hiện tại.'
                                : 'Bắt đầu bằng cách thêm khoản chi đầu tiên cho chuyến đi này.'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === 'balances' && (
            <div className="p-6">
              <div className="flex items-center gap-4 mb-8 bg-primary/10 p-4 rounded-xl border border-primary/20">
                <Icons.AlertTriangle className="w-6 h-6 text-primary dark:text-white flex-shrink-0" />
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Bảng tính hiển thị số dư của mỗi người, dựa trên tổng tiền đã chi trả trừ đi phần tiền phải chịu chung. <br />
                  <strong className="text-tertiary">Nhận lại (Số dương)</strong>: Đã trả lố phần mình, cần được trả lại. <br />
                  <strong className="text-error">Cần trả (Số âm)</strong>: Chưa trả đủ phần mình, cần đưa thêm tiền.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trip.members.map(m => {
                  const bal = balances[m.id] || 0;
                  const isOwed = bal > 0.01;
                  const owes = bal < -0.01;
                  const settled = !isOwed && !owes;
                  return (
                    <motion.div variants={itemVariants} key={m.id} className={`p-5 rounded-2xl border-2 flex items-center gap-4 transition-all hover:scale-[1.02] hover:shadow-md ${isOwed ? 'bg-tertiary/5 border-tertiary/20' : owes ? 'bg-error-container/20 border-error/20' : 'bg-surface border-outline-variant/30 opacity-70'}`}>
                      <img src={m.avatar} alt={m.displayName} className="w-14 h-14 rounded-full border-2 border-surface shadow-sm" />
                      <div>
                        <div className="font-headline font-bold text-lg">{m.displayName}</div>
                        {settled && <div className="text-secondary dark:text-gray-300 text-sm font-medium mt-1 select-none">Đã thanh toán đủ</div>}
                        {isOwed && <div className="text-tertiary font-bold mt-1 tracking-tight">{'+ '}{formatMoney(Math.abs(bal), baseCurrencySymbol)}</div>}
                        {owes && <div className="text-error font-bold mt-1 tracking-tight">{'- '}{formatMoney(Math.abs(bal), baseCurrencySymbol)}</div>}
                      </div>
                      <div className="ml-auto">
                        <button onClick={() => setSettlementMemberId(m.id)} className="p-2.5 text-secondary dark:text-gray-300 hover:text-primary transition-colors bg-surface-container hover:bg-surface-container-high rounded-full shadow-sm" title="Chi tiết đa tiền tệ">
                          <Icons.Wallet className="w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'charts' && (
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/30">
                  <h4 className="font-label text-sm uppercase tracking-widest font-bold text-secondary dark:text-gray-300 mb-6 text-center">Phân bổ Danh mục</h4>
                  <div className="h-64 w-full">
                    {chartsData.pieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartsData.pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={5}
                            label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {chartsData.pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(val: number) => formatMoney(val, baseCurrencySymbol)} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-secondary dark:text-gray-300">
                        Chưa có dữ liệu
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap justify-center gap-3">
                    {chartsData.pieData.map((entry, index) => (
                      <div key={entry.name} className="flex items-center gap-2 text-sm font-medium">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                        {entry.name}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/30">
                  <h4 className="font-label text-sm uppercase tracking-widest font-bold text-secondary dark:text-gray-300 mb-6 text-center">Chi tiêu theo Ngày</h4>
                  <div className="h-64 w-full">
                    {chartsData.barData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartsData.barData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(val) => {
                            if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                            if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                            return val;
                          }} />
                          <Tooltip
                            cursor={{ fill: '#F3F4F6' }}
                            formatter={(val: number) => [formatMoney(val, baseCurrencySymbol), 'Tổng chi']}
                            labelFormatter={(label) => `Ngày ${label}`}
                          />
                          <Bar dataKey="value" fill="#33B1FF" radius={[4, 4, 0, 0]} maxBarSize={50} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-secondary dark:text-gray-300">
                        Chưa có dữ liệu
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/30">
                <h4 className="font-label text-sm uppercase tracking-widest font-bold text-secondary dark:text-gray-300 mb-6 text-center">Người chi nhiều nhất</h4>
                <div className="h-72 w-full">
                  {chartsData.memberData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartsData.memberData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(val) => {
                          if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                          if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                          return val;
                        }} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} width={100} />
                        <Tooltip
                          cursor={{ fill: '#F3F4F6' }}
                          formatter={(val: number) => [formatMoney(val, baseCurrencySymbol), 'Đã chi']}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                          {chartsData.memberData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-secondary dark:text-gray-300">
                      Chưa có dữ liệu
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.section>

      <Modal isOpen={isAddOpen} onClose={() => { if (!isSubmitting) { setIsAddOpen(false); setEditingExpense(null); setSubmitError(null); } }} title={editingExpense ? "Sửa chi tiêu" : "Thêm chi tiêu"}>
        <form ref={formRef} onSubmit={handleAddExpense} className="space-y-4">
          {!editingExpense && (
            <div className="pb-2 border-b border-surface-variant/30 overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth">
              <div className="flex gap-2 w-max px-1">
                {EXPENSE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyTemplate(preset.title, preset.category)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-variant transition-colors border border-outline-variant/30 font-label text-sm font-semibold active:scale-95 text-secondary dark:text-gray-300"
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {submitError && (
            <div className="rounded-xl bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
              {submitError}
            </div>
          )}
          <div>
            <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Nội dung chi tiêu</label>
            <input required name="title" type="text" defaultValue={editingExpense?.title || ''} placeholder="VD: Ăn trưa..." className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Số tiền</label>
              <FormattedNumberInput required name="originalAmount" defaultValue={editingExpense?.originalAmount || editingExpense?.amount || ''} placeholder="VD: 500.000" className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Tiền tệ</label>
              <select name="currency" value={selectedCurrency} onChange={handleCurrencyChange} className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
                {Object.entries(CURRENCIES).map(([code, { name }]) => (
                  <option key={code} value={code}>{code} - {name}</option>
                ))}
              </select>
            </div>
          </div>
          {selectedCurrency !== baseCurrency && (
            <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30">
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Tỉ giá (1 {selectedCurrency} = ? {baseCurrency})</label>
              <input required name="exchangeRate" type="number" step="0.0001" value={exchangeRate} onChange={(e) => setExchangeRate(Number(e.target.value))} className="density-control w-full rounded-lg bg-surface border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
              <p className="text-[10px] text-secondary dark:text-gray-300 mt-1">Tỉ giá tham khảo, bạn có thể điều chỉnh.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Ngày</label>
              <input required name="date" type="date" defaultValue={editingExpense?.date || getLocalDateString()} className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div>
              <CategorySelectWithCreate
                name="category"
                label="Danh mục"
                options={expenseCategoryOptions}
                defaultValue={editingExpense?.category || 'Ăn uống'}
                fallbackValue="Ăn uống"
                className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                createLabel="Thêm danh mục chi tiêu mới"
                resetKey={editingExpense?.id ?? 'new-expense'}
              />
            </div>
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Người trả tiền</label>
            <select required name="paidBy" defaultValue={editingExpense?.paidBy || ''} className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
              {trip.members.map(m => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Chia cho ai? (Mặc định: Tất cả)</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {trip.members.map(m => (
                <label key={m.id} className="flex items-center gap-2 bg-surface-container-low px-3 py-2 rounded-lg cursor-pointer hover:bg-surface-container-high transition-colors">
                  <input type="checkbox" name="participants" value={m.id} defaultChecked={editingExpense ? editingExpense.participants.includes(m.id) : true} className="rounded text-primary dark:text-white focus:ring-primary" />
                  <span className="text-sm">{m.displayName}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Ghi chú</label>
            <input name="note" type="text" defaultValue={editingExpense?.note || ''} placeholder="Ghi chú thêm..." className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Link Hình ảnh / Hoá đơn</label>
            <input name="receiptImage" type="url" defaultValue={editingExpense?.receiptImage || ''} placeholder="https://..." className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm" />
          </div>
          <div className="pt-4">
            <button type="submit" disabled={isSubmitting} className="density-button w-full bg-primary text-on-primary rounded-xl font-bold hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? 'Đang lưu...' : editingExpense ? "Lưu thay đổi" : "Thêm chi tiêu"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isBudgetSettingsOpen} onClose={() => setIsBudgetSettingsOpen(false)} title="Ngân sách danh mục & tỉ giá">
        <form onSubmit={saveBudgetSettings} className="space-y-6">
          <section>
            <p className="mb-3 font-label text-xs font-bold uppercase tracking-[0.22em] text-secondary dark:text-gray-300">Ngân sách danh mục ({baseCurrency})</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {expenseCategoryOptions.map(({ value: category, label }) => (
                <label key={category} className="block rounded-2xl bg-surface-container-low p-3">
                  <span className="mb-1 block text-xs font-bold text-secondary dark:text-gray-300">{label}</span>
                  <FormattedNumberInput
                    name={`budget-${category}`}
                    defaultValue={trip.categoryBudgets?.[category] ?? ''}
                    placeholder="Không giới hạn"
                    className="density-control w-full rounded-xl border border-outline-variant/50 bg-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
              ))}
            </div>
          </section>
          <section>
            <p className="mb-3 font-label text-xs font-bold uppercase tracking-[0.22em] text-secondary dark:text-gray-300">Tỉ giá riêng cho chuyến đi</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(CURRENCIES) as Currency[]).filter((currency) => currency !== baseCurrency).map((currency) => {
                const defaultRate = CURRENCIES[currency].defaultRateToVND / CURRENCIES[baseCurrency].defaultRateToVND;
                return (
                  <label key={currency} className="block rounded-2xl bg-surface-container-low p-3">
                    <span className="mb-1 block text-xs font-bold text-secondary dark:text-gray-300">1 {currency} = ? {baseCurrency}</span>
                    <input
                      name={`rate-${currency}`}
                      type="number"
                      step="0.0001"
                      min="0"
                      defaultValue={trip.exchangeRates?.[currency] ?? defaultRate}
                      className="density-control w-full rounded-xl border border-outline-variant/50 bg-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </label>
                );
              })}
            </div>
          </section>
          <button type="submit" className="density-button w-full rounded-xl bg-primary font-bold text-on-primary transition hover:opacity-90">
            Lưu cấu hình
          </button>
        </form>
      </Modal>

      <Modal isOpen={!!settlementMemberId} onClose={() => setSettlementMemberId(null)} title="Chi tiết Quyết toán Đa tiền tệ">
        {settlementMemberId && (() => {
          const member = trip.members.find(m => m.id === settlementMemberId);
          const mBals = Object.entries(detailedBalances)
            .map(([cur, bals]) => ({ currency: cur, amount: bals[settlementMemberId] || 0 }))
            .filter(b => Math.abs(b.amount) > 0.01);

          return (
            <div className="space-y-6">
              <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-xl border border-outline-variant/30">
                <img src={member?.avatar} alt={member?.displayName} className="w-14 h-14 rounded-full border-2 border-surface shadow-sm" />
                <div>
                  <p className="font-bold font-headline text-lg text-on-surface">{member?.displayName}</p>
                  <p className="text-sm text-secondary dark:text-gray-300">Công nợ chi tiết theo từng loại tiền</p>
                </div>
              </div>
              {mBals.length === 0 ? (
                <div className="text-center py-8">
                  <Icons.Wallet className="w-12 h-12 mx-auto text-tertiary opacity-50 mb-3" />
                  <p className="text-secondary dark:text-gray-300 font-medium tracking-wide">Không phát sinh công nợ.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {mBals.map(b => {
                    const isOwed = b.amount > 0.01;
                    const owes = b.amount < -0.01;
                    const symbol = CURRENCIES[b.currency as Currency]?.symbol || b.currency;
                    return (
                      <div key={b.currency} className="relative group rounded-2xl overflow-hidden mb-3 ring-1 ring-surface-variant/30">
                        <div className="absolute inset-0 flex justify-between items-center pointer-events-none opacity-80">
                          <div className="flex flex-1 h-full items-center justify-start pl-4 select-none bg-primary/20 text-primary dark:bg-primary/40 dark:text-white">
                            <Check className="w-5 h-5 flex-shrink-0" />
                            <span className="ml-2 font-bold text-xs uppercase tracking-widest">Đã Quyết Toán</span>
                          </div>
                          <div className="flex flex-1 h-full items-center justify-end pr-4 select-none bg-primary/20 text-primary dark:bg-primary/40 dark:text-white">
                            <span className="mr-2 font-bold text-xs uppercase tracking-widest">Đã Quyết Toán</span>
                            <Check className="w-5 h-5 flex-shrink-0" />
                          </div>
                        </div>
                        <motion.div
                          drag="x"
                          dragConstraints={{ left: 0, right: 0 }}
                          dragElastic={0.4}
                          onDragEnd={async (event, info) => {
                            if (!canEdit) return;
                            if (info.offset.x > 80 || info.offset.x < -80) {
                              try {
                                const amountAction = Math.abs(b.amount);
                                // Determine correct paidBy/participants direction
                                // If member owes (b.amount < 0): member pays → paidBy = member, participants = creditor(s)
                                // If member is owed (b.amount > 0): debtor pays → paidBy = debtor, participants = [member]
                                let payer: string;
                                let recipients: string[];
                                if (b.amount < -0.01) {
                                  // Member owes money → they are the payer
                                  payer = settlementMemberId;
                                  const creditor = tripMembers.find(m => m.id !== settlementMemberId && (balances[m.id] || 0) > 0.01);
                                  recipients = creditor ? [creditor.id] : tripMembers.filter(m => m.id !== settlementMemberId).map(m => m.id);
                                } else {
                                  // Member is owed money → find a debtor to pay them
                                  const debtor = tripMembers.find(m => m.id !== settlementMemberId && (balances[m.id] || 0) < -0.01);
                                  payer = debtor ? debtor.id : settlementMemberId;
                                  recipients = [settlementMemberId];
                                }
                                await addExpense({
                                  tripId: trip.id,
                                  date: getLocalDateString(),
                                  time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                                  title: `Quyết toán nhanh nợ ${b.currency}`,
                                  category: 'Khác',
                                  amount: amountAction * getExchangeRateToBaseCurrency(b.currency as Currency),
                                  originalAmount: amountAction,
                                  currency: b.currency as Currency,
                                  exchangeRate: getExchangeRateToBaseCurrency(b.currency as Currency),
                                  paidBy: payer,
                                  participants: recipients,
                                  note: 'Chốt nợ bằng thao tác vuốt',
                                  isSettlement: true,
                                });
                                showToast({ tone: 'success', title: 'Hoàn tất', message: 'Đã cập nhật công nợ.' });
                              } catch (error) {
                                showToast({ tone: 'error', title: 'Lỗi', message: getErrorMessage(error, 'Không thể quyết toán.') });
                              }
                            }
                          }}
                          className={`relative z-10 p-5 bg-surface-container-lowest w-full flex justify-between items-center cursor-grab active:cursor-grabbing ${isOwed ? 'border-l-4 border-l-tertiary border-y border-transparent -my-[1px]' : 'border-l-4 border-l-error border-y border-transparent -my-[1px]'}`}
                        >
                          <div className="flex flex-col">
                            <span className="font-extrabold text-xl font-headline tracking-tighter text-on-surface">{b.currency}</span>
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${isOwed ? 'text-tertiary' : 'text-error'}`}>{isOwed ? 'Nhận lại' : 'Cần trả thêm'}</span>
                          </div>
                          <div className={`font-extrabold text-2xl font-headline tracking-tighter ${isOwed ? 'text-tertiary' : 'text-error'}`}>
                            {isOwed ? '+' : '-'}{formatMoney(Math.abs(b.amount), symbol)}
                          </div>
                        </motion.div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="pt-6 border-t border-outline-variant/30 flex justify-between items-end">
                <div className="flex flex-col">
                  <span className="font-label text-[10px] font-bold uppercase tracking-widest text-secondary dark:text-gray-300">Tổng quy đổi</span>
                  <span className="text-sm font-medium text-on-surface-variant">Về {baseCurrency}</span>
                </div>
                <p className={`font-extrabold text-2xl font-headline tracking-tighter ${(balances[settlementMemberId] || 0) > 0 ? 'text-tertiary' : ((balances[settlementMemberId] || 0) < 0 ? 'text-error' : 'text-on-surface')}`}>
                  {balances[settlementMemberId] > 0 ? '+' : (balances[settlementMemberId] < 0 ? '-' : '')}{formatMoney(Math.abs(balances[settlementMemberId] || 0), CURRENCIES[baseCurrency]?.symbol)}
                </p>
              </div>
            </div>
          );
        })()}
      </Modal>

    </motion.div>
  );
}
