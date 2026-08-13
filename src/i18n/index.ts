/**
 * 4 dil: Türkçe, Azerbaycanca, Rusça, İngilizce.
 *
 * Metinler baştan buradan geçiyor — sonradan i18n eklemek, ekrana yazılmış
 * her dizeyi tek tek avlamak demek. Sözlük tipli: yeni anahtar eklediğinde
 * eksik çeviri derleme hatası verir.
 *
 * Not: combo anonsları ("Double!", "Triple!") bilerek çevrilmiyor —
 * tür konvansiyonu İngilizce, bkz. audio/Voice.ts
 */

export const LOCALES = ['tr', 'az', 'ru', 'en'] as const
export type Locale = (typeof LOCALES)[number]

type Dict = {
  // HUD
  score: string
  combo: string
  balls: string
  danger: string
  // Oyun sonu
  gameOver: string
  levelClear: string
  newRecord: string
  retry: string
  menu: string
  // Menü
  play: string
  settings: string
  about: string
  best: string
  back: string
  // Ayarlar
  music: string
  sound: string
  voice: string
  language: string
  on: string
  off: string
  // Hakkımızda
  aboutTitle: string
  aboutBody: string
  developedBy: string
  // Oyun içi bildirimler
  streak: string
  gapShot: string
  extraLife: string
  lifeLost: string
  lastBalls: string
  levelBonus: string
  lives: string
  powerBomb: string
  powerSlow: string
  powerBackwards: string
  powerAccuracy: string
  // Profil / kullanıcı adı
  welcome: string
  enterName: string
  namePlaceholder: string
  nameTooShort: string
  start: string
  save: string
  changeName: string
  profile: string
  joined: string
  resetStats: string
  confirm: string
  statBest: string
  statGames: string
  statCleared: string
  statTotalScore: string
  statBalls: string
  statCombo: string
  statStreak: string
  statPowers: string
  statCoins: string
  statTime: string
}

const STRINGS: Record<Locale, Dict> = {
  tr: {
    score: 'PUAN',
    combo: 'KOMBO',
    balls: 'TOP',
    danger: 'TEHLİKE',
    gameOver: 'OYUN BİTTİ',
    levelClear: 'BÖLÜM TAMAM',
    newRecord: 'YENİ REKOR!',
    retry: 'TEKRAR OYNA',
    menu: 'ANA MENÜ',
    play: 'OYNA',
    settings: 'AYARLAR',
    about: 'HAKKIMIZDA',
    best: 'EN İYİ',
    back: 'GERİ',
    music: 'Müzik',
    sound: 'Ses efektleri',
    voice: 'Anons sesi',
    language: 'Dil',
    on: 'AÇIK',
    off: 'KAPALI',
    aboutTitle: 'HAKKIMIZDA',
    aboutBody:
      'Marble Shooter, klasik zincir kırma oyunlarından\nilham alan bir bulmaca-aksiyon oyunudur.\n\nTüm grafikler ve sesler oyun çalışırken\nkodla üretilir — tek bir hazır dosya yoktur.\n\nWeb ve mobil için TypeScript ve Phaser ile geliştirildi.',
    developedBy: 'Geliştiren: Goshgar Hasanzadeh',
    streak: 'SERİ',
    gapShot: 'BOŞLUK',
    extraLife: 'EKSTRA CAN!',
    lifeLost: 'CAN KAYBEDİLDİ',
    lastBalls: 'SON TOPLAR!',
    levelBonus: 'BÖLÜM BONUSU',
    lives: 'CAN',
    powerBomb: 'BOMBA!',
    powerSlow: 'YAVAŞLAMA!',
    powerBackwards: 'GERİ!',
    powerAccuracy: 'NİŞAN!',
    welcome: 'HOŞ GELDİN!',
    enterName: 'Sana nasıl hitap edelim?',
    namePlaceholder: 'Adın',
    nameTooShort: 'En az 2 karakter girmelisin',
    start: 'BAŞLA',
    save: 'KAYDET',
    changeName: 'ADI DEĞİŞTİR',
    profile: 'PROFİL',
    joined: 'Katılım',
    resetStats: 'SIFIRLA',
    confirm: 'EMİN MİSİN?',
    statBest: 'En yüksek puan',
    statGames: 'Oynanan oyun',
    statCleared: 'Bitirilen bölüm',
    statTotalScore: 'Toplam puan',
    statBalls: 'Patlatılan top',
    statCombo: 'En uzun kombo',
    statStreak: 'En uzun seri',
    statPowers: 'Kullanılan güç',
    statCoins: 'Toplanan para',
    statTime: 'Oyun süresi',
  },
  az: {
    score: 'XAL',
    combo: 'KOMBO',
    balls: 'TOP',
    danger: 'TƏHLÜKƏ',
    gameOver: 'OYUN BİTDİ',
    levelClear: 'MƏRHƏLƏ BİTDİ',
    newRecord: 'YENİ REKORD!',
    retry: 'YENİDƏN OYNA',
    menu: 'ANA MENYU',
    play: 'OYNA',
    settings: 'TƏNZİMLƏMƏLƏR',
    about: 'HAQQIMIZDA',
    best: 'ƏN YAXŞI',
    back: 'GERİ',
    music: 'Musiqi',
    sound: 'Səs effektləri',
    voice: 'Anons səsi',
    language: 'Dil',
    on: 'AÇIQ',
    off: 'BAĞLI',
    aboutTitle: 'HAQQIMIZDA',
    aboutBody:
      'Marble Shooter klassik zəncir qırma oyunlarından\nilhamlanan bulmaca-aksiyon oyunudur.\n\nBütün qrafika və səslər oyun işlədiyi zaman\nkodla yaradılır — heç bir hazır fayl yoxdur.\n\nWeb və mobil üçün TypeScript və Phaser ilə hazırlanıb.',
    developedBy: 'Hazırlayan: Goshgar Hasanzadeh',
    streak: 'SERİYA',
    gapShot: 'BOŞLUQ',
    extraLife: 'ƏLAVƏ CAN!',
    lifeLost: 'CAN İTİRİLDİ',
    lastBalls: 'SON TOPLAR!',
    levelBonus: 'MƏRHƏLƏ BONUSU',
    lives: 'CAN',
    powerBomb: 'BOMBA!',
    powerSlow: 'YAVAŞLAMA!',
    powerBackwards: 'GERİ!',
    powerAccuracy: 'NİŞAN!',
    welcome: 'XOŞ GƏLDİN!',
    enterName: 'Sənə necə müraciət edək?',
    namePlaceholder: 'Adın',
    nameTooShort: 'Ən azı 2 simvol daxil et',
    start: 'BAŞLA',
    save: 'YADDA SAXLA',
    changeName: 'ADI DƏYİŞ',
    profile: 'PROFİL',
    joined: 'Qoşulma',
    resetStats: 'SIFIRLA',
    confirm: 'ƏMİNSƏN?',
    statBest: 'Ən yüksək xal',
    statGames: 'Oynanan oyun',
    statCleared: 'Bitən mərhələ',
    statTotalScore: 'Ümumi xal',
    statBalls: 'Partladılan top',
    statCombo: 'Ən uzun kombo',
    statStreak: 'Ən uzun seriya',
    statPowers: 'İstifadə olunan güc',
    statCoins: 'Yığılan pul',
    statTime: 'Oyun vaxtı',
  },
  ru: {
    score: 'ОЧКИ',
    combo: 'КОМБО',
    balls: 'ШАРЫ',
    danger: 'ОПАСНОСТЬ',
    gameOver: 'ИГРА ОКОНЧЕНА',
    levelClear: 'УРОВЕНЬ ПРОЙДЕН',
    newRecord: 'НОВЫЙ РЕКОРД!',
    retry: 'ИГРАТЬ СНОВА',
    menu: 'ГЛАВНОЕ МЕНЮ',
    play: 'ИГРАТЬ',
    settings: 'НАСТРОЙКИ',
    about: 'О НАС',
    best: 'РЕКОРД',
    back: 'НАЗАД',
    music: 'Музыка',
    sound: 'Звуковые эффекты',
    voice: 'Голос диктора',
    language: 'Язык',
    on: 'ВКЛ',
    off: 'ВЫКЛ',
    aboutTitle: 'О НАС',
    aboutBody:
      'Marble Shooter — головоломка-экшен, вдохновлённая\nклассическими играми с цепочкой шаров.\n\nВся графика и звук создаются кодом\nво время игры — ни одного готового файла.\n\nСоздано на TypeScript и Phaser для веба и мобильных.',
    developedBy: 'Разработчик: Goshgar Hasanzadeh',
    streak: 'СЕРИЯ',
    gapShot: 'В ПРОСВЕТ',
    extraLife: 'ДОП. ЖИЗНЬ!',
    lifeLost: 'ЖИЗНЬ ПОТЕРЯНА',
    lastBalls: 'ПОСЛЕДНИЕ ШАРЫ!',
    levelBonus: 'БОНУС УРОВНЯ',
    lives: 'ЖИЗНИ',
    powerBomb: 'БОМБА!',
    powerSlow: 'ЗАМЕДЛЕНИЕ!',
    powerBackwards: 'НАЗАД!',
    powerAccuracy: 'ПРИЦЕЛ!',
    welcome: 'ДОБРО ПОЖАЛОВАТЬ!',
    enterName: 'Как к вам обращаться?',
    namePlaceholder: 'Имя',
    nameTooShort: 'Введите минимум 2 символа',
    start: 'НАЧАТЬ',
    save: 'СОХРАНИТЬ',
    changeName: 'СМЕНИТЬ ИМЯ',
    profile: 'ПРОФИЛЬ',
    joined: 'Регистрация',
    resetStats: 'СБРОС',
    confirm: 'ТОЧНО?',
    statBest: 'Лучший счёт',
    statGames: 'Сыграно игр',
    statCleared: 'Пройдено уровней',
    statTotalScore: 'Всего очков',
    statBalls: 'Взорвано шаров',
    statCombo: 'Лучшее комбо',
    statStreak: 'Лучшая серия',
    statPowers: 'Использовано бонусов',
    statCoins: 'Собрано монет',
    statTime: 'Время в игре',
  },
  en: {
    score: 'SCORE',
    combo: 'COMBO',
    balls: 'BALLS',
    danger: 'DANGER',
    gameOver: 'GAME OVER',
    levelClear: 'LEVEL CLEAR',
    newRecord: 'NEW RECORD!',
    retry: 'PLAY AGAIN',
    menu: 'MAIN MENU',
    play: 'PLAY',
    settings: 'SETTINGS',
    about: 'ABOUT',
    best: 'BEST',
    back: 'BACK',
    music: 'Music',
    sound: 'Sound effects',
    voice: 'Announcer voice',
    language: 'Language',
    on: 'ON',
    off: 'OFF',
    aboutTitle: 'ABOUT',
    aboutBody:
      'Marble Shooter is a puzzle-action game inspired by\nclassic chain-matching arcade games.\n\nEvery graphic and sound is generated by code\nat runtime — there is not a single asset file.\n\nBuilt with TypeScript and Phaser for web and mobile.',
    developedBy: 'Developed by Goshgar Hasanzadeh',
    streak: 'STREAK',
    gapShot: 'GAP SHOT',
    extraLife: 'EXTRA LIFE!',
    lifeLost: 'LIFE LOST',
    lastBalls: 'LAST BALLS!',
    levelBonus: 'LEVEL BONUS',
    lives: 'LIVES',
    powerBomb: 'BOMB!',
    powerSlow: 'SLOW!',
    powerBackwards: 'BACKWARDS!',
    powerAccuracy: 'ACCURACY!',
    welcome: 'WELCOME!',
    enterName: 'What should we call you?',
    namePlaceholder: 'Your name',
    nameTooShort: 'Enter at least 2 characters',
    start: 'START',
    save: 'SAVE',
    changeName: 'CHANGE NAME',
    profile: 'PROFILE',
    joined: 'Joined',
    resetStats: 'RESET',
    confirm: 'ARE YOU SURE?',
    statBest: 'Best score',
    statGames: 'Games played',
    statCleared: 'Levels cleared',
    statTotalScore: 'Total score',
    statBalls: 'Balls popped',
    statCombo: 'Longest combo',
    statStreak: 'Longest streak',
    statPowers: 'Power-ups used',
    statCoins: 'Coins collected',
    statTime: 'Time played',
  },
}

const STORAGE_KEY = 'ms.locale'

function detect(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && (LOCALES as readonly string[]).includes(saved)) return saved as Locale

  const nav = navigator.language.slice(0, 2).toLowerCase()
  return (LOCALES as readonly string[]).includes(nav) ? (nav as Locale) : 'en'
}

let current: Locale = 'en'

export function initLocale(): Locale {
  current = detect()
  return current
}

export function getLocale(): Locale {
  return current
}

export function setLocale(locale: Locale): void {
  current = locale
  localStorage.setItem(STORAGE_KEY, locale)
}

export function t(key: keyof Dict): string {
  return STRINGS[current][key]
}
