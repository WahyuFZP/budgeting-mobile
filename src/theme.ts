// Kas palette "Hutan pagi" (morning forest), 60-30-10 (see DESIGN.md):
//   60% bg/card   mist-green page, white cards: cards float softly on a calm natural base
//   30% primary   forest green: balance card (with its 3D forest), tab bar, primary buttons
//   10% accent    morning-sun yellow: the add button, the active tab, the total balance figure, the sun. Nowhere else.
// income/expense/warn are status colors for figures only, outside the 60-30-10 split.
// One fixed light theme by owner's choice: the app stays light even when the phone is in dark mode.
const light = {
  bg: '#EEF3EA',
  card: '#FFFFFF',
  text: '#16231B',
  muted: '#536257',
  line: '#D5DFD1',
  primary: '#1F4D3A',
  onPrimary: '#F3F6F1',
  onPrimaryMuted: '#B6CDBE',
  accent: '#F2B33D',
  onAccent: '#16231B',
  mark: '#1F4D3A', // selection/focus marks and single-series chart bars on bg or card
  onMark: '#FFFFFF',
  income: '#1B7A47',
  expense: '#B8382B',
  warn: '#8A5A00',
  warnBar: '#9A6500',
};

export type Palette = typeof light;
export const palettes = { light };

export const useTheme = (): Palette => light;

/** Category/wallet colors users pick: mid-tone, nature-leaning, each passes 4.5:1 with a white icon. */
export const PALETTE = ['#1F4D3A', '#2E6E5E', '#2E6E8E', '#8A5A00', '#8E3B5E', '#5B4B9A', '#B8382B', '#4A5A4F'];
