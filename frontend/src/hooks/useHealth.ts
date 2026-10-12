import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useHealth(refetchInterval: number | false = 10000) {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
    refetchInterval,
    retry: 1,
  });
}
