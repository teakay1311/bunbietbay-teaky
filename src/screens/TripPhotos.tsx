import { useParams } from 'react-router-dom';
import type { FormEvent } from 'react';
import { Layout } from '../components/Layout';
import { Icons } from '../components/Icons';
import { useAppContext } from '../context/AppContext';
import { useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal';

export function TripPhotos() {
  const { id } = useParams();
  const { trips, photos, addPhoto, deletePhoto } = useAppContext();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<string>('Tất cả');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trip = trips.find(t => t.id === id);
  const tripPhotos = photos.filter(p => p.tripId === id);

  if (!trip) return <Layout><div>Trip not found</div></Layout>;

  const albums = ['Tất cả', ...Array.from(new Set(tripPhotos.map(p => p.album)))];
  const displayedPhotos = selectedAlbum === 'Tất cả' ? tripPhotos : tripPhotos.filter(p => p.album === selectedAlbum);

  useEffect(() => {
    if (selectedAlbum === 'Tất cả') return;

    const hasSelectedAlbum = tripPhotos.some(photo => photo.album === selectedAlbum);
    if (!hasSelectedAlbum) {
      setSelectedAlbum('Tất cả');
    }
  }, [selectedAlbum, tripPhotos]);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to WebP with 0.7 quality
          const dataUrl = canvas.toDataURL('image/webp', 0.7);
          resolve(dataUrl);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAddPhotos = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const albumName = formData.get('album') as string || 'Chung';
    const files = fileInputRef.current?.files;

    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);
    let didSucceed = false;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        
        const compressedDataUrl = await compressImage(file);
        addPhoto({
          tripId: trip.id,
          url: compressedDataUrl,
          album: albumName
        });
      }
      didSucceed = true;
    } catch (error) {
      console.error("Error compressing/uploading image:", error);
      setUploadError("Có lỗi xảy ra khi tải ảnh lên.");
    } finally {
      setIsUploading(false);
      if (didSucceed) {
        setIsAddOpen(false);
      }
    }
  };

  return (
    <Layout tripId={trip.id}>
      <div className="flex justify-between items-end mb-8">
        <div>
          <p className="font-label text-xs uppercase tracking-[0.2em] text-secondary font-bold mb-2">Kỷ niệm</p>
          <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary">Thư viện ảnh</h1>
        </div>
        <button onClick={() => setIsAddOpen(true)} className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-opacity">
          <Icons.Image className="w-5 h-5" />
          Tải ảnh lên
        </button>
      </div>

      {albums.length > 1 && (
        <div className="flex gap-4 overflow-x-auto no-scrollbar mb-8 pb-2">
          {albums.map(album => (
            <button
              key={album}
              onClick={() => setSelectedAlbum(album)}
              className={`flex-shrink-0 px-6 py-2 rounded-full font-bold transition-colors ${
                selectedAlbum === album
                  ? 'bg-primary text-white'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
              }`}
            >
              {album}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {displayedPhotos.map(photo => (
          <div key={photo.id} className="relative group aspect-square rounded-2xl overflow-hidden bg-surface-container-high">
            <img src={photo.url} alt="Trip memory" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
              <p className="text-white font-bold text-sm truncate">{photo.album}</p>
              <button 
                onClick={() => deletePhoto(photo.id)} 
                className="absolute top-3 right-3 p-2 bg-error/90 text-white rounded-lg hover:bg-error transition-colors"
              >
                <Icons.Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {displayedPhotos.length === 0 && (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-outline-variant rounded-2xl">
            <Icons.Image className="w-16 h-16 mx-auto text-secondary mb-4 opacity-50" />
            <p className="text-secondary font-medium">Chưa có ảnh nào trong thư viện.</p>
          </div>
        )}
      </div>

      <Modal isOpen={isAddOpen} onClose={() => { if (!isUploading) { setUploadError(null); setIsAddOpen(false); } }} title="Tải ảnh lên">
        <form onSubmit={handleAddPhotos} className="space-y-4">
          {uploadError && (
            <div className="rounded-xl bg-error-container text-on-error-container px-4 py-3 text-sm font-medium">
              {uploadError}
            </div>
          )}
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Album</label>
            <input name="album" type="text" placeholder="VD: Ngày 1, Biển, Đồ ăn..." defaultValue={selectedAlbum !== 'Tất cả' ? selectedAlbum : 'Chung'} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary mb-1">Chọn ảnh (Có thể chọn nhiều)</label>
            <input 
              ref={fileInputRef}
              required 
              type="file" 
              multiple 
              accept="image/*"
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" 
            />
          </div>
          <div className="pt-4">
            <button disabled={isUploading} type="submit" className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center gap-2">
              {isUploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Đang nén và tải lên...
                </>
              ) : (
                'Tải ảnh lên'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
