import Phaser from 'phaser'
import { createAdProvider } from './ads'
import { AboutScene } from './game/AboutScene'
import { GameScene } from './game/GameScene'
import { MenuScene } from './game/MenuScene'
import { NameScene } from './game/NameScene'
import { ProfileScene } from './game/ProfileScene'
import { SettingsScene } from './game/SettingsScene'
import { initLocale } from './i18n'
import { loadSettings } from './settings'

async function boot(): Promise<void> {
  initLocale()
  loadSettings()

  const ads = await createAdProvider()
  await ads.init()

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#070a12',
    scale: {
      // RESIZE: tuval her zaman pencereyi doldurur. Sabit tasarımı ortalayan
      // FIT modu telefonda oyunu kenarları siyah bantlı, küçücük bırakıyordu.
      // Sahneler yerleşimi gerçek ekran boyutundan türetiyor (game/layout.ts).
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
      width: '100%',
      height: '100%',
    },
    render: { antialias: true },
    // Kullanıcı adı ekranı gerçek bir <input> kullanıyor: mobilde sistem
    // klavyesi, kopyala-yapıştır ve dil desteği ancak böyle çalışır.
    dom: { createContainer: true },
    // Tüm ses WebAudio ile kendimiz sentezleniyor (src/audio/).
    // Phaser'ın kendi ses sistemi ikinci bir AudioContext açmasın.
    audio: { noAudio: true },
    input: { activePointers: 2 },
    scene: [MenuScene, NameScene, ProfileScene, GameScene, SettingsScene, AboutScene],
  })

  ads.loadingFinished()
  ads.gameplayStart()

  // Sadece geliştirmede: konsoldan ve otomatik testlerden sahneye erişim.
  // Üretim derlemesinde bu blok tamamen silinir.
  if (import.meta.env.DEV) {
    ;(window as unknown as { __game: Phaser.Game }).__game = game
  }
}

void boot()
