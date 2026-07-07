import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Users, Search, Plus, Award } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { CandidateCard } from '../components/admin/CandidateCard';
import { CandidateForm } from '../components/admin/CandidateForm';

const fetchAllData = async () => {
  const [candSnap, elecSnap, posSnap] = await Promise.all([
    getDocs(collection(db, 'candidates')),
    getDocs(collection(db, 'elections')),
    getDocs(collection(db, 'positions')),
  ]);
  return {
    candidates: candSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    elections: elecSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    positions: posSnap.docs.map(d => ({ id: d.id, ...d.data() })),
  };
};

export const CandidateManagement = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedElectionFilter, setSelectedElectionFilter] = useState('');
  const [selectedPositionFilter, setSelectedPositionFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['candidateManagement'],
    queryFn: fetchAllData,
  });

  const candidates = data?.candidates || [];
  const elections = data?.elections || [];
  const positions = data?.positions || [];

  const getPositionTitle = (positionId) => {
    const p = positions.find(pp => pp.id === positionId);
    return p ? p.title : 'Unknown';
  };

  const filtered = candidates.filter(c => {
    const matchesSearch = c.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesElection = selectedElectionFilter === '' || c.electionId === selectedElectionFilter;
    const matchesPosition = selectedPositionFilter === '' || c.positionId === selectedPositionFilter;
    return matchesSearch && matchesElection && matchesPosition;
  });

  const filteredPositions = positions.filter(p => selectedElectionFilter === '' || p.electionId === selectedElectionFilter);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Candidate Management</h1>
          <p className="text-gray-600 text-sm mt-0.5">Manage all election candidates</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} size="sm">
          <Plus className="w-4 h-4 mr-1.5 inline" /> Add Candidate
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Card className="flex items-center gap-3 p-4"><div className="p-2.5 bg-primary-100 text-primary-600 rounded-lg"><Users className="w-5 h-5" /></div><div><p className="text-xs text-gray-500">Total Candidates</p><p className="text-xl font-bold">{candidates.length}</p></div></Card>
        <Card className="flex items-center gap-3 p-4"><div className="p-2.5 bg-green-100 text-green-600 rounded-lg"><Award className="w-5 h-5" /></div><div><p className="text-xs text-gray-500">Active Elections</p><p className="text-xl font-bold">{elections.filter(e => e.status === 'open' || e.status === 'published').length}</p></div></Card>
      </div>

      <Card className="p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input type="text" placeholder="Search candidates..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div className="flex gap-2">
          <select value={selectedElectionFilter} onChange={(e) => { setSelectedElectionFilter(e.target.value); setSelectedPositionFilter(''); }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Elections</option>
            {elections.map(el => <option key={el.id} value={el.id}>{el.title}</option>)}
          </select>
          <select value={selectedPositionFilter} onChange={(e) => setSelectedPositionFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Positions</option>
            {filteredPositions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
      </Card>

      {isLoading ? (
        <div className="text-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto mb-3"></div></div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center"><p className="text-gray-500 text-sm">No candidates found</p></Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {filtered.map(candidate => (
            <div key={candidate.id} className="relative group">
              <CandidateCard candidate={candidate} positionTitle={getPositionTitle(candidate.positionId)} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['candidateManagement'] })} />
              <div className="absolute top-2 left-2 bg-primary-600 text-white text-xs font-bold px-2 py-0.5 rounded shadow">
                {elections.find(e => e.id === candidate.electionId)?.title?.split(' ')[0] || 'Election'}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Candidate">
        <CandidateForm onSuccess={() => { setShowAddModal(false); queryClient.invalidateQueries({ queryKey: ['candidateManagement'] }); }} onCancel={() => setShowAddModal(false)} />
      </Modal>
    </div>
  );
};

export default CandidateManagement;
