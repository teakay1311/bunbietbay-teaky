import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { TripRecord, Activity, SavedPlace, PackingItem, Expense, Photo } from '../context/AppContext';
import { formatLocalDate } from './date';
import { getCategoryLabel, PLACE_TYPE_OPTIONS } from './tripCategories';

type ExportData = {
    trip: TripRecord;
    activities: Activity[];
    places: SavedPlace[];
    packing: PackingItem[];
    expenses: Expense[];
    photos: Photo[];
};

function formatMoney(amount: number, currency: string = 'đ') {
    return amount.toLocaleString() + ' ' + currency;
}

function generateMarkdown(data: ExportData): string {
    const { trip, activities, places, packing, expenses } = data;
    const billableExpenses = expenses.filter((expense) => !expense.isSettlement);
    const baseCurrency = trip.baseCurrency ?? 'VND';

    let md = `# Sổ Tay Chuyến Đi: ${trip.title}\n\n`;
    md += `**Địa điểm:** ${trip.location}\n`;
    const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
    md += `**Thời gian:** ${formatLocalDate(trip.startDate, opts)} - ${formatLocalDate(trip.endDate, opts)}\n`;
    md += `**Trạng thái:** ${trip.status === 'completed' ? 'Đã hoàn thành' : trip.status === 'draft' ? 'Bản nháp' : 'Sắp tới'}\n`;
    if (trip.budget > 0) {
        const spent = billableExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        md += `**Ngân sách:** ${formatMoney(trip.budget, baseCurrency)}\n`;
        md += `**Đã chi:** ${formatMoney(spent, baseCurrency)}\n`;
    }
    md += `\n---\n\n`;

    // === LỊCH TRÌNH ===
    md += `## Lịch Trình (Activities)\n\n`;
    const sortedDates = [...new Set(activities.map(a => a.date))].sort();
    if (sortedDates.length === 0) {
        md += `*Chưa có lịch trình nào được lưu.*\n\n`;
    } else {
        for (const date of sortedDates) {
            md += `### Ngày ${formatLocalDate(date, opts)}\n`;
            const dailyActivities = activities.filter(a => a.date === date).sort((a, b) => a.time.localeCompare(b.time));
            for (const act of dailyActivities) {
                md += `- **[${act.time}] ${act.title}**\n`;
                if (act.location) md += `  - Địa điểm: ${act.location}\n`;
                if (act.note) md += `  - Ghi chú: ${act.note}\n`;
            }
            md += `\n`;
        }
    }

    // === ĐỊA ĐIỂM ===
    md += `## Địa Điểm Đã Lưu (Saved Places)\n\n`;
    if (places.length === 0) {
        md += `*Chưa có địa điểm nào được lưu.*\n\n`;
    } else {
        for (const place of places) {
            md += `### ${place.name} (${getCategoryLabel(PLACE_TYPE_OPTIONS, place.type)}) - ${place.rating}/5 sao\n`;
            if (place.address) md += `- **Địa chỉ:** ${place.address}\n`;
            if (place.phone) md += `- **SĐT:** ${place.phone}\n`;
            if (place.note) md += `- **Ghi chú:** ${place.note}\n`;
            md += `\n`;
        }
    }

    // === HÀNH LÝ ===
    md += `## Hành Lý Cần Chuẩn Bị (Packing List)\n\n`;
    if (packing.length === 0) {
        md += `*Không có đồ đạc nào được lưu.*\n\n`;
    } else {
        for (const item of packing) {
            md += `- [${item.isPacked ? 'x' : ' '}] ${item.name} (${item.category})\n`;
        }
        md += `\n`;
    }

    // === CHI TIÊU ===
    md += `## Ghi Nhận Chi Tiêu (Expenses)\n\n`;
    if (expenses.length === 0) {
        md += `*Chưa có khoản chi nào.*\n\n`;
    } else {
        for (const expense of expenses) {
            const displayCurrency = expense.currency ?? baseCurrency;
            const displayAmount = expense.originalAmount ?? expense.amount;
            const convertedLabel = displayCurrency !== baseCurrency
                ? ` (quy đổi ${formatMoney(expense.amount, baseCurrency)})`
                : '';
            const settlementLabel = expense.isSettlement ? ' _(quyết toán)_' : '';
            md += `- **${expense.title}**: ${formatMoney(displayAmount, displayCurrency)}${convertedLabel}${settlementLabel}\n`;
            if (expense.category) md += `  - Danh mục: ${expense.category}\n`;
            if (expense.note) md += `  - Ghi chú: ${expense.note}\n`;
            md += `  - Thời gian: ${formatLocalDate(expense.date, opts)}\n`;
        }
        md += `\n`;
    }

    return md;
}

function escapeCsv(value: unknown) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function generateExpensesCsv(expenses: Expense[]) {
    const header = ['date', 'time', 'title', 'category', 'amount', 'originalAmount', 'currency', 'paidBy', 'participants', 'note', 'isSettlement'];
    const rows = expenses.map((expense) => [
        expense.date,
        expense.time,
        expense.title,
        expense.category,
        expense.amount,
        expense.originalAmount ?? '',
        expense.currency ?? '',
        expense.paidBy,
        expense.participants.join(';'),
        expense.note ?? '',
        expense.isSettlement ? 'yes' : 'no',
    ]);
    return [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function formatIcsDate(date: string, time: string) {
    const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? time : '09:00';
    return `${date.replaceAll('-', '')}T${normalizedTime.replace(':', '')}00`;
}

function generateIcs(data: ExportData) {
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Bunbietbay Trips//Trip Export//VI',
    ];
    data.activities.forEach((activity) => {
        const start = formatIcsDate(activity.date, activity.time);
        lines.push(
            'BEGIN:VEVENT',
            `UID:${activity.id}@bunbietbay-trips`,
            `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
            `DTSTART:${start}`,
            `SUMMARY:${activity.title.replaceAll('\n', ' ')}`,
            `LOCATION:${activity.location.replaceAll('\n', ' ')}`,
            `DESCRIPTION:${(activity.note || '').replaceAll('\n', '\\n')}`,
            'END:VEVENT',
        );
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
}

function generatePhotoManifest(photos: Photo[]) {
    return photos.map((photo) => ({
        id: photo.id,
        album: photo.album,
        itemType: photo.itemType ?? 'photo',
        storage: photo.storage,
        provider: photo.provider,
        url: photo.url.startsWith('data:') ? '[embedded-data-url]' : photo.url,
        takenOn: photo.takenOn,
        place: photo.place,
        tags: photo.tags,
        people: photo.people,
        content: photo.itemType === 'journal' ? photo.content : undefined,
    }));
}

export async function processTripExport(data: ExportData) {
    const zip = new JSZip();

    // Create formatted Markdown summary
    const markdownContent = generateMarkdown(data);
    zip.file(`Chi_Tiet_Chuyen_Di_${data.trip.title}.md`, markdownContent);

    // Create JSON backup
    const jsonContent = JSON.stringify(data, null, 2);
    zip.file(`Backup_Data_${data.trip.title}.json`, jsonContent);
    zip.file(`Chi_Tieu_${data.trip.title}.csv`, generateExpensesCsv(data.expenses));
    zip.file(`Lich_Trinh_${data.trip.title}.ics`, generateIcs(data));
    zip.file(`Photo_Manifest_${data.trip.title}.json`, JSON.stringify(generatePhotoManifest(data.photos), null, 2));

    // Generate ZIP
    const blob = await zip.generateAsync({ type: 'blob' });
    const fileName = `Export_${data.trip.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().getTime()}.zip`;

    saveAs(blob, fileName);
}
