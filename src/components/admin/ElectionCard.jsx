import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Edit2, Trash2, Eye, RotateCcw, Play } from 'lucide-react';
import AuthCodeModal from '../AuthCodeModal';
import Card from '../Card';
import { useElections } from '../../hooks/useElections';

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  published: 'bg-blue-100 text-blue-800',
  open: 'bg-green-100 text-green-800',
  closed: 'bg-red-100 text-red-800',
};

export const ElectionCard = ({ election, onDelete, onEdit, onReopen }) => {
  const navigate = useNavigate();
  const [showAuthCode, setShowAuthCode] = useState(false);
  const [authAction, setAuthAction] = useState(null);

  const handleDeleteClick = () => {
    if (window.confirm(`Delete "${election.title}"?`)) {
      setAuthAction('DELETE_ELECTION');
      setShowAuthCode(true);
    }
  };

  const handleReopenClick = () => {
    if (window.confirm(`Reopen "${election.title}" for voting? The duration timer will restart.`)) {
      setAuthAction('REOPEN_ELECTION');
      setShowAuthCode(true);
    }
  };

  const onAuthorizedAuth = () => {
    if (authAction === 'DELETE_ELECTION') {
      onDelete(election.id);
    } else if (authAction === 'REOPEN_ELECTION') {
      onReopen(election.id);
    }
    setShowAuthCode(false);
    setAuthAction(null);
  };

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow">
        <div className="p-4">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-base font-semibold text-gray-900 line-clamp-1">{election.title}</h3>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[election.status]}`}>
              {election.status}
            </span>
          </div>
          
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{election.description || 'No description'}</p>
          
          <div className="space-y-1.5 text-sm text-gray-500 mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{election.academicSession || election.academic_session}</span>
            </div>
          </div>
          
          <div className="flex justify-end gap-1.5 pt-3 border-t">
            <button onClick={() => navigate(`/admin/elections/${election.id}`)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="View">
              <Eye className="w-4 h-4" />
            </button>
            {(election.status === 'draft' || election.status === 'published') && (
              <button onClick={() => onEdit(election)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition" title="Edit">
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            {election.status === 'closed' && (
              <button onClick={handleReopenClick} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition" title="Reopen for voting">
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button onClick={handleDeleteClick} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      <AuthCodeModal
        isOpen={showAuthCode}
        onClose={() => { setShowAuthCode(false); setAuthAction(null); }}
        action={authAction}
        onAuthorized={onAuthorizedAuth}
      />
    </>
  );
};
