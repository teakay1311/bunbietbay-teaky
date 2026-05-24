import { UserProfile } from '../context/AuthContext';
import { Currency, TripReview, TripRecord, TripMembership, TripInvitation, Activity, Expense, SavedPlace, PackingItem, Photo, PersistedAppState } from '../context/AppContext';
import { APP_STATE_VERSION } from '../utils/appState';

function createLocalProfile(id: string, displayName: string, email: string, avatar: string, phone?: string, birthdate?: string): UserProfile {
    return {
        id,
        displayName,
        email,
        avatar,
        phone,
        birthdate,
    };
}

export const INITIAL_PROFILES: UserProfile[] = [
    createLocalProfile('m1', 'Linh', 'linh@example.com', 'https://lh3.googleusercontent.com/aida-public/AB6AXuB0axwP9lgNRHwMhgQg8o_A38FYU192IL-Brw47kLpK0ae71w5EM7Iy9NCmxVktkY2U6EaFHYThADWuAliM4JjIEwXBKYl6zBuE4Wp777RwEnPtTDnhdhN_TmGW3SduzGpioLMSNgI6cJ8T8ogbSi62Eu69DOz9HZK4miZtSdvXey8Ogx4JHLni2id0spjwDTAyqPRkxt9eJ3ACkaakTeycv0rPLPrI1RsnBbNCPA-DMtFXNuMG2YUZYAJggUI09l1cUl92N-qUSKM', '0901234567', '1995-05-15'),
    createLocalProfile('m2', 'Kiên', 'kien@example.com', 'https://lh3.googleusercontent.com/aida-public/AB6AXuAb8wDBVIGTYQbEOiMj7CaWqb7U1RZ_W15xHFYn3o2XxoHlz2-G6zR0COmZMNPmbacvKEjkaulnTWox8L97opSekR-n64rK0rW1-RMYS0Kzw3Rlf8_u1Pf614esw6Tyv8DyVUIUZyCVDfARBP6VsABaRcDmiQeB4GxW34R0LFGZlii9ld8aE2VuCddP7iFHd5ZQHzMFggFZbPQXdtVxEc8Jr_ix-ARk5GYUGjl23LEHZvHfEWbJ4lXQ3iapeZyhowNpuUyw5aT2rrQ', '0987654321', '1996-08-20'),
    createLocalProfile('m3', 'An', 'an@example.com', 'https://lh3.googleusercontent.com/aida-public/AB6AXuCI51_4DUsEzLnF8-0imiLYC7peU7S9fdO1huNWRReg1DSlKBMiX76LS9ssVv0LEcjKwCltyp_j598StyHgRqbyQ1BSbcQ5Nrsj2AYgc2yGfua_MOXxY6k-pfZxz21hbVi8z3on23SzmBbqYEG599S8pOU5jw0jLi9LeU7pVHeRcHf5skQiOcFOqfszGOAduyfgOxXcB0OKxMEyBWkLlOkXBwPmqZghOMfiCHFWo1O5baFS8mJ0VnczxJ9pZ6Uaf22SxekfUG4mqOk', '0912345678', '1997-12-10'),
    createLocalProfile('m4', 'Tú', 'tu@example.com', 'https://lh3.googleusercontent.com/aida-public/AB6AXuCgizevJESOziohbkybzKeKnW-6M16pJ47M1YdvjYfHX3bjSGyBGHRXiVdBpsZPsGnhhwGM7CmU044KnqnCCThhyFDMF8MsLu5MCftsTp4Gdlp7PUps9lcpizc_ioWoghftcgdiYPUgE6OTDL1GofB24xDs_0rDCdOmsBb6hH9zxFqs257mE2u2qDc8G6SZGrWbc26yPTGedEoWq7fJ9tIGXJdqQlsdgQzs88z-3sfAHF3FI5Jn44ywzKNLYDBycMHW1JJajv4x4Pg', '0934567890', '1998-03-25'),
];

export const INITIAL_TRIPS: TripRecord[] = [
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
        createdBy: 'm1',
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
        createdBy: 'm2',
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
        createdBy: 'm1',
    }
];

export const INITIAL_MEMBERSHIPS: TripMembership[] = [
    { id: 'tm1', tripId: 't1', userId: 'm1', role: 'owner' },
    { id: 'tm2', tripId: 't1', userId: 'm2', role: 'admin' },
    { id: 'tm3', tripId: 't1', userId: 'm3', role: 'editor' },
    { id: 'tm4', tripId: 't1', userId: 'm4', role: 'viewer' },
    { id: 'tm5', tripId: 't2', userId: 'm2', role: 'owner' },
    { id: 'tm6', tripId: 't3', userId: 'm1', role: 'owner' },
    { id: 'tm7', tripId: 't3', userId: 'm2', role: 'admin' },
    { id: 'tm8', tripId: 't3', userId: 'm3', role: 'editor' },
    { id: 'tm9', tripId: 't3', userId: 'm4', role: 'viewer' },
];

export const INITIAL_ACTIVITIES: Activity[] = [
    {
        id: 'a1',
        tripId: 't3',
        date: '2024-10-15',
        time: '08:30 AM',
        title: 'Hạ cánh tại Liên Khương',
        location: 'Sân bay Liên Khương, Đức Trọng',
        note: 'Đã đặt xe trung chuyển về trung tâm thành phố (300k). Tài xế tên Hùng.',
        type: 'flight',
    },
    {
        id: 'a2',
        tripId: 't3',
        date: '2024-10-15',
        time: '11:00 AM',
        title: 'Check-in Khách sạn Ana Mandara',
        location: 'Đường Lê Hồng Phong, Phường 4',
        note: 'Gửi hành lý tại quầy lễ tân nếu chưa có phòng. Yêu cầu phòng hướng thung lũng.',
        type: 'hotel',
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
    },
    {
        id: 'a4',
        tripId: 't3',
        date: '2024-10-16',
        time: '09:00 AM',
        title: 'Săn mây đồi chè Cầu Đất',
        location: 'Đồi chè Cầu Đất, Xuân Trường',
        note: 'Dậy sớm từ 4h30 sáng. Thời tiết khá lạnh cần mang áo khoác.',
        type: 'activity',
    }
];

export const INITIAL_EXPENSES: Expense[] = [
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
        note: 'Vietnam Airlines - VN123',
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
        note: 'Tao Ngộ Quán',
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
        note: 'Hotel Colline Da Lat',
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
        note: 'Cầu trượt & tham quan',
    }
];

export const INITIAL_PERSISTED_STATE: PersistedAppState = {
    version: APP_STATE_VERSION,
    trips: INITIAL_TRIPS,
    profiles: INITIAL_PROFILES,
    memberships: INITIAL_MEMBERSHIPS,
    invitations: [],
    activities: INITIAL_ACTIVITIES,
    expenses: INITIAL_EXPENSES,
    savedPlaces: [],
    packingItems: [],
    photos: [],
    activityLogs: [],
    currentTripId: 't3',
    viewerProfileId: 'm1',
};
