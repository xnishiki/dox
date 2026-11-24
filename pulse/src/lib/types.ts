export type TrackSource = 'jamendo' | 'local'

export interface Track {
  id: string
  title: string
  artist: string
  artistId?: string
  album?: string
  albumId?: string
  cover?: string
  duration: number
  src: string
  source: TrackSource
  genres?: string[]
  tags?: string[]
}

export interface Album {
  id: string
  title: string
  artist: string
  artistId: string
  cover: string
  releaseDate?: string
}

export interface Artist {
  id: string
  name: string
  image?: string
}

export type RepeatMode = 'off' | 'all' | 'one'
export type Period = 'week' | 'month' | 'total'
