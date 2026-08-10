import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../lib/api';
import swal from '../utils/swal';
import { getFriendlyError } from '../utils/errors';

export const useCandidates = (electionId, positionId = null) => {
  const queryClient = useQueryClient();

  const queryKey = positionId
    ? ['candidates', electionId, positionId]
    : ['candidates', electionId];

  const { data: candidates = [], isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => api.fetchCandidates({ electionId, positionId }),
    enabled: !!electionId,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  const createMutation = useMutation({
    mutationFn: ({ data, photoFile: _photoFile }) => api.createCandidate({ ...data, electionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates', electionId] });
      api.buildBundle(electionId).catch(() => {});
      swal.success('Candidate Added', 'Candidate has been added successfully.');
    },
    onError: (error) => swal.error('Oops!', getFriendlyError(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.updateCandidate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates', electionId] });
      api.buildBundle(electionId).catch(() => {});
      swal.success('Candidate Updated', 'Candidate has been updated.');
    },
    onError: (error) => swal.error('Oops!', getFriendlyError(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteCandidate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates', electionId] });
      api.buildBundle(electionId).catch(() => {});
      swal.success('Candidate Deleted', 'Candidate has been removed.');
    },
    onError: (error) => swal.error('Oops!', getFriendlyError(error)),
  });

  return {
    candidates,
    loading: isLoading,
    fetchCandidates: refetch,
    createCandidate: (data, _photoFile) => createMutation.mutateAsync({ data, photoFile: _photoFile }),
    updateCandidate: (id, data, _photoFile) => updateMutation.mutateAsync({ id, data, photoFile: _photoFile }),
    deleteCandidate: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
};
