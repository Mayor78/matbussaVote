import React, { useState } from 'react';
import { candidateService } from '../../services/candidateService';
import { CandidateForm } from './CandidateForm';
import Modal from '../Modal';
import AuthCodeModal from '../AuthCodeModal';
import { Edit2, Trash2, User } from 'lucide-react';

export const CandidateCard = ({ candidate, positionTitle, onUpdate }) => {
  const [showEdit, setShowEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAuthCode, setShowAuthCode] = useState(false);

  const handleDeleteClick = () => {
    if (window.confirm(`Delete candidate "${candidate.fullName}"?`)) {
      setShowAuthCode(true);
    }
  };

  const handleAuthorized = async () => {
    setDeleting(true);
    try {
      await candidateService.deleteCandidate(candidate.id);
      onUpdate();
    } catch { /* handled by parent */ }
    finally { setDeleting(false); }
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition">
        <div className="relative h-32 bg-gradient-to-r from-primary-500 to-primary-700">
          {candidate.photoUrl ? (
            <img src={candidate.photoUrl} alt={candidate.fullName} className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <User className="w-12 h-12 text-white/50" />
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
            <h3 className="text-white font-semibold">{candidate.fullName}</h3>
            <p className="text-white/80 text-sm">Level: {candidate.level}</p>
          </div>
        </div>
        
        <div className="p-3">
          <div className="text-xs text-gray-500 mb-2">{positionTitle}</div>
          <p className="text-sm text-gray-600 line-clamp-2">{candidate.manifesto}</p>
          
          <div className="flex justify-end gap-1 mt-3 pt-2 border-t">
            <button onClick={() => setShowEdit(true)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded" disabled={deleting}>
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={handleDeleteClick} disabled={deleting} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title={`Edit ${candidate.fullName}`}>
        <CandidateForm
          electionId={candidate.electionId}
          positionId={candidate.positionId}
          candidate={candidate}
          onSuccess={() => { setShowEdit(false); onUpdate(); }}
          onCancel={() => setShowEdit(false)}
        />
      </Modal>

      <AuthCodeModal
        isOpen={showAuthCode}
        onClose={() => setShowAuthCode(false)}
        action="DELETE_CANDIDATE"
        onAuthorized={handleAuthorized}
      />
    </>
  );
};
