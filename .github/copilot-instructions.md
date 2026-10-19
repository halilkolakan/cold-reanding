# Proje Hakkında
"Cold Reading", kullanıcıların yüklediği videoları işleyerek yüz ifadelerindeki mikro değişimleri ve baskın duygu durumlarını analiz eden bir mobil uygulamadır. Gelişmiş bir arka plan yapay zeka entegrasyonu ve asenkron (polling) mimarisi ile çalışır.

# Teknolojiler
- **Client (Mobil):** React Native (Expo), NativeWind (Tailwind CSS v3), expo-image-picker, expo-file-system.
- **Server (Backend):** Node.js, Express.js, Multer (Dosya Yükleme), child_process (Python entegrasyonu).
- **Yapay Zeka (AI):** Python, OpenCV (cv2), DeepFace (Sanal ortam `.venv` içinde izole).
- **Veritabanı (Planlanan):** Kullanıcı verileri için Supabase (PostgreSQL) + Prisma ORM. Analiz JSON verileri için MongoDB.

# Mimari ve Akış Kuralları
1. **Video Yükleme:** Frontend, videoları `expo-file-system` kullanarak gerçek bir `File` nesnesi olarak `multipart/form-data` formatında gönderir.
2. **Asenkron İşlem (Polling):** Server işlemi anında bitirmez; isteği alınca `taskId` döner (HTTP 202) ve Python scriptini arka planda asenkron başlatır. Client her 3 saniyede bir GET isteği ile görevin tamamlanıp tamamlanmadığını sorgular.
3. **API Adresi:** Client tarafındaki `ANALYZE_API_URL` her zaman yerel IPv4 adresini göstermelidir (Örn: http://172.x.x.x:3000). AI bunu asla 'localhost' olarak değiştirmemelidir.
4. **UI Tasarımı:** Uygulama "Siber-Noir" temasına sahiptir. Siyah/mat zeminler (`bg-zinc-950`, `bg-zinc-900`) ve neon cyan vurgular (`cyan-400`) kullanılmalıdır.

# Kodlama Kuralları
- Sadece fonksiyonel React bileşenleri (Functional Components ve Hooks) kullan.
- Yeni bir npm paketi veya Python kütüphanesi eklemeden önce mutlaka onay iste.
- Uygulamanın mevcut `client` ve `server` klasör yapısını kesinlikle bozma.
- Tüm açıklama satırları (comment) ve hata mesajları Türkçe olmalıdır.

# Komutlar
- **Frontend Çalıştırma:** `cd client` ve `npx expo start`
- **Backend Çalıştırma:** `cd server` ve `npm run dev`
- **Python Ortamı:** Backend terminalinde izole `.venv` kullanılır.