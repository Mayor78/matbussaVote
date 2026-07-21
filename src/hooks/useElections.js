import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { electionService } from '../services/electionService';
import { auditService } from '../services/auditService';
import toast from 'react-hot-toast';

export const useElections = () => {
  const queryClient = useQueryClient();

  const { data: elections = [], isLoading, error } = useQuery({
    queryKey: ['elections'],
    queryFn: electionService.getAllElections,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  useEffect(() => {
    const q = query(collection(db, 'elections'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      queryClient.setQueryData(['elections'], data);
    });
    return () => unsubscribe();
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: electionService.createElection,
    onSuccess: (newElection) => {
      queryClient.setQueryData(['elections'], (old) => [newElection, ...(old || [])]);
      queryClient.invalidateQueries({ queryKey: ['election', newElection.id] });
      auditService.logAction({ action: 'ELECTION_CREATED', details: `Created election: ${newElection.title}` });
      toast.success('Election created!');
    },
    onError: () => toast.error('Failed to create election'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => electionService.updateElection(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['elections'], (old) =>
        (old || []).map(e => e.id === updated.id ? { ...e, ...updated } : e)
      );
      queryClient.invalidateQueries({ queryKey: ['election', updated.id] });
      auditService.logAction({ action: 'ELECTION_UPDATED', details: `Updated election: ${updated.title || updated.id}` });
      toast.success('Election updated!');
    },
    onError: () => toast.error('Failed to update election'),
  });

  const deleteMutation = useMutation({
    mutationFn: electionService.deleteElection,
    onSuccess: (_, id) => {
      queryClient.setQueryData(['elections'], (old) => (old || []).filter(e => e.id !== id));
      auditService.logAction({ action: 'ELECTION_DELETED', details: `Deleted election ID: ${id}` });
      toast.success('Election deleted!');
    },
    onError: () => toast.error('Failed to delete election'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => electionService.updateStatus(id, status),
    onSuccess: (result) => {
      queryClient.setQueryData(['elections'], (old) =>
        (old || []).map(e => e.id === result.id ? { ...e, status: result.status } : e)
      );
      queryClient.invalidateQueries({ queryKey: ['election', result.id] });
      auditService.logAction({ action: `ELECTION_${result.status.toUpperCase()}`, details: `Election ID: ${result.id}` });
      toast.success(`Election ${result.status}!`);
    },
    onError: () => toast.error('Failed to update status'),
  });

  return {
    elections,
    loading: isLoading,
    error,
    createElection: createMutation.mutateAsync,
    updateElection: (id, data) => updateMutation.mutateAsync({ id, data }),
    deleteElection: deleteMutation.mutateAsync,
    updateStatus: (id, status) => statusMutation.mutateAsync({ id, status }),
    getElectionById: electionService.getElectionById,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
