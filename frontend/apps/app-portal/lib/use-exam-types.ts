import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { EXAM_TYPE_OPTIONS } from './exam-types';

const FALLBACK_EXAM_TYPES = EXAM_TYPE_OPTIONS.map(type =>
  type.value === 'MOCK' ? { ...type, label: 'Mock Examination' } : type,
);

export function useExamTypes() {
  const query = useQuery({
    queryKey: ['exam-type-catalog'],
    queryFn: async () => {
      const response = await api.get('/results-management/exam-types');
      const data = response.data?.data ?? response.data;
      return Array.isArray(data) ? data : FALLBACK_EXAM_TYPES;
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    ...query,
    examTypes: query.data?.length ? query.data : FALLBACK_EXAM_TYPES,
  };
}
