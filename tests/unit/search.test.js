const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');

describe('Analytics Search: kataToHira', () => {
  const code = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');
  const funcMatch = code.match(/function kataToHira\(str\) \{[\s\S]*?\n    \}/);
  if (!funcMatch) throw new Error('Could not find kataToHira in index.html');
  eval(funcMatch[0]);

  test('converts katakana to hiragana', () => {
    expect(kataToHira('ピカチュー')).toBe('ぴかちゅー');
    expect(kataToHira('ガチゴラス')).toBe('がちごらす');
    expect(kataToHira('ユキノオー')).toBe('ゆきのおー');
  });

  test('long vowel mark is NOT converted (U+30FC outside regex range)', () => {
    const result = kataToHira('ー');
    expect(result).toBe('ー');
  });
});

describe('Analytics Search: romajiToKata', () => {
  const code = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');
  const funcMatch = code.match(/function romajiToKata\(rom\) \{[\s\S]*?\n    \}/);
  if (!funcMatch) throw new Error('Could not find romajiToKata in index.html');
  const normMatch = code.match(/function normalizeRomaji\(s\) \{[\s\S]*?\n    \}/);
  if (!normMatch) throw new Error('Could not find normalizeRomaji in index.html');
  eval(normMatch[0] + '\n' + funcMatch[0]);

  test('converts basic hiragana', () => {
    expect(romajiToKata('a')).toBe('ア');
    expect(romajiToKata('i')).toBe('イ');
    expect(romajiToKata('ka')).toBe('カ');
    expect(romajiToKata('kya')).toBe('キャ');
  });

  test('converts multi-syllable romaji', () => {
    expect(romajiToKata('pika')).toBe('ピカ');
    expect(romajiToKata('pikachu')).toBe('ピカチュ');
    expect(romajiToKata('gachigorasu')).toBe('ガチゴラス');
  });

  test('handles unknown characters by skipping', () => {
    expect(romajiToKata('xyz123')).toBe('');
  });

  test('handles empty string', () => {
    expect(romajiToKata('')).toBe('');
  });

  test('handles Japanese characters (returns empty string)', () => {
    expect(romajiToKata('ピカチュー')).toBe('');
    expect(romajiToKata('がち')).toBe('');
  });
});
