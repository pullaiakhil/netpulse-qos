import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAlerts(params?: Record<string, string>) {
  const queryClient = useQueryClient();

  const alertsQuery = useQuery({
    queryKey: ['alerts', params],
    queryFn: () => api.getAlerts(params),
    refetchInterval: 5000,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => api.acknowledgeAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.resolveAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  return {
    ...alertsQuery,
    alerts: alertsQuery.data || [],
    acknowledgeAlert: acknowledgeMutation.mutateAsync,
    isAcknowledging: acknowledgeMutation.isPending,
    resolveAlert: resolveMutation.mutateAsync,
    isResolving: resolveMutation.isPending,
  };
}
