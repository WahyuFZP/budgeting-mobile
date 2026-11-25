// WCAG 2.x contrast check for every text/background pair the UI uses, in both themes.
import { PALETTE, palettes } from './theme';

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe.each(Object.entries(palettes))('%s theme', (_, p) => {
  test.each([
    ['text', 'bg'],
    ['text', 'card'],
    ['muted', 'bg'],
    ['muted', 'card'],
    ['onPrimary', 'primary'],
    ['onPrimaryMuted', 'primary'],
    ['accent', 'primary'], // total balance figure on the green card
    ['onAccent', 'accent'], // icon on the sky-blue add button
    ['onMark', 'mark'], // label on a selected chip
    ['income', 'card'],
    ['expense', 'card'],
    ['warn', 'card'],
  ] as const)('%s on %s >= 4.5:1', (fg, bg) => {
    expect(ratio(p[fg], p[bg])).toBeGreaterThanOrEqual(4.5);
  });

  test.each([['mark', 'bg'], ['mark', 'card']] as const)('selection mark %s vs %s >= 3:1', (fg, bg) => {
    expect(ratio(p[fg], p[bg])).toBeGreaterThanOrEqual(3);
  });

  test.each([['warnBar', 'line'], ['expense', 'line'], ['primary', 'line'], ['accent', 'primary']] as const)(
    'non-text %s vs %s >= 3:1 (progress bars, active tab)',
    (fg, bg) => {
      expect(ratio(p[fg], p[bg])).toBeGreaterThanOrEqual(3);
    },
  );
});

test('white icon on every pickable category color >= 4.5:1', () => {
  for (const c of PALETTE) expect(ratio('#FFFFFF', c)).toBeGreaterThanOrEqual(4.5);
});
