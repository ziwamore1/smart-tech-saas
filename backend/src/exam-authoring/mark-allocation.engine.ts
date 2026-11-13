export interface MarkDemand {
  id: string;
  weight?: number;
  method?: number;
  accuracy?: number;
  reasoning?: number;
  communication?: number;
}

export class MarkAllocationEngine {
  allocate(totalMarks: number, demands: MarkDemand[]) {
    if (!Number.isInteger(totalMarks) || totalMarks <= 0 || !demands.length) throw new Error('A positive mark total and at least one assessment demand are required');
    const weights = demands.map(demand => Math.max(1, Number(demand.weight || (demand.method || 0) + (demand.accuracy || 0) + (demand.reasoning || 0) + (demand.communication || 0))));
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
    const allocations = demands.map((demand, index) => ({ id: demand.id, marks: Math.floor(totalMarks * weights[index] / weightTotal) }));
    let remainder = totalMarks - allocations.reduce((sum, allocation) => sum + allocation.marks, 0);
    for (let index = 0; remainder > 0; index = (index + 1) % allocations.length, remainder--) allocations[index].marks++;
    return allocations;
  }
}
