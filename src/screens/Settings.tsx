import { Layout } from '../components/Layout';
import { Icons } from '../components/Icons';
import { useSettings } from '../context/SettingsContext';

export function Settings() {
  const { themeMode, setThemeMode, primaryColor, setPrimaryColor, language, setLanguage } = useSettings();

  const colors = [
    { name: 'Teal', value: '#00515f' },
    { name: 'Blue', value: '#1d4ed8' },
    { name: 'Purple', value: '#6d28d9' },
    { name: 'Rose', value: '#be123c' },
    { name: 'Amber', value: '#b45309' },
    { name: 'Emerald', value: '#047857' },
  ];

  return (
    <Layout hideNavLinks>
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary">Cài đặt hệ thống</h1>
          <p className="text-secondary mt-2">Tuỳ chỉnh giao diện và trải nghiệm của bạn</p>
        </div>

        <div className="space-y-8">
          {/* Giao diện */}
          <section className="bg-surface-container-lowest p-6 rounded-2xl editorial-shadow">
            <h2 className="font-headline text-xl font-bold text-on-surface mb-6 flex items-center gap-2">
              <Icons.LayoutDashboard className="w-5 h-5 text-primary" />
              Giao diện
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block font-label text-sm font-bold text-secondary mb-3">Chế độ hiển thị</label>
                <div className="grid grid-cols-3 gap-4">
                  {(['light', 'dark', 'system'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setThemeMode(mode)}
                      className={`py-3 px-4 rounded-xl border-2 font-bold capitalize transition-all ${
                        themeMode === mode 
                          ? 'border-primary bg-primary/5 text-primary' 
                          : 'border-outline-variant text-secondary hover:border-primary/50'
                      }`}
                    >
                      {mode === 'system' ? 'Hệ thống' : mode === 'light' ? 'Sáng' : 'Tối'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-label text-sm font-bold text-secondary mb-3">Màu chủ đạo</label>
                <div className="flex flex-wrap gap-4">
                  {colors.map(color => (
                    <button
                      key={color.value}
                      onClick={() => setPrimaryColor(color.value)}
                      className={`w-12 h-12 rounded-full border-4 transition-all ${
                        primaryColor === color.value ? 'border-primary scale-110' : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Ngôn ngữ */}
          <section className="bg-surface-container-lowest p-6 rounded-2xl editorial-shadow">
            <h2 className="font-headline text-xl font-bold text-on-surface mb-6 flex items-center gap-2">
              <Icons.Globe className="w-5 h-5 text-primary" />
              Ngôn ngữ
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setLanguage('vi')}
                className={`py-3 px-4 rounded-xl border-2 font-bold transition-all ${
                  language === 'vi' 
                    ? 'border-primary bg-primary/5 text-primary' 
                    : 'border-outline-variant text-secondary hover:border-primary/50'
                }`}
              >
                Tiếng Việt
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`py-3 px-4 rounded-xl border-2 font-bold transition-all ${
                  language === 'en' 
                    ? 'border-primary bg-primary/5 text-primary' 
                    : 'border-outline-variant text-secondary hover:border-primary/50'
                }`}
              >
                English
              </button>
            </div>
          </section>

          {/* Phím tắt */}
          <section className="bg-surface-container-lowest p-6 rounded-2xl editorial-shadow">
            <h2 className="font-headline text-xl font-bold text-on-surface mb-6 flex items-center gap-2">
              <Icons.Command className="w-5 h-5 text-primary" />
              Phím tắt
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-outline-variant/30">
                <span className="text-on-surface">Tạo chuyến đi mới</span>
                <kbd className="px-2 py-1 bg-surface-container-high rounded text-sm font-mono text-secondary">Ctrl + N</kbd>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-outline-variant/30">
                <span className="text-on-surface">Tìm kiếm</span>
                <kbd className="px-2 py-1 bg-surface-container-high rounded text-sm font-mono text-secondary">Ctrl + K</kbd>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-outline-variant/30">
                <span className="text-on-surface">Mở cài đặt</span>
                <kbd className="px-2 py-1 bg-surface-container-high rounded text-sm font-mono text-secondary">Ctrl + ,</kbd>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
