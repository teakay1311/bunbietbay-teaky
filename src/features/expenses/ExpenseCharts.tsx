import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type ChartDatum = { name: string; value: number };
type DateDatum = { date: string; value: number };

type ExpenseChartsProps = {
  pieData: ChartDatum[];
  barData: DateDatum[];
  memberData: ChartDatum[];
  currencySymbol: string;
  formatMoney: (amount: number, currency?: string) => string;
};

const COLORS = ['#8A3FFC', '#33B1FF', '#007D79', '#FF7EB3', '#FA4D56', '#F1C21B', '#0043CE'];
const formatAxisValue = (value: number) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value >= 1_000 ? `${(value / 1_000).toFixed(0)}k` : String(value);

export function ExpenseCharts({ pieData, barData, memberData, currencySymbol, formatMoney }: ExpenseChartsProps) {
  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/30">
          <h4 className="font-label text-sm uppercase tracking-widest font-bold text-secondary dark:text-gray-300 mb-6 text-center">Phân bổ Danh mục</h4>
          <div className="h-64 w-full">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatMoney(value, currencySymbol)} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {pieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2 text-sm font-medium">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                {entry.name}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/30">
          <h4 className="font-label text-sm uppercase tracking-widest font-bold text-secondary dark:text-gray-300 mb-6 text-center">Chi tiêu theo Ngày</h4>
          <div className="h-64 w-full">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={formatAxisValue} />
                  <Tooltip cursor={{ fill: '#F3F4F6' }} formatter={(value: number) => [formatMoney(value, currencySymbol), 'Tổng chi']} labelFormatter={(label) => `Ngày ${label}`} />
                  <Bar dataKey="value" fill="#33B1FF" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </div>
      </div>

      <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/30">
        <h4 className="font-label text-sm uppercase tracking-widest font-bold text-secondary dark:text-gray-300 mb-6 text-center">Người chi nhiều nhất</h4>
        <div className="h-72 w-full">
          {memberData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={memberData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={formatAxisValue} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} width={100} />
                <Tooltip cursor={{ fill: '#F3F4F6' }} formatter={(value: number) => [formatMoney(value, currencySymbol), 'Đã chi']} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                  {memberData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>
      </div>
    </div>
  );
}

function EmptyChart() {
  return <div className="w-full h-full flex flex-col items-center justify-center text-secondary dark:text-gray-300">Chưa có dữ liệu</div>;
}
