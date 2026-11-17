// Invented test-only entries. No real songs, artists or user repertoire.
export const songFixtures = [
  ...Array.from({length: 6}, (_, index) => ({id: `anime-${index + 1}`, title: `Fixture Piece ${String(index + 1).padStart(3, '0')}`, artist: `Fixture Artist ${index + 1}`, set: 'Anime'})),
  ...['game-16', 'disney-4', 'final-fantasy-4', 'final-fantasy-5'].map((id,index) => ({id, title: `Fixture Piece ${index + 7}`, artist: `Fixture Artist ${index + 7}`, set: id.startsWith('game') ? 'Game' : id.startsWith('disney') ? 'Disney' : 'Final Fantasy'})),
  {id: 'country-13', title: 'Fixture Duo', artist: 'Fixture Duo Artist', set: 'Country'},
  {id: 'pop-soft-rock-34', title: 'Fixture Duo', artist: 'Fixture Duo Artist', set: 'Pop/Soft Rock'},
];
export function fixtureSongsSource(source) {
 return source.replace('export const songs: Song[] = [];', `export const songs: Song[] = ${JSON.stringify(songFixtures)};`);
}
