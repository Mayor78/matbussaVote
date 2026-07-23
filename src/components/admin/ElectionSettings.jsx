import React, { useState } from 'react';
import { electionService } from '../../services/electionService';
import { validateElectionReady } from '../../utils/electionValidation';
import { AlertCircle, CheckCircle, Play, Square, Eye } from 'lucide-react';
import AuthCodeModal from '../AuthCodeModal';
import swal from '../../utils/swal';

export const ElectionSettings = ({ election, positions = [], candidates = [], onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [showAuthCode, setShowAuthCode] = useState(false);
  const [authAction, setAuthAction] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  const handleValidateAndPublish = async () => {
    setLoading(true);
    try {
      const validation = await validateElectionReady(election.id);
      if (!validation.isValid) {
        setValidationErrors(validation.errors);
        swal.error('Error', 'Cannot publish: Please fix the issues below');
        return;
      }
      setValidationErrors([]);
      await electionService.publishElection(election.id);
      swal.success('Success', 'Election published!');
      onUpdate();
    } catch (error) {
      swal.error('Error', error.message);
    } finally { setLoading(false); }
  };

  const handleOpenElection = async () => {
    setLoading(true);
    try {
      await electionService.openElection(election.id);
      swal.success('Success', 'Voting is now OPEN!');
      onUpdate();
    } catch (error) {
      swal.error('Error', error.message);
    } finally { setLoading(false); }
  };

  const requireCode = (action, callback) => {
    setAuthAction(action);
    setPendingAction(() => callback);
    setShowAuthCode(true);
  };

  const handleCloseElection = () => {
    requireCode('CLOSE_ELECTION', async () => {
      if (!window.confirm('Close this election? Voting will end immediately.')) return;
      setLoading(true);
      try {
        await electionService.closeElection(election.id);
        swal.success('Success', 'Election closed');
        onUpdate();
      } catch (error) {
        swal.error('Error', error.message);
      } finally { setLoading(false); }
    });
  };

  const status = election?.status || 'draft';

  return (
    <>
      <div className="space-y-4">
        {validationErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-800 font-medium text-sm">Cannot publish:</p>
                <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                  {validationErrors.map((error, i) => <li key={i}>{error}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-sm text-gray-600">
            <strong>Status:</strong>{' '}
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              status === 'draft' ? 'bg-gray-200 text-gray-800' :
              status === 'published' ? 'bg-blue-100 text-blue-800' :
              status === 'open' ? 'bg-green-100 text-green-800' :
              'bg-red-100 text-red-800'
            }`}>{status.toUpperCase()}</span>
          </p>
          {status === 'draft' && <p className="text-xs text-gray-500 mt-1">Add positions and candidates before publishing.</p>}
          {status === 'published' && <p className="text-xs text-gray-500 mt-1">Election is ready. Open voting to start.</p>}
          {status === 'open' && <p className="text-xs text-gray-500 mt-1">Voting is active. Close when period ends.</p>}
        </div>

        {status === 'draft' && (
          <button onClick={handleValidateAndPublish} disabled={loading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
            <Eye className="w-4 h-4" /> {loading ? 'Processing...' : 'Validate & Publish'}
          </button>
        )}

        {status === 'published' && (
          <button onClick={handleOpenElection} disabled={loading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50">
            <Play className="w-4 h-4" /> {loading ? 'Processing...' : 'Open Voting'}
          </button>
        )}

        {status === 'open' && (
          <button onClick={handleCloseElection} disabled={loading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50">
            <Square className="w-4 h-4" /> {loading ? 'Processing...' : 'Close Election (Code Required)'}
          </button>
        )}

        {status === 'draft' && (
          <div className="border-t pt-3">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Requirements:</h3>
            <div className="space-y-1.5">
              <Requirement text="At least one position" met={positions.length > 0} />
              <Requirement text="Each position has at least one candidate" met={positions.length > 0 && positions.every(p => candidates.some(c => c.positionId === p.id))} />
            </div>
          </div>
        )}
      </div>

      <AuthCodeModal
        isOpen={showAuthCode}
        onClose={() => { setShowAuthCode(false); setPendingAction(null); }}
        action={authAction}
        onAuthorized={() => {
          if (pendingAction) { const fn = pendingAction; setPendingAction(null); fn(); }
        }}
      />
    </>
  );
};

const Requirement = ({ text, met }) => (
  <div className="flex items-center gap-2 text-sm">
    {met ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-gray-400" />}
    <span className={met ? 'text-gray-700' : 'text-gray-500'}>{text}</span>
  </div>
);
