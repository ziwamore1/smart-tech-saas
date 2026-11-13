import { MarkAllocationEngine } from './mark-allocation.engine';

describe('MarkAllocationEngine', () => {
  it('allocates every mark and preserves demand weighting', () => {
    const allocations = new MarkAllocationEngine().allocate(20, [
      { id: 'method', weight: 2 },
      { id: 'reasoning', weight: 1 },
      { id: 'accuracy', weight: 1 },
    ]);
    expect(allocations.reduce((sum, item) => sum + item.marks, 0)).toBe(20);
    expect(allocations[0].marks).toBeGreaterThan(allocations[1].marks);
  });
});
