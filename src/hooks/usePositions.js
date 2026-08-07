import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../lib/api';
import swal from '../utils/swal';

export const usePositions = (electionId) => {
  const queryClient = useQueryClient();

  const queryKey = ['positions', electionId];

  const { data: positions = [], isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => api.fetchPositions(electionId),
    enabled: !!electionId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.createPosition({ ...data, electionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions', electionId] });
      api.buildBundle(electionId).catch(() => {});
      swal.success('Position Added', 'Position has been added.');
    },
    onError: () => swal.error('Error', 'Failed to add position'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.updatePosition(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions', electionId] });
      api.buildBundle(electionId).catch(() => {});
      swal.success('Position Updated', 'Position has been updated.');
    },
    onError: () => swal.error('Error', 'Failed to update position'),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deletePosition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions', electionId] });
      api.buildBundle(electionId).catch(() => {});
      swal.success('Position Deleted', 'Position has been removed.');
    },
    onError: () => swal.error('Error', 'Failed to delete position'),
  });

  return {
    positions,
    loading: isLoading,
    fetchPositions: refetch,
    createPosition: createMutation.mutateAsync,
    updatePosition: (id, data) => updateMutation.mutateAsync({ id, data }),
    deletePosition: deleteMutation.mutateAsync,
  };
};
