export interface Category {
  id: string
  ru: string
  en: string
  kind: 'genre' | 'mood'
  /** Теги Jamendo: tags — все должны совпасть, fuzzytags — достаточно одного */
  query: { tags?: string; fuzzytags?: string }
  colors: [string, string]
}

export const CATEGORIES: Category[] = [
  { id: 'pop', ru: 'Поп', en: 'Pop', kind: 'genre', query: { tags: 'pop' }, colors: ['#ff5f8f', '#ff9a5a'] },
  { id: 'rock', ru: 'Рок', en: 'Rock', kind: 'genre', query: { tags: 'rock' }, colors: ['#e5484d', '#7a1f3d'] },
  { id: 'hiphop', ru: 'Хип-хоп', en: 'Hip-hop', kind: 'genre', query: { tags: 'hiphop' }, colors: ['#ffb224', '#c2410c'] },
  { id: 'electronic', ru: 'Электроника', en: 'Electronic', kind: 'genre', query: { tags: 'electronic' }, colors: ['#3e63dd', '#8e4ec6'] },
  { id: 'jazz', ru: 'Джаз', en: 'Jazz', kind: 'genre', query: { tags: 'jazz' }, colors: ['#ad7f58', '#3d2b1f'] },
  { id: 'classical', ru: 'Классика', en: 'Classical', kind: 'genre', query: { tags: 'classical' }, colors: ['#d4b483', '#6e5a3c'] },
  { id: 'lounge', ru: 'Лаунж', en: 'Lounge', kind: 'genre', query: { fuzzytags: 'lounge+chillout' }, colors: ['#12a594', '#0b5345'] },
  { id: 'soundtrack', ru: 'Саундтреки', en: 'Soundtracks', kind: 'genre', query: { fuzzytags: 'soundtrack+filmscore' }, colors: ['#6e56cf', '#1f1646'] },
  { id: 'ambient', ru: 'Эмбиент', en: 'Ambient', kind: 'genre', query: { tags: 'ambient' }, colors: ['#5eb1ef', '#1d3a5f'] },
  { id: 'indie', ru: 'Инди', en: 'Indie', kind: 'genre', query: { tags: 'indie' }, colors: ['#30a46c', '#1b4d3e'] },
  { id: 'metal', ru: 'Метал', en: 'Metal', kind: 'genre', query: { tags: 'metal' }, colors: ['#4a4a55', '#121216'] },
  { id: 'folk', ru: 'Фолк', en: 'Folk', kind: 'genre', query: { tags: 'folk' }, colors: ['#bd8b4f', '#5c3d1e'] },
  { id: 'rnb', ru: 'R&B и соул', en: 'R&B & Soul', kind: 'genre', query: { fuzzytags: 'rnb+soul' }, colors: ['#d6409f', '#5a1a45'] },
  { id: 'latin', ru: 'Латино', en: 'Latin', kind: 'genre', query: { tags: 'latin' }, colors: ['#f76b15', '#a62b0e'] },
  { id: 'reggae', ru: 'Регги', en: 'Reggae', kind: 'genre', query: { tags: 'reggae' }, colors: ['#46a758', '#d4a017'] },
  { id: 'house', ru: 'Хаус', en: 'House', kind: 'genre', query: { tags: 'house' }, colors: ['#00a2c7', '#4b2991'] },

  { id: 'workout', ru: 'Для тренировки', en: 'Workout', kind: 'mood', query: { fuzzytags: 'energetic+sport+motivational' }, colors: ['#ff6a3d', '#ffc83d'] },
  { id: 'sleep', ru: 'Для сна', en: 'Sleep', kind: 'mood', query: { fuzzytags: 'calm+relaxing+meditation' }, colors: ['#3a5ccc', '#141a3a'] },
  { id: 'focus', ru: 'Для работы', en: 'Focus', kind: 'mood', query: { fuzzytags: 'ambient+piano+calm' }, colors: ['#2ee59d', '#0e6b52'] },
  { id: 'chill', ru: 'Чилл', en: 'Chill', kind: 'mood', query: { fuzzytags: 'chillout+lofi+downtempo' }, colors: ['#7ce2fe', '#3e63dd'] },
  { id: 'happy', ru: 'Хорошее настроение', en: 'Feel good', kind: 'mood', query: { fuzzytags: 'happy+upbeat+fun' }, colors: ['#ffe629', '#ff8a3d'] },
  { id: 'sad', ru: 'Грустное', en: 'Sad', kind: 'mood', query: { fuzzytags: 'sad+melancholic' }, colors: ['#8d8daa', '#2b2b3d'] },
  { id: 'romantic', ru: 'Романтика', en: 'Romance', kind: 'mood', query: { fuzzytags: 'romantic+love' }, colors: ['#ff6f91', '#a01a58'] },
  { id: 'party', ru: 'Вечеринка', en: 'Party', kind: 'mood', query: { fuzzytags: 'dance+party+club' }, colors: ['#c13bff', '#ff3d7f'] },
]

export const categoryById = (id: string) => CATEGORIES.find((c) => c.id === id)
export const GENRES = CATEGORIES.filter((c) => c.kind === 'genre')
