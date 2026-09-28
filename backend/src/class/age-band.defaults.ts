export const DEFAULT_AGE_BANDS = [
  { label: '0-3', minAge: 0, maxAgeExclusive: 3, order: 0 },
  { label: '3-4', minAge: 3, maxAgeExclusive: 5, order: 1 },
  ...Array.from({ length: 15 }, (_, index) => {
    const age = index + 5;
    return { label: String(age), minAge: age, maxAgeExclusive: age + 1, order: index + 2 };
  }),
  { label: '19 & Above', minAge: 19, maxAgeExclusive: null, order: 17 },
];
