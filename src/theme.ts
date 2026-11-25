// Kas palette, 60-30-10 (see DESIGN.md): blue and white like a banking app, but its own blues.
//   60% bg/card   white page, faint blue-grey cards: bright and calm, the way people expect a money app to feel
//   30% primary   deep ink blue: balance card and tab bar, the app's structure
//   10% accent    bright sky blue: the add button, the active tab, the total balance figure. Nowhere else.
// income/expense/warn are status colors for figures only, outside the 60-30-10 split.
// One fixed light theme by owner's choice (25 Nov 2026): the app stays white even when the phone is in dark mode.
const light = {
  bg: '#FFFFFF',
  card: '#F2F5FA',
  text: '#0E1A2B',
  muted: '#55627A',
  line: '#DCE3EE',
  primary: '#14386B',
  onPrimary: '#F3F6FB',
  onPrimaryMuted: '#B4C5DF',
  accent: '#6CC3FF',
  onAccent: '#0E1A2B',
  mark: '#14386B', // selection/focus marks and single-series chart bars on bg or card
  onMark: '#FFFFFF',
  income: '#0F7B4B',
  expense: '#C0352B',
  warn: '#8A5A00',
  warnBar: '#9A6500',
};

export type Palette = typeof light;
export const palettes = { light };

export const useTheme = (): Palette => light;

/** Category/wallet colors users pick: mid-tone so a white icon reads on them. */
export const PALETTE = ['#14386B', '#0F7B4B', '#2E6E8E', '#8A5A00', '#8E3B5E', '#5B4B9A', '#C0352B', '#3F4448'];
