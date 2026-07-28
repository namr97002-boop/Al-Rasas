// ============================================
// ⚙️ الإعدادات
// ============================================
const VERSION = '31';
const CACHE_NAME = `smart-absence-v${VERSION}-pwa`;

// ============================================
// ✅ الملفات الأساسية
// ============================================
const ASSETS = [
    '/',
    '/index.html',
    '/offline.html',
    '/manifest.json'
];

// ============================================
// 📦 التثبيت - مع فحص الحالة
// ============================================
self.addEventListener('install', event => {
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            try {
                for (const asset of ASSETS) {
                    try {
                        const response = await fetch(asset);
                        if (response && response.status === 200) {
                            await cache.put(asset, response);
                            console.log(`✅ تم تخزين: ${asset}`);
                        } else {
                            console.warn(`⚠️ فشل تخزين: ${asset} (${response?.status})`);
                        }
                    } catch (e) {
                        console.warn(`⚠️ فشل تخزين: ${asset}`, e);
                    }
                }
                console.log(`✅ تم تثبيت الإصدار ${VERSION}`);
            } catch (e) {
                console.error('❌ فشل التثبيت:', e);
            }
        })
    );
});

// ============================================
// 🔄 التنشيط - إزالة الكاش القديم
// ============================================
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            const deletePromises = keys
                .filter(key => key !== CACHE_NAME)
                .map(key => {
                    console.log(`🗑️ حذف الكاش القديم: ${key}`);
                    return caches.delete(key);
                });
            
            return Promise.all(deletePromises);
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

    const url = new URL(event.request.url);

    // ✅ تجاهل الطلبات الخارجية (API, CDN)
    if (url.origin !== self.location.origin) {
        event.respondWith(
            fetch(event.request).catch(() => {
                return new Response('', { status: 404 });
            })
        );
        return;
    }

    // ✅ استراتيجية خاصة للملفات الأساسية (من V29)
    if (url.pathname === '/' || url.pathname === '/index.html') {
        event.respondWith(
            (async () => {
                // 1️⃣ حاول من الكاش أولاً
                const cached = await caches.match('/index.html');
                if (cached) {
                    console.log('✅ تم تحميل index.html من الكاش');
                    return cached;
                }

                // 2️⃣ حاول الشبكة
                try {
                    const network = await fetch('/index.html');
                    if (network && network.status === 200) {
                        const cache = await caches.open(CACHE_NAME);
                        cache.put('/index.html', network.clone());
                        console.log('✅ تم تحميل index.html من الشبكة');
                        return network;
                    }
                } catch (e) {
                    console.warn('⚠️ فشل تحميل index.html من الشبكة');
                }

                // 3️⃣ صفحة بديلة مدمجة
                return new Response(`
                    <!DOCTYPE html>
                    <html>
                    <head><meta charset="UTF-8"><title>غير متصل</title></head>
                    <body style="text-align:center;padding:50px;font-family:Arial;background:#0f172a;color:#fff;">
                        <h1>📴 غير متصل</h1>
                        <p>يرجى الاتصال بالإنترنت وتحديث الصفحة</p>
                        <button onclick="location.reload()">🔄 تحديث</button>
                    </body>
                    </html>
                `, {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: { 'Content-Type': 'text/html' }
                });
            })()
        );
        return;
    }

    // ✅ باقي الملفات - مع دعم جميع المسارات (من V28)
    event.respondWith(
        (async () => {
            try {
                // 1️⃣ من الكاش
                const cached = await caches.match(event.request);
                if (cached) {
                    return cached;
                }

                // 2️⃣ من الشبكة
                const network = await fetch(event.request);
                if (network && network.status === 200) {
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(event.request, network.clone());
                    return network;
                }

                // 3️⃣ 🎯 الحل السحري: أي طلب صفحة → index.html (من V28)
                if (event.request.mode === 'navigate' || 
                    event.request.destination === 'document' ||
                    event.request.headers.get('accept')?.includes('text/html')) {
                    
                    const fallback = await caches.match('/index.html');
                    if (fallback) {
                        console.log('✅ تم عرض index.html (شاشة الدخول) للمسار:', url.pathname);
                        return fallback;
                    }
                }

                // 4️⃣ offline.html للملفات الأخرى
                return await caches.match('/offline.html') || new Response('', { status: 404 });

            } catch (error) {
                console.log(`📡 وضع الأوفلاين: ${event.request.url}`);
                
                // 🎯 نفس الحل عند فشل الشبكة
                if (event.request.mode === 'navigate' || 
                    event.request.destination === 'document' ||
                    event.request.headers.get('accept')?.includes('text/html')) {
                    
                    const fallback = await caches.match('/index.html');
                    if (fallback) {
                        console.log('✅ تم عرض index.html (شاشة الدخول) - وضع الأوفلاين');
                        return fallback;
                    }
                }

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
                if (event.ports && event.ports[0]) {
                    event.ports[0].postMessage({
                        version: VERSION,
                        count: keys.length,
                        urls: keys.map(req => req.url)
                    });
                }
            });
        });
    }
    
    // ✅ طلب تحديث إجباري
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});