import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useElections } from '../../hooks/useElections';
import { usePositions } from '../../hooks/usePositions';
import { useCandidates } from '../../hooks/useCandidates';
import { ElectionOverview } from './ElectionOverview';
import { ElectionPositions } from './ElectionPositions';
import { ElectionCandidates } from './ElectionCandidates';
import { ElectionSettings } from '../../components/admin/ElectionSettings';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'positions', label: 'Positions' },
  { id: 'candidates', label: 'Candidates' },
  { id: 'settings', label: 'Settings' }
];

export const ElectionDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  
  const { getElectionById } = useElections();
  const { positions, fetchPositions } = usePositions(id);
  const { candidates, fetchCandidates } = useCandidates(id);
  
  const [election, setElection] = useState(null);

  const loadElection = useCallback(async () => {
    const data = await getElectionById(id);
    setElection(data);
  }, [id, getElectionById]);

  React.useEffect(() => {
    loadElection();
    fetchPositions();
    fetchCandidates();
  }, [loadElection, fetchPositions, fetchCandidates]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <ElectionOverview election={election} positions={positions} candidates={candidates} />;
      case 'positions':
        return <ElectionPositions electionId={id} positions={positions} onUpdate={fetchPositions} />;
      case 'candidates':
        return <ElectionCandidates electionId={id} positions={positions} candidates={candidates} onUpdate={fetchCandidates} />;
      case 'settings':
        return <ElectionSettings election={election} positions={positions} candidates={candidates} onUpdate={loadElection} />;
      default:
        return null;
    }
  };

  return (
    <div className="p-3 sm:p-6">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <button onClick={() => navigate('/admin/elections')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{election?.title || 'Election Details'}</h1>
      </div>

      <div className="border-b border-gray-200 mb-4 sm:mb-6">
        <nav className="flex gap-4 sm:gap-6 overflow-x-auto items-center">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2.5 px-1 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={() => navigate(`/admin/elections/${id}/verify`)}
            className="pb-2.5 px-1 text-sm font-medium text-green-600 hover:text-green-700 whitespace-nowrap flex items-center gap-1 ml-2"
          >
            <ShieldCheck className="w-4 h-4" />
            Verify Results
          </button>
        </nav>
      </div>

      {renderTabContent()}
    </div>
  );
};
