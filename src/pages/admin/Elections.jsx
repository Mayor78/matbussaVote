// src/pages/admin/Elections.jsx
import React, { useState } from 'react';
import { useElections } from '../../hooks/useElections';
import { ElectionCard } from '../../components/admin/ElectionCard';
import { ElectionForm } from '../../components/admin/ElectionForm';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import { Plus, Inbox } from 'lucide-react';

export const Elections = () => {
  const { elections, loading, deleteElection } = useElections();
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Elections</h1>
          <p className="text-gray-600 mt-1">Manage departmental elections</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-5 h-5 mr-2 inline" />
          Create Election
        </Button>
      </div>

      {elections.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Inbox className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Elections Configured</h3>
          <p className="text-gray-500 mb-4">Create your first election to get started.</p>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-5 h-5 mr-2 inline" /> Create Election
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {elections.map((election) => (
            <ElectionCard 
              key={election.id} 
              election={election} 
              onDelete={deleteElection}
            />
          ))}
        </div>
      )}

      <Modal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)}
        title="Create New Election"
      >
        <ElectionForm 
          onSuccess={() => setShowCreateModal(false)}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>
    </div>
  );
};