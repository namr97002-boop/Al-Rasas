// ============================================
// ⚙️ الإعدادات
// ============================================
const VERSION = '24';  // تم التحديث إلى 23
الإضافة
const CACHE_NAME = `smart-absence-v${VERSION}-pwa`;  // ← تم التعديل

// ============================================
// ✅ فقط الملفات المحلية (بدون CDN)
// ============================================
const ASSETS = [
    '/',
    '/index.html',
    '/offline.html',
    '/manifest.json'
];

// ============================================
// 📦 التثبيت - بدون أي روابط خارجية
// ============================================
self.addEventListener('install', event => {
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            try {
                // تخزين الملفات المحلية فقط
                for (const asset of ASSETS) {
                    try {
                        await cache.add(asset);
                        console.log(`✅ تم تخزين: ${asset}`);
                    } catch (e) {
                        console.warn(`⚠️ فشل تخزين: ${asset}`, e);
                    }
                }
                console.log(`✅ تم تثبيت الإصدار ${VERSION} بنجاح`);
            } catch (e) {
                console.error('❌ فشل التثبيت:', e);
            }
        })
    );
});

// ============================================
// 🔄 التنشيط
// ============================================
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => {
                    console.log(`🗑️ حذف الكاش القديم: ${key}`);
                    return caches.delete(key);
                })
            );
        }).then(() => {
            console.log(`✅ تم تنشيط الإصدار ${VERSION}`);
            return self.clients.claim();
        })
    );
});

// ============================================
// 🌐 استراتيجية Offline-First المضمونة
// ============================================
self.addEventListener('fetch', event => {
    // تجاهل طلبات غير GET
    if (event.request.method !== 'GET') return;

    // تجاهل الطلبات الخارجية (CDN, APIs)
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) {
        // للروابط الخارجية: حاول الشبكة أو تجاهل
        event.respondWith(
            fetch(event.request).catch(() => {
                return new Response('', { status: 404 });
            })
        );
        return;
    }

    event.respondWith(
        (async () => {
            try {
                // 1️⃣ أولاً: حاول من الكاش (Offline-First)
                const cachedResponse = await caches.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }

                // 2️⃣ ثانياً: حاول الشبكة
                const networkResponse = await fetch(event.request);
                
                if (networkResponse && networkResponse.status === 200) {
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(event.request, networkResponse.clone());
                }
                
                return networkResponse;

            } catch (error) {
                // 3️⃣ أخيراً: صفحة الدخول (المضمونة 100%)
                console.log(`📡 وضع الأوفلاين: ${event.request.url}`);
                
                // 🔥 الحل السحري: أي طلب HTML → index.html
                if (event.request.mode === 'navigate' || 
                    event.request.destination === 'document' ||
                    event.request.headers.get('accept')?.includes('text/html')) {
                    
                    const fallback = await caches.match('/index.html');
                    if (fallback) {
                        console.log('✅ تم عرض index.html (شاشة الدخول)');
                        return fallback;
                    }
                }

                // أي طلب آخر → offline.html
                return await caches.match('/offline.html') || new Response('غير متصل', {
                    status: 503,
                    statusText: 'Service Unavailable'
                });
            }
        })()
    );
});

// ============================================
// 📊 رسائل من العميل
// ============================================
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'GET_CACHE_SIZE') {
        caches.open(CACHE_NAME).then(cache => {
            cache.keys().then(keys => {
                if (event.ports && event.ports[0]) {  // ← تمت الإضافة
                    event.ports[0].postMessage({
                        version: VERSION,  // ← تمت الإضافة
                        count: keys.length,
                        urls: keys.map(req => req.url)
                    });
                }
            });
        });
    }
});