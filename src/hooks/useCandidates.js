import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { candidateService } from '../services/candidateService';
import { bundleService } from '../services/electionBundleService';
import toast from 'react-hot-toast';

export const useCandidates = (electionId, positionId = null) => {
  const queryClient = useQueryClient();

  const queryKey = positionId
    ? ['candidates', electionId, positionId]
    : ['candidates', electionId];

  const { data: candidates = [], isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => positionId
      ? candidateService.getCandidatesByPosition(positionId)
      : candidateService.getCandidatesByElection(electionId),
    enabled: !!electionId,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  useEffect(() => {
    if (!electionId) return;
    const constraints = [where('electionId', '==', electionId)];
    if (positionId) constraints.push(where('positionId', '==', positionId));
    const q = query(collection(db, 'candidates'), ...constraints);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      queryClient.setQueryData(queryKey, data);
    });
    return () => unsubscribe();
  }, [electionId, positionId, queryKey, queryClient]);

  const createMutation = useMutation({
    mutationFn: ({ data, photoFile }) => candidateService.createCandidate({ ...data, electionId }, photoFile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates', electionId] });
      bundleService.buildBundle(electionId).catch(() => {});
      toast.success('Candidate added!');
    },
    onError: () => toast.error('Failed to add candidate'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data, photoFile }) => candidateService.updateCandidate(id, data, photoFile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates', electionId] });
      bundleService.buildBundle(electionId).catch(() => {});
      toast.success('Candidate updated!');
    },
    onError: () => toast.error('Failed to update candidate'),
  });

  const deleteMutation = useMutation({
    mutationFn: candidateService.deleteCandidate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates', electionId] });
      bundleService.buildBundle(electionId).catch(() => {});
      toast.success('Candidate deleted!');
    },
    onError: () => toast.error('Failed to delete candidate'),
  });

  return {
    candidates,
    loading: isLoading,
    fetchCandidates: refetch,
    createCandidate: (data, photoFile) => createMutation.mutateAsync({ data, photoFile }),
    updateCandidate: (id, data, photoFile) => updateMutation.mutateAsync({ id, data, photoFile }),
    deleteCandidate: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
};
