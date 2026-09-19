import { describe, it, expect } from 'vitest';
import '../categories'; // register block definitions
import { searchToolboxBlocks } from '../blockcoding/searchBlocks';
import { robotkuEsp32V3 } from '../domain/boardProfile';

describe('searchToolboxBlocks', () => {
  it('returns empty array on empty query', () => {
    expect(searchToolboxBlocks('')).toEqual([]);
    expect(searchToolboxBlocks('   ')).toEqual([]);
  });

  it('finds blocks by English keyword', () => {
    const results = searchToolboxBlocks('forward', robotkuEsp32V3);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((b) => b.type === 'move_forward')).toBe(true);
  });

  it('finds blocks by Indonesian keyword', () => {
    const results = searchToolboxBlocks('maju', robotkuEsp32V3);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((b) => b.type === 'move_forward')).toBe(true);
  });

  it('finds blocks by category name', () => {
    const audioResults = searchToolboxBlocks('Audio', robotkuEsp32V3);
    expect(audioResults.length).toBeGreaterThan(0);
    expect(audioResults.some((b) => b.type === 'audio_play_tone_sec')).toBe(true);
  });

  it('finds blocks for sound / music in Indonesian', () => {
    const soundResults = searchToolboxBlocks('suara', robotkuEsp32V3);
    expect(soundResults.length).toBeGreaterThan(0);
    expect(soundResults.some((b) => b.type.startsWith('audio_'))).toBe(true);
  });

  it('finds OLED and display blocks', () => {
    const displayResults = searchToolboxBlocks('oled', robotkuEsp32V3);
    expect(displayResults.length).toBeGreaterThan(0);
    expect(displayResults.some((b) => b.type.includes('display') || b.type.includes('lcd'))).toBe(true);
  });
});
