import { useSettings } from './store/settings'

const ru = {
  'nav.home': 'Главная',
  'nav.search': 'Поиск',
  'nav.flow': 'Поток',
  'nav.categories': 'Категории',
  'nav.library': 'Моя медиатека',
  'nav.playlists': 'Мои плейлисты',
  'nav.settings': 'Настройки',
  'nav.noPlaylists': 'Плейлисты появятся на этапе 4',

  'home.morning': 'Доброе утро',
  'home.day': 'Добрый день',
  'home.evening': 'Добрый вечер',
  'home.night': 'Доброй ночи',
  'home.top': 'Топ сейчас',
  'home.flowTitle': 'Поток',
  'home.flowText': 'Бесконечная волна, которая подстраивается под тебя',
  'home.playAll': 'Слушать всё',

  'period.week': 'Неделя',
  'period.month': 'Месяц',
  'period.total': 'Всё время',

  'player.nothing': 'Ничего не играет',
  'player.pick': 'Выбери трек, чтобы начать',
  'player.play': 'Играть',
  'player.pause': 'Пауза',
  'player.next': 'Следующий',
  'player.prev': 'Предыдущий',
  'player.shuffle': 'Перемешать',
  'player.repeatOff': 'Повтор выключен',
  'player.repeatAll': 'Повторять всё',
  'player.repeatOne': 'Повторять трек',
  'player.like': 'Нравится',
  'player.unlike': 'Убрать из любимых',
  'player.queue': 'Очередь',
  'player.eq': 'Эквалайзер',
  'player.mute': 'Без звука',
  'player.nowPlaying': 'Сейчас играет',
  'player.collapse': 'Свернуть',

  'queue.title': 'Очередь',
  'queue.now': 'Сейчас играет',
  'queue.next': 'Далее',
  'queue.empty': 'Очередь пуста',
  'queue.clear': 'Очистить',

  'menu.playNext': 'Играть следующим',
  'menu.addQueue': 'Добавить в очередь',
  'menu.like': 'Нравится',
  'menu.unlike': 'Убрать из любимых',

  'toast.liked': 'Добавлено в любимые',
  'toast.unliked': 'Убрано из любимых',
  'toast.queued': 'Добавлено в очередь',
  'toast.playNext': 'Сыграет следующим',

  'state.error': 'Не удалось загрузить',
  'state.retry': 'Повторить',
  'state.noKey': 'Добавь ключ Jamendo в файл .env (VITE_JAMENDO_CLIENT_ID) и перезапусти приложение. Инструкция — в README.',
  'state.soon': 'Этот раздел появится на одном из следующих этапов.',

  'library.liked': 'Любимые треки',
  'library.empty': 'Пока пусто. Нажми ♥ у любого трека.',
  'common.tracks': 'треков',
  'window.minimize': 'Свернуть',
  'window.maximize': 'Развернуть',
  'window.close': 'Закрыть',
}

type Dict = typeof ru
export type TKey = keyof Dict

const en: Dict = {
  'nav.home': 'Home',
  'nav.search': 'Search',
  'nav.flow': 'Flow',
  'nav.categories': 'Categories',
  'nav.library': 'My Library',
  'nav.playlists': 'My playlists',
  'nav.settings': 'Settings',
  'nav.noPlaylists': 'Playlists arrive in stage 4',
  'home.morning': 'Good morning',
  'home.day': 'Good afternoon',
  'home.evening': 'Good evening',
  'home.night': 'Good night',
  'home.top': 'Top right now',
  'home.flowTitle': 'Flow',
  'home.flowText': 'An endless wave that adapts to you',
  'home.playAll': 'Play all',
  'period.week': 'Week',
  'period.month': 'Month',
  'period.total': 'All time',
  'player.nothing': 'Nothing playing',
  'player.pick': 'Pick a track to start',
  'player.play': 'Play',
  'player.pause': 'Pause',
  'player.next': 'Next',
  'player.prev': 'Previous',
  'player.shuffle': 'Shuffle',
  'player.repeatOff': 'Repeat off',
  'player.repeatAll': 'Repeat all',
  'player.repeatOne': 'Repeat one',
  'player.like': 'Like',
  'player.unlike': 'Remove from liked',
  'player.queue': 'Queue',
  'player.eq': 'Equalizer',
  'player.mute': 'Mute',
  'player.nowPlaying': 'Now playing',
  'player.collapse': 'Collapse',
  'queue.title': 'Queue',
  'queue.now': 'Now playing',
  'queue.next': 'Next up',
  'queue.empty': 'Queue is empty',
  'queue.clear': 'Clear',
  'menu.playNext': 'Play next',
  'menu.addQueue': 'Add to queue',
  'menu.like': 'Like',
  'menu.unlike': 'Remove from liked',
  'toast.liked': 'Added to liked',
  'toast.unliked': 'Removed from liked',
  'toast.queued': 'Added to queue',
  'toast.playNext': 'Will play next',
  'state.error': 'Failed to load',
  'state.retry': 'Retry',
  'state.noKey': 'Add your Jamendo key to .env (VITE_JAMENDO_CLIENT_ID) and restart the app. See README.',
  'state.soon': 'This section arrives in one of the next stages.',
  'library.liked': 'Liked tracks',
  'library.empty': 'Nothing yet. Tap ♥ on any track.',
  'common.tracks': 'tracks',
  'window.minimize': 'Minimize',
  'window.maximize': 'Maximize',
  'window.close': 'Close',
}

const dicts = { ru, en }

export function useT() {
  const lang = useSettings((s) => s.lang)
  return (key: TKey) => dicts[lang][key] ?? key
}

export function t(key: TKey) {
  return dicts[useSettings.getState().lang][key] ?? key
}

/** Короткая форма для новых экранов: tr('Русский', 'English') */
export function useTr() {
  const lang = useSettings((s) => s.lang)
  return (ru: string, en: string) => (lang === 'en' ? en : ru)
}

export function tr(ru: string, en: string) {
  return useSettings.getState().lang === 'en' ? en : ru
}
