import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { positionService } from '../services/positionService';
import toast from 'react-hot-toast';

export const usePositions = (electionId) => {
  const queryClient = useQueryClient();

  const { data: positions = [], isLoading, refetch } = useQuery({
    queryKey: ['positions', electionId],
    queryFn: () => positionService.getPositionsByElection(electionId),
    enabled: !!electionId,
    staleTime: 30000,
  });

  const createMutation = useMutation({
    mutationFn: (data) => positionService.createPosition({ ...data, electionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions', electionId] });
      toast.success('Position added!');
    },
    onError: () => toast.error('Failed to add position'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => positionService.updatePosition(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions', electionId] });
      toast.success('Position updated!');
    },
    onError: () => toast.error('Failed to update position'),
  });

  const deleteMutation = useMutation({
    mutationFn: positionService.deletePosition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions', electionId] });
      toast.success('Position deleted!');
    },
    onError: () => toast.error('Failed to delete position'),
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
