import type { LibraryVideo } from '../src/types.ts'

const NOW = Date.UTC(2026, 10, 13)
const DAY = 86_400_000

/** A library video: played often, recently, finished once, not starred, not analysed. Common. */
export function video(over: Partial<LibraryVideo> = {}): LibraryVideo {
  return {
    id: 'clip.mp4',
    title: 'clip',
    path: 'clip.mp4',
    durationS: 600,
    width: null,
    height: null,
    sizeBytes: null,
    hasScript: true,
    starred: false,
    intensity: null,
    playlists: [],
    plays: 10,
    finishes: 1,
    watchedMin: 30,
    lastPlayedAt: NOW - DAY,
    tags: [],
    sourceUrl: null,
    ...over,
  }
}
