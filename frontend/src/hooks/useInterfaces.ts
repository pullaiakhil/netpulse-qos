import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useInterfaces(refetchInterval: number | false = 3000) {
  const interfacesQuery = useQuery({
    queryKey: ['interfaces'],
    queryFn: () => api.getInterfaces(),
    refetchInterval,
  });

  const throughputQuery = useQuery({
    queryKey: ['throughput-history'],
    queryFn: () => api.getThroughputHistory(),
    refetchInterval,
  });

  return {
    interfaces: interfacesQuery.data?.interfaces || [],
    throughputData: interfacesQuery.data?.throughput || [],
    historicalThroughput: throughputQuery.data || [],
    isLoading: interfacesQuery.isLoading,
    isError: interfacesQuery.isError,
    refetch: interfacesQuery.refetch,
  };
}
