export const SUPABASE_STORAGE_URL = 'https://jpijxwxsoxrmssosgblj.supabase.co/storage/v1/object/public/project-images/';

export const STATIC_IMAGES = {
  logo: `${SUPABASE_STORAGE_URL}logo.png`,
  hinh1: `${SUPABASE_STORAGE_URL}hinh1.png`,
  hinh2: `${SUPABASE_STORAGE_URL}hinh2.png`,
  hinh3: `${SUPABASE_STORAGE_URL}hinh3.png`,
  hinh4: `${SUPABASE_STORAGE_URL}hinh4.png`,
  hinh5: `${SUPABASE_STORAGE_URL}hinh5.png`,
} as const;

/**
 * Chuyển đổi đường dẫn ảnh cũ từ API (ví dụ: /images/hinh4.png hoặc images/hinh4.png)
 * sang URL Supabase Storage công khai.
 * Giữ nguyên các URL tuyệt đối (http/https), dữ liệu Base64 (data:), hoặc ảnh sự cố.
 */
export function getStorageImageUrl(pathOrUrl?: string | null): string {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return '';
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return '';

  // Giữ nguyên các URL tuyệt đối (http/https) hoặc data URI base64
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // Tương thích chuyển /images/<filename> hoặc images/<filename> thành URL Supabase
  const cleanPath = trimmed.replace(/^\/?images\//, '').replace(/^\//, '');
  return `${SUPABASE_STORAGE_URL}${cleanPath}`;
}

/**
 * Fallback an toàn cho thẻ img: Nếu URL từ Supabase Storage chưa load được
 * (ví dụ: bucket chưa gạt Public trên Supabase Dashboard), tự động chuyển về ảnh local
 * tương ứng trong /images/ để đảm bảo giao diện luôn hiển thị hoàn hảo.
 */
export function handleImageFallback(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  fallbackPath?: string
) {
  const target = e.currentTarget;
  if (target.dataset.hasFallenBack) return;
  target.dataset.hasFallenBack = 'true';

  if (fallbackPath) {
    target.src = fallbackPath;
    return;
  }

  const src = target.src || '';
  for (const [key, supUrl] of Object.entries(STATIC_IMAGES)) {
    if (src.includes(supUrl) || src.includes(`${key}.png`)) {
      target.src = `/images/${key}.png`;
      return;
    }
  }
}
