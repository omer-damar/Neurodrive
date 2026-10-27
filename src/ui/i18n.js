// UI strings. Turkish only for now; English and a language switch arrive in Phase 5.

const MESSAGES = {
  tr: {
    'stage.label': 'Simülasyon',
    'panel.label': 'Kontrol paneli',
    'view.label': 'Görünüm',
    'view.loading3d': '3D görünüm yükleniyor…',
    'view.noWebgl': 'Bu tarayıcıda WebGL yok; 2D görünümde devam ediliyor.',
    'view.load3dFailed': '3D görünüm yüklenemedi (internet bağlantısı gerekebilir); 2D görünümde devam ediliyor.',
    'camera.label': 'Kamera',
    'camera.chase': 'Takip kamerası',
    'camera.top': 'Üstten',
    'camera.orbit': 'Serbest',
    'status.heading': 'Durum',
    'status.generation': 'Nesil',
    'status.alive': 'Süren araba',
    'status.finished': 'Bitiren araba',
    'status.best': 'En iyi fitness',
    'status.bestLap': 'En iyi tur süresi',
    'status.last': 'Son nesil (en iyi / ort.)',
    'status.lastValue': '{best} / {avg}',
    'unit.seconds': '{value} sn',
    'controls.heading': 'Kontroller',
    'controls.play': 'Başlat',
    'controls.pause': 'Duraklat',
    'controls.next': 'Sonraki nesil',
    'controls.reset': 'Sıfırla',
    'controls.speed': 'Hız',
    'controls.max': 'Maks',
    'controls.help': 'Boşluk: başlat/duraklat. Pist değiştirmek eğitilmiş beyinleri korur.',
    'display.heading': 'Görüntü',
    'display.crowd': 'Kalabalık',
    'display.crowd.all': 'Tüm arabalar',
    'display.crowd.top10': 'Yalnızca en iyi 10',
    'display.crowd.dim': 'Lider dışındakiler soluk',
    'display.sensors': 'Liderin sensörlerini göster',
    'track.heading': 'Pist',
    'track.oval': 'Oval (kolay)',
    'track.classic': 'Klasik (orta)',
    'track.technical': 'Teknik (zor)',
    'error.TOO_FEW_POINTS': 'Pist için en az 4 nokta gerekli.',
    'error.SHARP_TURN': 'Viraj çok keskin.',
    'error.SECTIONS_TOO_CLOSE': 'Pistin iki bölümü birbirine çok yakın.',
  },
};

let locale = 'tr';

/** Looks up a message and fills {name} placeholders from params. Unknown keys return the key. */
export function t(key, params = {}) {
  const template = MESSAGES[locale][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/** Fills elements marked with data-i18n (text) and data-i18n-aria (aria-label). */
export function applyTranslations(root = document) {
  document.documentElement.lang = locale;
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
}
