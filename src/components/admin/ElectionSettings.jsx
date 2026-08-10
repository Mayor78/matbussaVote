import React, { useState, useMemo } from 'react';
import { electionService } from '../../services/electionService';
import { Calendar, Clock } from 'lucide-react';
import { AlertCircle, CheckCircle, Play, Square, Eye, RotateCcw, Undo2 } from 'lucide-react';
import AuthCodeModal from '../AuthCodeModal';
import swal from '../../utils/swal';

function validateElectionFromProps(positions, candidates) {
  const errors = [];
  if (!positions || positions.length === 0) {
    errors.push('The election must have at least one position.');
  }
  for (const position of positions) {
    const hasCandidate = candidates.some((c) => c.positionId === position.id);
    if (!hasCandidate) {
      errors.push(`Position "${position.title}" must have at least one candidate.`);
    }
  }
  return { isValid: errors.length === 0, errors };
}

export const ElectionSettings = ({ election, positions = [], candidates = [], onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [showAuthCode, setShowAuthCode] = useState(false);
  const [authAction, setAuthAction] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  const existing = election?.levelWindows;
  const levelWindows = useMemo(() => {
    if (existing && Array.isArray(existing)) return existing;
    return [
      { levels: ['ND1', 'ND2'], opensAt: '', closesAt: '' },
      { levels: ['HND1', 'HND2'], opensAt: '', closesAt: '' },
    ];
  }, [existing]);

  const [groupAOpens, setGroupAOpens] = useState(
    (levelWindows[0]?.opensAt || '').substring(0, 16),
  );
  const [groupACloses, setGroupACloses] = useState(
    (levelWindows[0]?.closesAt || '').substring(0, 16),
  );
  const [groupBOpens, setGroupBOpens] = useState(
    (levelWindows[1]?.opensAt || '').substring(0, 16),
  );
  const [groupBCloses, setGroupBCloses] = useState(
    (levelWindows[1]?.closesAt || '').substring(0, 16),
  );

  const handleSaveLevelWindows = async () => {
    setLoading(true);
    try {
      await electionService.updateElection(election.id, {
        levelWindows: [
          { levels: ['ND1', 'ND2'], opensAt: groupAOpens ? new Date(groupAOpens).toISOString() : '', closesAt: groupACloses ? new Date(groupACloses).toISOString() : '' },
          { levels: ['HND1', 'HND2'], opensAt: groupBOpens ? new Date(groupBOpens).toISOString() : '', closesAt: groupBCloses ? new Date(groupBCloses).toISOString() : '' },
        ],
      });
      swal.success('Saved', 'Level voting windows updated.');
      onUpdate();
    } catch (error) {
      swal.error('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateAndPublish = async () => {
    setLoading(true);
    try {
      const validation = validateElectionFromProps(positions, candidates);
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

  const handleReopenElection = () => {
    requireCode('REOPEN_ELECTION', async () => {
      if (!window.confirm('Reopen this election for voting? The duration timer will restart from now.')) return;
      setLoading(true);
      try {
        await electionService.openElection(election.id);
        swal.success('Success', 'Election reopened for voting!');
        onUpdate();
      } catch (error) {
        swal.error('Error', error.message);
      } finally { setLoading(false); }
    });
  };

  const handleRollbackToDraft = async () => {
    if (!window.confirm('Return this election to draft? This will allow you to edit positions and candidates.')) return;
    setLoading(true);
    try {
      await electionService.updateStatus(election.id, 'draft');
      swal.success('Success', 'Election returned to draft');
      onUpdate();
    } catch (error) {
      swal.error('Error', error.message);
    } finally { setLoading(false); }
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
          {status === 'closed' && <p className="text-xs text-gray-500 mt-1">Voting has ended. You can reopen if needed.</p>}
        </div>

        {status === 'draft' && (
          <button onClick={handleValidateAndPublish} disabled={loading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
            <Eye className="w-4 h-4" /> {loading ? 'Processing...' : 'Validate & Publish'}
          </button>
        )}

        {status === 'published' && (
          <>
            <button onClick={handleOpenElection} disabled={loading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50">
              <Play className="w-4 h-4" /> {loading ? 'Processing...' : 'Open Voting'}
            </button>
            <button onClick={handleRollbackToDraft} disabled={loading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm disabled:opacity-50 mt-2">
              <Undo2 className="w-4 h-4" /> Return to Draft
            </button>
          </>
        )}

        {status === 'open' && (
          <button onClick={handleCloseElection} disabled={loading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50">
            <Square className="w-4 h-4" /> {loading ? 'Processing...' : 'Close Election (Code Required)'}
          </button>
        )}

        {status === 'closed' && (
          <button onClick={handleReopenElection} disabled={loading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50">
            <RotateCcw className="w-4 h-4" /> {loading ? 'Processing...' : 'Reopen for Voting (Code Required)'}
          </button>
        )}

        <div className="border-t pt-3 mt-3">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-gray-500" /> Level Voting Windows
          </h3>
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-bold text-amber-800 mb-2">Group A — ND1 &amp; ND2</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500 font-semibold uppercase">Opens At</label>
                  <input
                    type="datetime-local"
                    value={groupAOpens}
                    onChange={(e) => setGroupAOpens(e.target.value)}
                    className="w-full px-2 py-1.5 border border-amber-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-semibold uppercase">Closes At</label>
                  <input
                    type="datetime-local"
                    value={groupACloses}
                    onChange={(e) => setGroupACloses(e.target.value)}
                    className="w-full px-2 py-1.5 border border-amber-300 rounded text-xs"
                  />
                </div>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-bold text-blue-800 mb-2">Group B — HND1 &amp; HND2</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500 font-semibold uppercase">Opens At</label>
                  <input
                    type="datetime-local"
                    value={groupBOpens}
                    onChange={(e) => setGroupBOpens(e.target.value)}
                    className="w-full px-2 py-1.5 border border-blue-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-semibold uppercase">Closes At</label>
                  <input
                    type="datetime-local"
                    value={groupBCloses}
                    onChange={(e) => setGroupBCloses(e.target.value)}
                    className="w-full px-2 py-1.5 border border-blue-300 rounded text-xs"
                  />
                </div>
              </div>
            </div>
            <button
              onClick={handleSaveLevelWindows}
              disabled={loading}
              className="w-full py-2 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Level Windows'}
            </button>
            <p className="text-[10px] text-gray-400 text-center">Leave empty to allow voting anytime for that group.</p>
          </div>
        </div>

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
