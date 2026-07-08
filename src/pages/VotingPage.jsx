import { useState, useEffect, useCallback } from 'react';
import { auth, db } from '../lib/firebase';
import { collection, query, where, getDocs, runTransaction, doc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle, User, AlertCircle, ArrowLeft, Vote, ChevronRight, Clock } from 'lucide-react';
import Modal from '../components/Modal';
import Button from '../components/Button';
import { getUserFriendlyError } from '../utils/errors';
import { auditService } from '../services/auditService';
import { generateDeviceSignature } from '../utils/deviceFingerprint';
import { CountdownBanner, useCountdown } from '../components/CountdownTimer';

const generateVoteHash = async (electionId, positionId, studentId) => {
  const payload = `${electionId}:${positionId}:${studentId}:${Date.now()}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return 'v_' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const VotingPage = () => {
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [student, setStudent] = useState(null);
  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState(null);
  const [positions, setPositions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [myVotes, setMyVotes] = useState({});
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [activePositionId, setActivePositionId] = useState(null);
  const navigate = useNavigate();

  const loadElectionData = async (electionId, studentId) => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        getDocs(query(collection(db, 'positions'), where('electionId', '==', electionId))),
        getDocs(query(collection(db, 'candidates'), where('electionId', '==', electionId))),
        getDocs(query(collection(db, 'votes'), where('electionId', '==', electionId), where('studentId', '==', studentId))),
      ]);

      const labels = ['positions', 'candidates', 'votes'];
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.error(`[VotingPage] ${labels[i]} read failed:`, r.reason.code, r.reason.message);
        }
      });

      const failed = results.findIndex(r => r.status === 'rejected');
      if (failed >= 0) {
        throw new Error(`Failed to read ${labels[failed]}: ${results[failed].reason.message}`);
      }

      const [posSnap, candSnap, voteSnap] = results.map(r => r.value);

      const posList = posSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      posList.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      setPositions(posList);
      setCandidates(candSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const existing = {};
      voteSnap.docs.forEach(d => { const v = d.data(); existing[v.positionId] = v.candidateId; });
      setMyVotes(existing);
    } catch (err) {
      console.error('Failed to load election data:', err.code, err.message);
      toast.error(getUserFriendlyError(err));
    } finally { setLoading(false); }
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) { navigate('/login'); return; }

      const allStudents = await getDocs(collection(db, 'students'));
      let currentStudent = null;
      for (const d of allStudents.docs) {
        const data = { id: d.id, ...d.data() };
        if (data.email?.toLowerCase() === user.email?.toLowerCase()) {
          currentStudent = {
            ...data,
            fullName: data.fullName || data.full_name || '',
            matricNumber: data.matricNumber || data.matric_number || '',
          };
          break;
        }
      }
      if (!currentStudent) { toast.error('Student profile not found.'); navigate('/student'); return; }
      setStudent(currentStudent);

      const openElectionsSnap = await getDocs(query(collection(db, 'elections'), where('status', '==', 'open')));
      const openElections = openElectionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setElections(openElections);

      if (openElections.length === 0) { setLoading(false); return; }

      if (openElections.length === 1) {
        const e = openElections[0];
        setSelectedElection(e);
        await loadElectionData(e.id, currentStudent.id);
      }
    } catch (err) {
      console.error('Failed to load voting data:', err.code, err.message);
      toast.error(getUserFriendlyError(err));
    } finally { setLoading(false); }
  }, [navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSelectElection = async (election) => {
    setSelectedElection(election);
    setMyVotes({});
    await loadElectionData(election.id, student.id);
  };

  const castVote = async (positionId, candidateId) => {
    if (!student || !selectedElection || voting) return;

    if (selectedElection.closesAt && Date.now() > new Date(selectedElection.closesAt).getTime()) {
      toast.error('This election has ended. Voting is closed.');
      try {
        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('../lib/firebase');
        await updateDoc(doc(db, 'elections', selectedElection.id), {
          status: 'closed',
          updatedAt: new Date().toISOString(),
        });
        setSelectedElection(null);
      } catch {}
      return;
    }

    setVoting(true);
    setMyVotes(prev => ({ ...prev, [positionId]: 'processing' }));

    // Warn user before leaving page during vote
    const beforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);

    try {
      const voteHash = await generateVoteHash(selectedElection.id, positionId, student.id);
      const deviceSignature = await generateDeviceSignature();
      const lockRef = doc(db, 'voteLocks', `${student.id}_${positionId}`);

      await runTransaction(db, async (transaction) => {
        const lockDoc = await transaction.get(lockRef);
        if (lockDoc.exists()) throw new Error('ALREADY_VOTED');

        const checkSnap = await getDocs(query(
          collection(db, 'votes'),
          where('electionId', '==', selectedElection.id),
          where('positionId', '==', positionId),
          where('studentId', '==', student.id)
        ));
        if (!checkSnap.empty) throw new Error('ALREADY_VOTED');

        transaction.set(lockRef, {
          electionId: selectedElection.id, positionId, studentId: student.id,
          createdAt: new Date().toISOString(),
        });

        const voteRef = doc(collection(db, 'votes'));
        transaction.set(voteRef, {
          electionId: selectedElection.id, positionId, candidateId,
          studentId: student.id, voteHash, deviceSignature,
          createdAt: new Date().toISOString(),
        });
      });

      setMyVotes(prev => ({ ...prev, [positionId]: candidateId }));
      localStorage.setItem(`vote_${positionId}`, voteHash);
      setActivePositionId(null);
      setSelectedCandidate(null);
      toast.success('Vote recorded!');

      try {
        await auditService.logAction({
          action: 'VOTE_CAST',
          details: `Vote recorded: election="${selectedElection.id}", position="${positionId}"`,
        });
      } catch { /* audit is best-effort */ }

      try {
        const studentRef = doc(db, 'students', student.id);
        await updateDoc(studentRef, {
          votingStatus: true,
          updatedAt: new Date().toISOString(),
        });
      } catch { /* votingStatus update is best-effort */ }
    } catch (error) {
      if (error.message === 'ALREADY_VOTED') {
        toast.error('You already voted for this position');
        setMyVotes(prev => ({ ...prev, [positionId]: 'existing' }));
      } else {
        toast.error('Vote failed. Your vote was NOT recorded. Please try again.');
        setMyVotes(prev => {
          const updated = { ...prev };
          delete updated[positionId];
          return updated;
        });
      }
      setActivePositionId(null);
      setSelectedCandidate(null);
    } finally {
      setVoting(false);
      window.removeEventListener('beforeunload', beforeUnload);
    }
  };

  const votedCount = Object.keys(myVotes).length;
  const allVoted = positions.length > 0 && votedCount >= positions.length;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-3 border-primary-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-500 text-lg">Loading elections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <button onClick={() => selectedElection ? setSelectedElection(null) : navigate('/student')}
        className="flex items-center gap-1.5 text-gray-600 hover:text-primary-600 mb-4 text-base">
        <ArrowLeft className="w-5 h-5" /> {selectedElection ? 'Choose another election' : 'Back to Dashboard'}
      </button>

      {/* ELECTION SELECTION SCREEN */}
      {!selectedElection && (
        <div className="space-y-5">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mb-4">
              <Vote className="w-10 h-10 text-primary-600" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Vote Now</h1>
            <p className="text-gray-600 text-base mt-1">Select an election to begin voting</p>
          </div>

          {elections.length === 0 ? (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-10 text-center">
              <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">No Active Election</h2>
              <p className="text-gray-600 text-base">No election is currently open for voting. Please check back later.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {elections.map(election => {
                const session = election.academicSession || election.academic_session || '';
                const endDate = election.endDate || election.end_date;
                return (
                  <button
                    key={election.id}
                    onClick={() => handleSelectElection(election)}
                    className="bg-white rounded-2xl shadow-md border-2 border-gray-100 hover:border-primary-400 hover:shadow-lg p-6 text-left transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-bold text-gray-900 group-hover:text-primary-700">{election.title}</h2>
                        {session && <p className="text-gray-500 text-base mt-1">Academic Session: {session}</p>}
                        {election.description && <p className="text-gray-600 text-sm mt-2">{election.description}</p>}
                        {endDate && (
                          <p className="text-red-500 text-sm mt-2 font-medium">
                            Deadline: {new Date(endDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-8 h-8 text-gray-300 group-hover:text-primary-500 flex-shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VOTING SCREEN */}
      {selectedElection && (
        <div className="space-y-6">
          <div className="text-center mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{selectedElection.title}</h1>
            <p className="text-gray-500 text-base mt-1">
              {selectedElection.academicSession || selectedElection.academic_session || ''}
            </p>
          </div>

          {selectedElection.closesAt && (
            <CountdownBanner closesAt={selectedElection.closesAt} />
          )}

          {/* Progress bar */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-base font-semibold text-gray-700">Your Progress</span>
              <span className="text-lg font-bold text-primary-600">{votedCount} / {positions.length}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="bg-green-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${positions.length > 0 ? (votedCount / positions.length) * 100 : 0}%` }}>
              </div>
            </div>
            {!allVoted && <p className="text-sm text-gray-500 mt-2">Vote for each position below</p>}
          </div>

          {/* Positions */}
          {positions.map(position => {
            const positionCandidates = candidates.filter(c => c.positionId === position.id);
            const hasVoted = myVotes[position.id];
            const isProcessing = hasVoted === 'processing';
            const votedCandidate = positionCandidates.find(c => c.id === hasVoted && hasVoted !== 'existing' && hasVoted !== 'processing');

            return (
              <div key={position.id} className="bg-white rounded-2xl shadow-md border overflow-hidden">
                <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-4">
                  <h2 className="text-xl font-bold text-white">{position.title}</h2>
                  <p className="text-primary-100 text-sm mt-1">Vote for one candidate</p>
                </div>

                <div className="p-4 sm:p-5">
                  {positionCandidates.length === 0 ? (
                    <div className="text-center py-8">
                      <User className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-base">No candidates for this position yet.</p>
                    </div>
                  ) : isProcessing ? (
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5 text-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent mx-auto mb-3"></div>
                      <p className="text-blue-800 font-semibold text-base">Recording your vote...</p>
                      <p className="text-blue-600 text-sm mt-1">Please wait, do not leave this page.</p>
                    </div>
                  ) : hasVoted ? (
                    <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5">
                      <div className="flex items-center gap-1.5 mb-3">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                        <span className="text-green-800 font-semibold text-base">Vote Recorded</span>
                      </div>
                      {votedCandidate ? (
                        <div className="flex items-center gap-4 bg-white rounded-xl p-4">
                          {votedCandidate.photoUrl ? (
                            <img src={votedCandidate.photoUrl} alt=""
                              className="w-24 h-24 rounded-xl object-cover border-4 border-green-400 flex-shrink-0" />
                          ) : (
                            <div className="w-24 h-24 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                              <User className="w-12 h-12 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">{votedCandidate.fullName}</h3>
                            <p className="text-gray-500 text-base">Level: {votedCandidate.level}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-green-700 text-base">You have voted for this position.</p>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {positionCandidates.map(candidate => (
                        <div key={candidate.id}
                          className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5 p-4 border-2 border-gray-100 rounded-2xl hover:border-primary-300 hover:bg-primary-50/30 transition-all cursor-pointer"
                          onClick={() => {
                            if (!voting) {
                              setActivePositionId(position.id);
                              setSelectedCandidate(candidate);
                            }
                          }}
                        >
                          {/* Large candidate photo */}
                          <div className="flex-shrink-0">
                            {candidate.photoUrl ? (
                              <img src={candidate.photoUrl} alt={candidate.fullName}
                                className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover border-2 border-gray-200 shadow-sm" />
                            ) : (
                              <div className="w-28 h-28 sm:w-32 sm:h-32 bg-gray-100 rounded-2xl flex items-center justify-center border-2 border-gray-200">
                                <User className="w-14 h-14 sm:w-16 sm:h-16 text-gray-400" />
                              </div>
                            )}
                          </div>

                          {/* Candidate info */}
                          <div className="flex-1 text-center sm:text-left">
                            <h3 className="text-lg sm:text-xl font-bold text-gray-900">{candidate.fullName}</h3>
                            <p className="text-gray-500 text-base">Level: {candidate.level}</p>
                            {candidate.manifesto && (
                              <p className="text-gray-600 text-sm mt-2 line-clamp-3">{candidate.manifesto}</p>
                            )}
                          </div>

                          {/* Vote button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActivePositionId(position.id);
                              setSelectedCandidate(candidate);
                            }}
                            disabled={voting}
                            className="flex-shrink-0 w-full sm:w-auto px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white text-lg font-bold rounded-xl transition-all disabled:opacity-50 shadow-md hover:shadow-lg"
                          >
                            Vote
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Finish button */}
          {allVoted && (
            <div className="text-center pt-4">
              <button
                onClick={() => navigate('/student/confirmation')}
                className="px-10 py-4 bg-green-600 hover:bg-green-700 text-white text-xl font-bold rounded-xl shadow-lg transition-all"
              >
                <CheckCircle className="w-6 h-6 inline mr-2" />
                Finish Voting
              </button>
            </div>
          )}
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      <Modal
        isOpen={!!selectedCandidate}
        onClose={() => { setSelectedCandidate(null); setActivePositionId(null); }}
        title="Cast Your Vote"
        size="sm"
      >
        {selectedCandidate && activePositionId && (
          <div className="space-y-5">
            <div className="text-center">
              {selectedCandidate.photoUrl ? (
                <img src={selectedCandidate.photoUrl} alt=""
                  className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl object-cover mx-auto border-4 border-primary-200 shadow-lg" />
              ) : (
                <div className="w-36 h-36 sm:w-44 sm:h-44 bg-gray-100 rounded-2xl mx-auto flex items-center justify-center border-4 border-primary-200">
                  <User className="w-20 h-20 text-gray-400" />
                </div>
              )}
              <h3 className="text-2xl font-bold text-gray-900 mt-4">{selectedCandidate.fullName}</h3>
              <p className="text-gray-500 text-lg">Level: {selectedCandidate.level}</p>
              {selectedCandidate.manifesto && (
                <p className="text-gray-600 text-sm mt-2 max-w-xs mx-auto">{selectedCandidate.manifesto}</p>
              )}
            </div>

            <div className="bg-primary-50 rounded-xl p-4 text-center">
              <p className="text-primary-800 font-semibold text-base">
                Position: {positions.find(p => p.id === activePositionId)?.title}
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <p className="text-red-700 text-base font-medium">You cannot change your vote after this.</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" className="flex-1 text-base py-3"
                onClick={() => { setSelectedCandidate(null); setActivePositionId(null); }}
                disabled={voting}>
                Go Back
              </Button>
              <Button className="flex-1 text-base py-3"
                onClick={async () => {
                  const pid = activePositionId;
                  const cid = selectedCandidate.id;
                  setSelectedCandidate(null);
                  setActivePositionId(null);
                  await castVote(pid, cid);
                }}
                loading={voting}>
                Confirm Vote
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default VotingPage;
