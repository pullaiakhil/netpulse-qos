import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Target } from '@/lib/types';

export function useTargets() {
  const queryClient = useQueryClient();

  const targetsQuery = useQuery({
    queryKey: ['targets'],
    queryFn: () => api.getTargets(),
  });

  const createTargetMutation = useMutation({
    mutationFn: (newTarget: Omit<Target, 'id'>) => api.createTarget(newTarget),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets'] });
    },
  });

  const updateTargetMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Target> }) =>
      api.updateTarget(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets'] });
    },
  });

  const deleteTargetMutation = useMutation({
    mutationFn: (id: string) => api.deleteTarget(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets'] });
    },
  });

  return {
    ...targetsQuery,
    createTarget: createTargetMutation.mutateAsync,
    isCreating: createTargetMutation.isPending,
    updateTarget: updateTargetMutation.mutateAsync,
    isUpdating: updateTargetMutation.isPending,
    deleteTarget: deleteTargetMutation.mutateAsync,
    isDeleting: deleteTargetMutation.isPending,
  };
}
