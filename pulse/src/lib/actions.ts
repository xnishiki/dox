import { jamendo } from './jamendo'
import { usePlayer } from '../store/player'
import { useUi } from '../store/ui'
import { tr } from '../i18n'

/** Загрузить альбом и сразу запустить */
export async function playAlbum(id: string) {
  try {
    const { tracks } = await jamendo.album(id)
    if (tracks.length) usePlayer.getState().playTracks(tracks)
  } catch (err) {
    useUi.getState().showToast(`${tr('Не удалось открыть альбом', 'Could not open album')}: ${(err as Error).message}`)
  }
}
