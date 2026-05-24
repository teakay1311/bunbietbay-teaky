/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE_PATH?: string;
  readonly VITE_USE_HASH_ROUTER?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_CLOUDINARY_CLOUD_NAME?: string;
  readonly VITE_CLOUDINARY_UPLOAD_PRESET?: string;
  readonly VITE_CLOUDINARY_FOLDER?: string;
  readonly VITE_CLOUDINARY_DELETE_ENDPOINT?: string;
  readonly VITE_REQUIRE_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  desktopApi?: {
    isDesktopApp: boolean;
    loadState: () => Promise<unknown | null>;
    saveState: (state: unknown) => Promise<void>;
    clearState: () => Promise<void>;
    getDataDirectory: () => Promise<string>;
    openDataDirectory: () => Promise<string>;
  };
}
