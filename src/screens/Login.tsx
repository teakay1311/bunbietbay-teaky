import { Link } from 'react-router-dom';
import { Icons } from '../components/Icons';

export function Login() {
  return (
    <main className="flex-grow flex flex-col md:flex-row items-stretch overflow-hidden min-h-screen bg-surface">
      <section className="hidden md:flex md:w-1/2 lg:w-3/5 relative overflow-hidden bg-primary items-end p-16">
        <img alt="Cinematic view of misty mountains" className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-60" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAtPRM9j9_sjAd7en-WJmsiUeut9KrO9DvNAqHYW0NRgMJOr3V_skmerjzyQi68sqoYNMxLOTOZZbrbYOmEFxNWqlosJm6PZ2-cPL4O3v2JzE0ttdYq_ouUZ_LTGAgf_SlNPcxolNd1oVugr2Ld0DlCfNtJJ8cgyv44O9k5kFoCyGDaEE58kbiSG_xPQ5WVd6NW2bwqVtFjP02zIYi40hGq4nIn0rkYHQUTM3HRu_4muY6N3xTPfecojs9AceLO4eWwMTAfAO1OMYU" />
        <div className="absolute inset-0 editorial-gradient opacity-40"></div>
        <div className="relative z-10 max-w-lg">
          <div className="flex items-center gap-3 mb-8">
            <Icons.Compass className="w-10 h-10 text-on-primary" />
            <h1 className="font-headline font-extrabold text-3xl tracking-tighter text-on-primary">The Editorial Traveler</h1>
          </div>
          <h2 className="font-headline font-bold text-5xl text-on-primary leading-tight mb-6">
            Mỗi chuyến đi là <br />một câu chuyện mới.
          </h2>
          <div className="w-12 h-1 bg-tertiary-fixed rounded-full mb-6"></div>
          <p className="font-body text-primary-fixed/80 text-xl leading-relaxed">
            Khám phá thế giới, quản lý ngân sách và lưu giữ kỷ niệm với phong cách tinh tế nhất.
          </p>
        </div>
      </section>

      <section className="w-full md:w-1/2 lg:w-2/5 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20 bg-surface">
        <div className="md:hidden flex flex-col items-center mb-12 text-center">
          <Icons.Compass className="w-12 h-12 text-primary mb-4" />
          <h1 className="font-headline font-extrabold text-2xl tracking-tighter text-primary">The Editorial Traveler</h1>
        </div>

        <div className="max-w-md w-full mx-auto">
          <div className="mb-10 text-left">
            <h2 className="font-headline font-bold text-3xl text-on-surface mb-3 tracking-tight">Chào mừng bạn</h2>
            <p className="font-body text-secondary text-base leading-relaxed">
              Lên kế hoạch du lịch và quản lý chi tiêu dễ dàng. Bắt đầu hành trình của bạn ngay hôm nay.
            </p>
          </div>

          <Link to="/trips" className="w-full flex items-center justify-center gap-4 bg-surface-container-lowest py-4 px-6 rounded-xl border border-outline-variant/30 shadow-[0_12px_24px_rgba(0,0,0,0.03)] hover:bg-surface-container-low transition-all duration-300 group">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
            </svg>
            <span className="font-label font-bold text-on-surface tracking-wide">Đăng nhập bằng Google</span>
          </Link>

          <div className="relative my-10 flex items-center">
            <div className="flex-grow h-[1px] bg-outline-variant/30"></div>
            <span className="mx-4 font-label text-[10px] uppercase tracking-[0.2em] text-outline font-bold">Hoặc tiếp tục với</span>
            <div className="flex-grow h-[1px] bg-outline-variant/30"></div>
          </div>

          <div className="space-y-4">
            <button className="w-full flex items-center justify-center gap-3 editorial-gradient text-on-primary py-4 px-6 rounded-xl font-label font-bold tracking-wide shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all duration-200">
              <Icons.Mail className="w-5 h-5" />
              Đăng nhập bằng Email
            </button>
            <button className="w-full flex items-center justify-center gap-2 bg-transparent text-primary py-4 px-6 rounded-xl font-label font-bold tracking-wide border-2 border-primary/10 hover:bg-primary/5 transition-all duration-200">
              Đăng ký bằng Email
            </button>
          </div>

          <div className="mt-12 text-center">
            <p className="text-secondary text-sm font-body">
              Bằng cách đăng nhập, bạn đồng ý với
              <a className="text-primary font-semibold hover:underline mx-1" href="#">Điều khoản dịch vụ</a>
              và
              <a className="text-primary font-semibold hover:underline mx-1" href="#">Chính sách bảo mật</a>.
            </p>
          </div>
        </div>

        <div className="hidden lg:block absolute bottom-0 right-0 p-8">
          <div className="w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mb-16"></div>
        </div>
      </section>
    </main>
  );
}
