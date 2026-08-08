import React, { useState, useMemo } from 'react';
import { useElections } from '../../hooks/useElections';
import { ElectionCard } from '../../components/admin/ElectionCard';
import { ElectionForm } from '../../components/admin/ElectionForm';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import { Plus, Inbox, Clock, LayoutList } from 'lucide-react';

const TABS = [
  { key: 'active', label: 'Active', icon: LayoutList },
  { key: 'history', label: 'History', icon: Clock },
];

export const Elections = () => {
  const { elections, loading, error, deleteElection, updateStatus, updateElection } = useElections();
  const [activeTab, setActiveTab] = useState('active');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editElection, setEditElection] = useState(null);

  const filtered = useMemo(() => {
    if (activeTab === 'history') return elections.filter(e => e.status === 'closed');
    return elections.filter(e => e.status !== 'closed');
  }, [elections, activeTab]);

  const handleReopen = async (id) => {
    try { await updateStatus(id, 'open'); } catch { /* handled by hook */ }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 font-semibold mb-2">Failed to load elections</p>
        <p className="text-red-500 text-sm">{error.message || 'Check that the API server is running and your session is active.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Elections</h1>
          <p className="text-gray-600 mt-1">Manage departmental elections</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-5 h-5 mr-2 inline" />
          Create Election
        </Button>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === key
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Inbox className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {activeTab === 'history' ? 'No Past Elections' : 'No Active Elections'}
          </h3>
          <p className="text-gray-500 mb-4">
            {activeTab === 'history'
              ? 'Closed elections will appear here for reference.'
              : 'Create your first election to get started.'}
          </p>
          {activeTab !== 'history' && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-5 h-5 mr-2 inline" /> Create Election
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((election) => (
            <ElectionCard
              key={election.id}
              election={election}
              onDelete={deleteElection}
              onEdit={setEditElection}
              onReopen={handleReopen}
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

      <Modal
        isOpen={!!editElection}
        onClose={() => setEditElection(null)}
        title="Edit Election"
      >
        {editElection && (
          <ElectionForm
            election={editElection}
            onSuccess={() => setEditElection(null)}
            onCancel={() => setEditElection(null)}
          />
        )}
      </Modal>
    </div>
  );
};
