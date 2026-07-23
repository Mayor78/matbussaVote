import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { positionService } from '../services/positionService';
import { bundleService } from '../services/electionBundleService';
import swal from '../utils/swal';

export const usePositions = (electionId) => {
  const queryClient = useQueryClient();

  const queryKey = ['positions', electionId];

  const { data: positions = [], isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => positionService.getPositionsByElection(electionId),
    enabled: !!electionId,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  useEffect(() => {
    if (!electionId) return;
    const q = query(
      collection(db, 'positions'),
      where('electionId', '==', electionId),
      orderBy('displayOrder', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      queryClient.setQueryData(queryKey, data);
    });
    return () => unsubscribe();
  }, [electionId, queryKey, queryClient]);

  const createMutation = useMutation({
    mutationFn: (data) => positionService.createPosition({ ...data, electionId }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['positions', electionId] });
        bundleService.buildBundle(electionId).catch(() => {});
        swal.success('Position Added', 'Position has been added.');
      },
    onError: () => swal.error('Error', 'Failed to add position'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => positionService.updatePosition(id, data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['positions', electionId] });
        bundleService.buildBundle(electionId).catch(() => {});
        swal.success('Position Updated', 'Position has been updated.');
      },
    onError: () => swal.error('Error', 'Failed to update position'),
  });

  const deleteMutation = useMutation({
    mutationFn: positionService.deletePosition,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['positions', electionId] });
        bundleService.buildBundle(electionId).catch(() => {});
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
