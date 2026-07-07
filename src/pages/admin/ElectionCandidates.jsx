// src/pages/admin/ElectionCandidates.jsx
import React, { useState } from 'react';
import { CandidateCard } from '../../components/admin/CandidateCard';
import { CandidateForm } from '../../components/admin/CandidateForm';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import Card from '../../components/Card';
import { Plus, Users, AlertCircle } from 'lucide-react';

export const ElectionCandidates = ({ electionId, positions = [], candidates = [], onUpdate }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedPositionId, setSelectedPositionId] = useState('');

  const handleOpenAddForm = (posId = '') => {
    setSelectedPositionId(posId);
    setShowAddForm(true);
  };

  const handleSuccess = () => {
    setShowAddForm(false);
    setSelectedPositionId('');
    onUpdate();
  };

  if (positions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Positions Configured</h3>
        <p className="text-gray-600 mb-6">
          You must create at least one position before you can add candidates.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Tab Header Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Candidates</h2>
          <p className="text-sm text-gray-500">Manage candidates for each position</p>
        </div>
        <Button onClick={() => handleOpenAddForm()} icon={<Plus className="w-4 h-4" />}>
          Add Candidate
        </Button>
      </div>

      {/* Positions and their Candidates */}
      <div className="space-y-8">
        {positions.map((position) => {
          const positionCandidates = candidates.filter(
            (c) => c.positionId === position.id
          );

          return (
            <div key={position.id} className="border-b pb-8 last:border-b-0 last:pb-0">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary-600"></span>
                  <h3 className="text-md font-bold text-gray-900">{position.title}</h3>
                  <span className="ml-2 text-xs font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                    {positionCandidates.length} candidate{positionCandidates.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <button
                  onClick={() => handleOpenAddForm(position.id)}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 transition"
                >
                  <Plus className="w-4 h-4" /> Add Candidate
                </button>
              </div>

              {positionCandidates.length === 0 ? (
                <div className="p-6 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl text-center">
                  <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No candidates added yet for this position.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {positionCandidates.map((candidate) => (
                    <CandidateCard
                      key={candidate.id}
                      candidate={candidate}
                      positionTitle={position.title}
                      onUpdate={onUpdate}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Candidate Modal */}
      <Modal
        isOpen={showAddForm}
        onClose={() => {
          setShowAddForm(false);
          setSelectedPositionId('');
        }}
        title="Add Candidate"
      >
        <CandidateForm
          electionId={electionId}
          positionId={selectedPositionId}
          onSuccess={handleSuccess}
          onCancel={() => {
            setShowAddForm(false);
            setSelectedPositionId('');
          }}
        />
      </Modal>
    </div>
  );
};
