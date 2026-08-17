import { describe, expect, it } from 'vitest';
import { getTeacher } from '../../src/services/teacher.js';

describe('getTeacher', () => {
  it('returns the short Romanian script and everyday phrases', () => {
    const teacher = getTeacher();
    expect(teacher.language).toBe('ro');
    expect(teacher.text).toContain('Global Fantastic');
    expect(teacher.text).toContain('Rare People');
    expect(teacher.text).toContain('ce am de plătit luna asta');
    expect(teacher.phrases).toContain('Treci pe Rare People');
    expect(teacher.phrases).toContain('Am pus fișierele din 1C');
  });
});
