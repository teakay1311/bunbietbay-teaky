import { createContext, useContext, useState, ReactNode, useMemo } from 'react';

export type Currency = 'VND' | 'USD' | 'EUR' | 'JPY' | 'KRW' | 'THB' | 'SGD';

export const CURRENCIES: Record<Currency, { symbol: string, name: string, defaultRateToVND: number }> = {
  VND: { symbol: 'đ', name: 'Việt Nam Đồng', defaultRateToVND: 1 },
  USD: { symbol: '$', name: 'Đô la Mỹ', defaultRateToVND: 25000 },
  EUR: { symbol: '€', name: 'Euro', defaultRateToVND: 27000 },
  JPY: { symbol: '¥', name: 'Yên Nhật', defaultRateToVND: 170 },
  KRW: { symbol: '₩', name: 'Won Hàn Quốc', defaultRateToVND: 19 },
  THB: { symbol: '฿', name: 'Baht Thái', defaultRateToVND: 700 },
  SGD: { symbol: 'S$', name: 'Đô la Singapore', defaultRateToVND: 18500 },
};

export type Member = {
  id: string;
  name: string;
  avatar: string;
  role: string;
  phone?: string;
  email?: string;
  birthdate?: string;
};

export type Activity = {
  id: string;
  tripId: string;
  date: string;
  time: string;
  title: string;
  location: string;
  note: string;
  type: 'flight' | 'hotel' | 'restaurant' | 'activity';
  image?: string;
  mapUrl?: string;
};

export type Expense = {
  id: string;
  tripId: string;
  date: string;
  time: string;
  title: string;
  category: string;
  amount: number; // Converted amount in baseCurrency
  originalAmount?: number; // Original amount in selected currency
  currency?: Currency;
  exchangeRate?: number;
  paidBy: string;
  participants: string[];
  note?: string;
  receiptImage?: string;
  isSettlement?: boolean;
};

export type SavedPlace = {
  id: string;
  tripId: string;
  name: string;
  type: 'hotel' | 'restaurant' | 'other';
  phone?: string;
  address?: string;
  rating?: number;
  note?: string;
};

export type PackingItem = {
  id: string;
  tripId: string;
  name: string;
  isPacked: boolean;
  assigneeId?: string;
  category: 'clothes' | 'electronics' | 'toiletries' | 'documents' | 'other';
};

export type Photo = {
  id: string;
  tripId: string;
  url: string; // Base64 or Object URL
  album: string;
  createdAt: string;
};

export type TripReview = {
  transport: number;
  accommodation: number;
  food: number;
  entertainment: number;
  memory: string;
};

export type Trip = {
  id: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  budget: number;
  baseCurrency?: Currency;
  status: 'upcoming' | 'completed' | 'draft';
  image: string;
  memberIds: string[];
  review?: TripReview;
};

// Derived types for UI
export type CalculatedMember = Member & {
  spent: number;
  balance: number;
};

export type CalculatedTrip = Trip & {
  spent: number;
  members: CalculatedMember[];
};

type AppContextType = {
  trips: CalculatedTrip[];
  activities: Activity[];
  expenses: Expense[];
  savedPlaces: SavedPlace[];
  packingItems: PackingItem[];
  photos: Photo[];
  currentTripId: string | null;
  setCurrentTripId: (id: string | null) => void;
  // Actions
  addExpense: (expense: Omit<Expense, 'id'>) => void;
  editExpense: (id: string, expense: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  addActivity: (activity: Omit<Activity, 'id'>) => void;
  editActivity: (id: string, activity: Partial<Activity>) => void;
  deleteActivity: (id: string) => void;
  addTrip: (trip: Omit<Trip, 'id' | 'status' | 'memberIds'>) => void;
  editTrip: (id: string, trip: Partial<Trip>) => void;
  addMemberToTrip: (tripId: string, member: Omit<Member, 'id'>) => void;
  editMember: (id: string, member: Partial<Member>) => void;
  updateTripReview: (tripId: string, review: TripReview) => void;
  addSavedPlace: (place: Omit<SavedPlace, 'id'>) => void;
  deleteSavedPlace: (id: string) => void;
  addPackingItem: (item: Omit<PackingItem, 'id'>) => void;
  togglePackingItem: (id: string) => void;
  deletePackingItem: (id: string) => void;
  addPhoto: (photo: Omit<Photo, 'id' | 'createdAt'>) => void;
  deletePhoto: (id: string) => void;
};

const INITIAL_MEMBERS: Member[] = [
  { id: 'm1', name: 'Linh', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB0axwP9lgNRHwMhgQg8o_A38FYU192IL-Brw47kLpK0ae71w5EM7Iy9NCmxVktkY2U6EaFHYThADWuAliM4JjIEwXBKYl6zBuE4Wp777RwEnPtTDnhdhN_TmGW3SduzGpioLMSNgI6cJ8T8ogbSi62Eu69DOz9HZK4miZtSdvXey8Ogx4JHLni2id0spjwDTAyqPRkxt9eJ3ACkaakTeycv0rPLPrI1RsnBbNCPA-DMtFXNuMG2YUZYAJggUI09l1cUl92N-qUSKM', role: 'Thanh toán nhiều nhất', phone: '0901234567', email: 'linh@example.com', birthdate: '1995-05-15' },
  { id: 'm2', name: 'Kiên', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAb8wDBVIGTYQbEOiMj7CaWqb7U1RZ_W15xHFYn3o2XxoHlz2-G6zR0COmZMNPmbacvKEjkaulnTWox8L97opSekR-n64rK0rW1-RMYS0Kzw3Rlf8_u1Pf614esw6Tyv8DyVUIUZyCVDfARBP6VsABaRcDmiQeB4GxW34R0LFGZlii9ld8aE2VuCddP7iFHd5ZQHzMFggFZbPQXdtVxEc8Jr_ix-ARk5GYUGjl23LEHZvHfEWbJ4lXQ3iapeZyhowNpuUyw5aT2rrQ', role: 'Thủ quỹ', phone: '0987654321', email: 'kien@example.com', birthdate: '1996-08-20' },
  { id: 'm3', name: 'An', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCI51_4DUsEzLnF8-0imiLYC7peU7S9fdO1huNWRReg1DSlKBMiX76LS9ssVv0LEcjKwCltyp_j598StyHgRqbyQ1BSbcQ5Nrsj2AYgc2yGfua_MOXxY6k-pfZxz21hbVi8z3on23SzmBbqYEG599S8pOU5jw0jLi9LeU7pVHeRcHf5skQiOcFOqfszGOAduyfgOxXcB0OKxMEyBWkLlOkXBwPmqZghOMfiCHFWo1O5baFS8mJ0VnczxJ9pZ6Uaf22SxekfUG4mqOk', role: 'Thành viên', phone: '0912345678', email: 'an@example.com', birthdate: '1997-12-10' },
  { id: 'm4', name: 'Tú', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCgizevJESOziohbkybzKeKnW-6M16pJ47M1YdvjYfHX3bjSGyBGHRXiVdBpsZPsGnhhwGM7CmU044KnqnCCThhyFDMF8MsLu5MCftsTp4Gdlp7PUps9lcpizc_ioWoghftcgdiYPUgE6OTDL1GofB24xDs_0rDCdOmsBb6hH9zxFqs257mE2u2qDc8G6SZGrWbc26yPTGedEoWq7fJ9tIGXJdqQlsdgQzs88z-3sfAHF3FI5Jn44ywzKNLYDBycMHW1JJajv4x4Pg', role: 'Thành viên', phone: '0934567890', email: 'tu@example.com', birthdate: '1998-03-25' },
];

const INITIAL_TRIPS: Trip[] = [
  {
    id: 't1',
    title: 'Mùa thu ở Paris',
    location: 'Paris, Pháp',
    startDate: '2024-10-15',
    endDate: '2024-10-22',
    budget: 120000000,
    baseCurrency: 'VND',
    status: 'upcoming',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD3My1vzcXuuA8RA7cyl--tN97brueWbvbQ0ozGWDhYSfnGRfMDhBbjn1ZFRL-PVRyQPu1cky_Dt3rF1Q8HGbrL7HArF6kpNEniu5MXRckaBTyyzcRB-dgSnZmuo0mvVWHk-OFPYDIgTWRXC-CE7NlMY4IBXnm9YcQef6fTrySlZBEMcrNYRC1vWtoznFDDS5711i2tkawFfE5saUg7ReOqJnR7UKbAel88-O8SMpCSsqJ2CDNV-UL1PYTdikIMMMz9bXNUtaXvdVk',
    memberIds: ['m1', 'm2', 'm3', 'm4'],
  },
  {
    id: 't2',
    title: 'Tokyo Neon Lights',
    location: 'Tokyo, Nhật Bản',
    startDate: '2024-03-05',
    endDate: '2024-03-12',
    budget: 85000000,
    baseCurrency: 'VND',
    status: 'completed',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIb2ZVyZNEQjzdHjOjuRMVFrBpAFOjtzuoHiDBxU86PAe-ezFgxQhiO1dEW9Dd_dthTYv3O0UugpJAUoeWCszsBWk18cxfUEuOiDxVx4P-Oeuzk-yK1M2TuL8gtidh4KgSvEIuaFZx6GpSHVYSRHWKMqSg085sWFTEjFtNUDbn5DYVT8yqAIX1A55tMzEyuDKE9RFxNI0oJ74yWmd-Cm4agi_q6hVZmY-Ci7fr4FiQcdSUGEOBMYayRcCDsqWcnR_VENf4DYq0Dho',
    memberIds: ['m2'],
  },
  {
    id: 't3',
    title: 'Mùa Thu Tại Đà Lạt',
    location: 'Đà Lạt, Việt Nam',
    startDate: '2024-10-15',
    endDate: '2024-10-20',
    budget: 25000000,
    baseCurrency: 'VND',
    status: 'upcoming',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCAK0AxW6C4ZJMckVsVGUGnnGTlowZl8V9_3NkILNNWJkf5tRx0KcQKduV4x0rc90Ig-e4f-9PJnwRIgo1lMSarVrOuU-hzwjOUGRObxSQ1mBIUwUDDBUOwfW5ToGKuIQK5Gjm9Uhr_vrgj47LC0Vnor3e3USZn6aHLk8G2urnuW72DgFtsz8WOy6FVtBtZHK6zVfyUoOLkHbVxib4WNutN-r2eCaRLGnsVE4llne_dvGzTwo8ZF1c0hvGxBzCOCuyq82wiLeikIyo',
    memberIds: ['m1', 'm2', 'm3', 'm4'],
  }
];

const INITIAL_ACTIVITIES: Activity[] = [
  {
    id: 'a1',
    tripId: 't3',
    date: '2024-10-15',
    time: '08:30 AM',
    title: 'Hạ cánh tại Liên Khương',
    location: 'Sân bay Liên Khương, Đức Trọng',
    note: 'Đã đặt xe trung chuyển về trung tâm thành phố (300k). Tài xế tên Hùng.',
    type: 'flight'
  },
  {
    id: 'a2',
    tripId: 't3',
    date: '2024-10-15',
    time: '11:00 AM',
    title: 'Check-in Khách sạn Ana Mandara',
    location: 'Đường Lê Hồng Phong, Phường 4',
    note: 'Gửi hành lý tại quầy lễ tân nếu chưa có phòng. Yêu cầu phòng hướng thung lũng.',
    type: 'hotel'
  },
  {
    id: 'a3',
    tripId: 't3',
    date: '2024-10-15',
    time: '12:30 PM',
    title: 'Ăn trưa: Bánh Căn Lệ',
    location: '27/44 Yersin, Phường 10',
    note: 'Thử bánh căn lòng đào. Quán khá đông nên đến sớm.',
    type: 'restaurant',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnqM47b0vlZDteFew8d4ceJZjHhghl7UnWirt-gkkyUMuFpXHtven6SI5apuEEVVTO0-__TZRNazp6QHY_kJd462ZLnKSwE7amFWXnkzNEKoEX2tMSHfeagbg9UZpxSpuaaHCMn8K-mh0qejtqKuuF2pvaoqkVewc3OiK6LKsaB-skDBhcAcMsMFkheImWLrOB5aUO5SRxJYpgK4dalO04RRVyXJqM_Ty0XOIJUwhjF972X7BKRvO_mfkELC-fgj5QixMz08is26U'
  },
  {
    id: 'a4',
    tripId: 't3',
    date: '2024-10-16',
    time: '09:00 AM',
    title: 'Săn mây đồi chè Cầu Đất',
    location: 'Đồi chè Cầu Đất, Xuân Trường',
    note: 'Dậy sớm từ 4h30 sáng. Thời tiết khá lạnh cần mang áo khoác.',
    type: 'activity'
  }
];

const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'e1',
    tripId: 't3',
    date: '2024-10-16',
    time: '08:30 AM',
    title: 'Vé máy bay khứ hồi',
    category: 'Di chuyển',
    amount: 7500000,
    originalAmount: 7500000,
    currency: 'VND',
    exchangeRate: 1,
    paidBy: 'm1',
    participants: ['m1', 'm2', 'm3', 'm4'],
    note: 'Vietnam Airlines - VN123'
  },
  {
    id: 'e2',
    tripId: 't3',
    date: '2024-10-16',
    time: '01:45 PM',
    title: 'Ăn trưa - Lẩu Gà Lá É',
    category: 'Ăn uống',
    amount: 850000,
    originalAmount: 850000,
    currency: 'VND',
    exchangeRate: 1,
    paidBy: 'm2',
    participants: ['m1', 'm2', 'm3', 'm4'],
    note: 'Tao Ngộ Quán'
  },
  {
    id: 'e3',
    tripId: 't3',
    date: '2024-10-17',
    time: '09:00 AM',
    title: 'Khách sạn 2 đêm',
    category: 'Lưu trú',
    amount: 3200000,
    originalAmount: 3200000,
    currency: 'VND',
    exchangeRate: 1,
    paidBy: 'm3',
    participants: ['m1', 'm2', 'm3', 'm4'],
    note: 'Hotel Colline Da Lat'
  },
  {
    id: 'e4',
    tripId: 't3',
    date: '2024-10-17',
    time: '03:00 PM',
    title: 'Vé tham quan Thác Datanla',
    category: 'Giải trí',
    amount: 900000,
    originalAmount: 900000,
    currency: 'VND',
    exchangeRate: 1,
    paidBy: 'm4',
    participants: ['m1', 'm2', 'm3', 'm4'],
    note: 'Cầu trượt & tham quan'
  }
];

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [baseTrips, setBaseTrips] = useState<Trip[]>(INITIAL_TRIPS);
  const [activities, setActivities] = useState<Activity[]>(INITIAL_ACTIVITIES);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [packingItems, setPackingItems] = useState<PackingItem[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [currentTripId, setCurrentTripId] = useState<string | null>('t3');

  // Dynamically calculate trip spent amounts and member balances based on expenses
  const calculatedTrips = useMemo(() => {
    return baseTrips.map(trip => {
      const tripExpenses = expenses.filter(e => e.tripId === trip.id);
      const tripSpent = tripExpenses
        .filter(exp => !exp.isSettlement)
        .reduce((sum, exp) => sum + exp.amount, 0);

      const calculatedMembers = trip.memberIds.flatMap(memberId => {
        const member = members.find(m => m.id === memberId);
        if (!member) {
          console.warn(`Missing member ${memberId} for trip ${trip.id}`);
          return [];
        }
        
        // Calculate how much this member paid
        const amountPaid = tripExpenses
          .filter(e => e.paidBy === memberId)
          .reduce((sum, exp) => sum + exp.amount, 0);

        // Calculate how much this member owes (their share of expenses)
        const amountOwed = tripExpenses
          .filter(e => e.participants.includes(memberId))
          .reduce((sum, exp) => sum + (exp.amount / exp.participants.length), 0);

        return [{
          ...member,
          spent: amountPaid,
          balance: amountPaid - amountOwed
        }];
      });

      return {
        ...trip,
        spent: tripSpent,
        members: calculatedMembers
      };
    });
  }, [baseTrips, expenses, members]);

  const addExpense = (expense: Omit<Expense, 'id'>) => {
    const newExpense = { ...expense, id: `e${Date.now()}` };
    setExpenses(prev => [...prev, newExpense]);
  };

  const editExpense = (id: string, expense: Partial<Expense>) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...expense } : e));
  };

  const deleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const addActivity = (activity: Omit<Activity, 'id'>) => {
    const newActivity = { ...activity, id: `a${Date.now()}` };
    setActivities(prev => [...prev, newActivity]);
  };

  const editActivity = (id: string, activity: Partial<Activity>) => {
    setActivities(prev => prev.map(a => a.id === id ? { ...a, ...activity } : a));
  };

  const deleteActivity = (id: string) => {
    setActivities(prev => prev.filter(a => a.id !== id));
  };

  const addTrip = (trip: Omit<Trip, 'id' | 'status' | 'memberIds'>) => {
    const newTrip: Trip = {
      ...trip,
      id: `t${Date.now()}`,
      status: 'upcoming',
      memberIds: ['m1'] // Default add current user (Linh)
    };
    setBaseTrips(prev => [newTrip, ...prev]);
  };

  const editTrip = (id: string, trip: Partial<Trip>) => {
    setBaseTrips(prev => prev.map(t => t.id === id ? { ...t, ...trip } : t));
  };

  const addMemberToTrip = (tripId: string, member: Omit<Member, 'id'>) => {
    const newMember: Member = { ...member, id: `m${Date.now()}` };
    setMembers(prev => [...prev, newMember]);
    setBaseTrips(prev => prev.map(t => t.id === tripId ? { ...t, memberIds: [...t.memberIds, newMember.id] } : t));
  };

  const editMember = (id: string, member: Partial<Member>) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, ...member } : m));
  };

  const updateTripReview = (tripId: string, review: TripReview) => {
    setBaseTrips(prev => prev.map(t => t.id === tripId ? { ...t, review } : t));
  };

  const addSavedPlace = (place: Omit<SavedPlace, 'id'>) => {
    setSavedPlaces(prev => [...prev, { ...place, id: `p${Date.now()}` }]);
  };

  const deleteSavedPlace = (id: string) => {
    setSavedPlaces(prev => prev.filter(p => p.id !== id));
  };

  const addPackingItem = (item: Omit<PackingItem, 'id'>) => {
    setPackingItems(prev => [...prev, { ...item, id: Math.random().toString(36).substr(2, 9) }]);
  };

  const togglePackingItem = (id: string) => {
    setPackingItems(prev => prev.map(item => item.id === id ? { ...item, isPacked: !item.isPacked } : item));
  };

  const deletePackingItem = (id: string) => {
    setPackingItems(prev => prev.filter(item => item.id !== id));
  };

  const addPhoto = (photo: Omit<Photo, 'id' | 'createdAt'>) => {
    setPhotos(prev => [{ ...photo, id: `ph${Date.now()}`, createdAt: new Date().toISOString() }, ...prev]);
  };

  const deletePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  return (
    <AppContext.Provider value={{
      trips: calculatedTrips,
      activities,
      expenses,
      savedPlaces,
      currentTripId,
      setCurrentTripId,
      addExpense,
      editExpense,
      deleteExpense,
      addActivity,
      editActivity,
      deleteActivity,
      addTrip,
      editTrip,
      addMemberToTrip,
      editMember,
      updateTripReview,
      addSavedPlace,
      deleteSavedPlace,
      packingItems,
      addPackingItem,
      togglePackingItem,
      deletePackingItem,
      photos,
      addPhoto,
      deletePhoto
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
