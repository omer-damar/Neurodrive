// UI strings in Turkish (default) and English. Pure apart from applyTranslations(), which takes the
// document; the chosen locale is stored by main.js.

const MESSAGES = {
  tr: {
    'stage.label': 'Simülasyon',
    'panel.label': 'Kontrol paneli',
    'lang.label': 'Dil',
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
    'network.heading': 'Sinir ağı',
    'network.label': 'Liderin sinir ağı: girdiler, gizli katman ve çıktılar',
    'network.sensor': 'S{n}',
    'network.speed': 'Hız',
    'network.steer': 'Direksiyon',
    'network.throttle': 'Gaz',
    'network.legend': 'Mavi pozitif, turuncu negatif. Çizgi kalınlığı ağırlığın büyüklüğü, düğüm rengi anlık aktivasyon.',
    'chart.heading': 'Gelişim',
    'chart.label': 'Nesil başına en iyi ve ortalama fitness',
    'chart.best': 'En iyi',
    'chart.avg': 'Ortalama',
    'chart.generation': 'Nesil',
    'chart.tooltip': 'Nesil {generation}',
    'chart.empty': 'İlk nesil bitince grafik çizilir.',
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
    'brain.heading': 'Beyin',
    'brain.loadPretrained': 'Hazır eğitilmiş beyni yükle',
    'brain.save': 'En iyiyi kaydet',
    'brain.loadSaved': 'Kaydedileni yükle',
    'brain.download': 'JSON indir',
    'brain.upload': 'JSON yükle',
    'brain.hint': 'Yüklenen beyinle nüfus yeniden başlar: beynin kendisi ve mutasyonlu kopyaları. Ağ boyutu beyne göre ayarlanır.',
    'brain.none': 'Henüz kaydedilecek beyin yok; ilk neslin bitmesini bekle.',
    'brain.downloaded': 'En iyi beyin {name} olarak indirildi.',
    'brain.saved': 'En iyi beyin bu tarayıcıya kaydedildi.',
    'brain.saveFailed': 'Kaydedilemedi: tarayıcı depolamaya izin vermiyor.',
    'brain.loadedSaved': 'Nüfus kaydedilen beyinden yeniden başladı.',
    'brain.loadedFile': 'Nüfus dosyadaki beyinden yeniden başladı.',
    'brain.loadedPretrained': 'Nüfus hazır eğitilmiş beyinden yeniden başladı.',
    'brain.invalid': 'Bu dosya geçerli bir NeuroDrive beyni değil.',
    'brain.unsupported': 'Bu beynin yapısı desteklenmiyor (3–9 ışın, 4–16 gizli nöron, tek gizli katman).',
    'settings.heading': 'Ayarlar',
    'settings.populationSize': 'Nüfus',
    'settings.mutationRate': 'Mutasyon oranı',
    'settings.hiddenNeurons': 'Gizli nöron',
    'settings.rayCount': 'Işın sayısı',
    'settings.shadows': '3D gölgeler',
    'settings.apply': 'Yeni eğitim başlat',
    'settings.hint': 'Eğitim ayarları "Yeni eğitim başlat" ile uygulanır; gölgeler hemen değişir.',
    'settings.pending': 'Uygulanmamış değişiklik var.',
    'error.TOO_FEW_POINTS': 'Pist için en az 4 nokta gerekli.',
    'error.SHARP_TURN': 'Viraj çok keskin.',
    'error.SECTIONS_TOO_CLOSE': 'Pistin iki bölümü birbirine çok yakın.',
  },
  en: {
    'stage.label': 'Simulation',
    'panel.label': 'Control panel',
    'lang.label': 'Language',
    'view.label': 'View',
    'view.loading3d': 'Loading the 3D view…',
    'view.noWebgl': 'This browser has no WebGL; continuing in the 2D view.',
    'view.load3dFailed': 'The 3D view could not be loaded (an internet connection may be needed); continuing in 2D.',
    'camera.label': 'Camera',
    'camera.chase': 'Chase camera',
    'camera.top': 'Top-down',
    'camera.orbit': 'Free',
    'status.heading': 'Status',
    'status.generation': 'Generation',
    'status.alive': 'Cars running',
    'status.finished': 'Cars finished',
    'status.best': 'Best fitness',
    'status.bestLap': 'Best lap time',
    'status.last': 'Last generation (best / avg)',
    'status.lastValue': '{best} / {avg}',
    'unit.seconds': '{value} s',
    'controls.heading': 'Controls',
    'controls.play': 'Start',
    'controls.pause': 'Pause',
    'controls.next': 'Next generation',
    'controls.reset': 'Reset',
    'controls.speed': 'Speed',
    'controls.max': 'Max',
    'controls.help': 'Space: start/pause. Changing the track keeps the trained brains.',
    'network.heading': 'Neural network',
    'network.label': "The leader's neural network: inputs, hidden layer and outputs",
    'network.sensor': 'S{n}',
    'network.speed': 'Speed',
    'network.steer': 'Steer',
    'network.throttle': 'Throttle',
    'network.legend': 'Blue is positive, orange negative. Line width is the weight size, node colour the current activation.',
    'chart.heading': 'Progress',
    'chart.label': 'Best and average fitness per generation',
    'chart.best': 'Best',
    'chart.avg': 'Average',
    'chart.generation': 'Generation',
    'chart.tooltip': 'Generation {generation}',
    'chart.empty': 'The chart appears after the first generation.',
    'display.heading': 'Display',
    'display.crowd': 'Crowd',
    'display.crowd.all': 'All cars',
    'display.crowd.top10': 'Only the best 10',
    'display.crowd.dim': 'Dim all but the leader',
    'display.sensors': "Show the leader's sensors",
    'track.heading': 'Track',
    'track.oval': 'Oval (easy)',
    'track.classic': 'Classic (medium)',
    'track.technical': 'Technical (hard)',
    'brain.heading': 'Brain',
    'brain.loadPretrained': 'Load pretrained brain',
    'brain.save': 'Save the best',
    'brain.loadSaved': 'Load saved',
    'brain.download': 'Download JSON',
    'brain.upload': 'Upload JSON',
    'brain.hint': 'A loaded brain restarts the population: the brain itself plus mutated copies. The network size follows the brain.',
    'brain.none': 'No brain to save yet; wait for the first generation to end.',
    'brain.downloaded': 'The best brain was downloaded as {name}.',
    'brain.saved': 'The best brain was saved in this browser.',
    'brain.saveFailed': 'Could not save: the browser does not allow storage.',
    'brain.loadedSaved': 'The population restarted from the saved brain.',
    'brain.loadedFile': 'The population restarted from the brain in the file.',
    'brain.loadedPretrained': 'The population restarted from the pretrained brain.',
    'brain.invalid': 'This file is not a valid NeuroDrive brain.',
    'brain.unsupported': 'This brain shape is not supported (3–9 rays, 4–16 hidden neurons, one hidden layer).',
    'settings.heading': 'Settings',
    'settings.populationSize': 'Population',
    'settings.mutationRate': 'Mutation rate',
    'settings.hiddenNeurons': 'Hidden neurons',
    'settings.rayCount': 'Ray count',
    'settings.shadows': '3D shadows',
    'settings.apply': 'Start new training',
    'settings.hint': 'Training settings apply with "Start new training"; shadows change at once.',
    'settings.pending': 'There are unapplied changes.',
    'error.TOO_FEW_POINTS': 'A track needs at least 4 points.',
    'error.SHARP_TURN': 'A turn is too sharp.',
    'error.SECTIONS_TOO_CLOSE': 'Two parts of the track are too close.',
  },
};

export const LOCALES = Object.freeze(Object.keys(MESSAGES));
export const DEFAULT_LOCALE = 'tr';

let locale = DEFAULT_LOCALE;

export function getLocale() {
  return locale;
}

/** Switches the language; unknown locales are ignored. Returns the active locale. */
export function setLocale(next) {
  if (LOCALES.includes(next)) locale = next;
  return locale;
}

/** Looks up a message and fills {name} placeholders from params. Unknown keys return the key. */
export function t(key, params = {}) {
  const template = MESSAGES[locale][key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/** Message keys of one locale (for tests: every locale must define the same keys). */
export function messageKeys(name) {
  return Object.keys(MESSAGES[name] ?? {});
}

/** Fills elements marked with data-i18n (text) and data-i18n-aria (aria-label). */
export function applyTranslations(root = document) {
  document.documentElement.lang = locale;
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
}
