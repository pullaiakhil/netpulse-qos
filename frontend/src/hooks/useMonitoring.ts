import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useMonitoring(pollingInterval = 3000) {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ['monitoring-status'],
    queryFn: () => api.getMonitoringStatus(),
    refetchInterval: pollingInterval,
  });

  const isRunning = Boolean(
    (statusQuery.data as any)?.active ??
    ((statusQuery.data as any)?.active_count > 0)
  );

  const currentSessionId =
    (statusQuery.data as any)?.current_session?.id ??
    (statusQuery.data as any)?.sessions?.[0]?.session_id?.toString() ??
    undefined;

  const metricsQuery = useQuery({
    queryKey: ['monitoring-metrics', currentSessionId],
    queryFn: () => api.getMetrics(currentSessionId),
    enabled: isRunning && !!currentSessionId,
    refetchInterval: isRunning ? pollingInterval : false,
  });

  const startMutation = useMutation({
    mutationFn: (data: { target_id: string; interval_seconds?: number }) =>
      api.startMonitoring(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-status'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-metrics'] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: (data?: { session_id?: string }) => api.stopMonitoring(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-status'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-sessions'] });
    },
  });

  const sessionsQuery = useQuery({
    queryKey: ['monitoring-sessions'],
    queryFn: () => api.getSessions(),
  });

  return {
    status: statusQuery.data,
    isLoadingStatus: statusQuery.isLoading,
    isStatusError: statusQuery.isError,
    isRunning,
    currentSessionId,
    metrics: metricsQuery.data,
    isLoadingMetrics: metricsQuery.isLoading,
    sessions: sessionsQuery.data || [],
    isLoadingSessions: sessionsQuery.isLoading,
    startMonitoring: startMutation.mutateAsync,
    isStarting: startMutation.isPending,
    stopMonitoring: stopMutation.mutateAsync,
    isStopping: stopMutation.isPending,
    refetchStatus: statusQuery.refetch,
    refetchMetrics: metricsQuery.refetch,
  };
}
