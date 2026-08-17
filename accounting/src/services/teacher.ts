export const TEACHER_RO = [
  'Salut, Mihail. Aici ții contabilitatea pentru Global Fantastic și Rare People.',
  'Spui cu ce firmă lucrezi. Pui extrasul de bancă sau exportul din 1C în folderul firmei.',
  'Apoi întrebi „ce am de plătit luna asta?”. Când totul e clar, spui „închide luna”.',
].join('\n');

export const getTeacher = () => ({
  language: 'ro' as const,
  text: TEACHER_RO,
  phrases: [
    'Ce am de plătit luna asta?',
    'Treci pe Rare People',
    'Treci pe Fantastic',
    'Am pus extrasul în folder',
    'Am pus fișierele din 1C',
    'Închide luna',
  ],
});
