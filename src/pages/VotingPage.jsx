import { useState, useEffect, useCallback } from 'react';
import { auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, User, AlertCircle, ArrowLeft, Vote, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { getUserFriendlyError } from '../utils/errors';
import { CountdownBanner } from '../components/CountdownTimer';
import * as api from '../lib/api';
import swal from '../utils/swal';
import { getLevelWindowStatus, LEVEL_GROUPS } from '../utils/electionValidation';
import { startVotingTour } from '../utils/votingTour';

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededShuffle(array, seed) {
  const shuffled = [...array];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) | 0;
    const j = (s >>> 0) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const VotingPage = () => {
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [student, setStudent] = useState(null);
  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState(null);
  const [positions, setPositions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [myVotes, setMyVotes] = useState({});
  const [randomizedCandidates, setRandomizedCandidates] = useState({});
  const [activePositionIdx, setActivePositionIdx] = useState(0);
  const [votingCandidateId, setVotingCandidateId] = useState(null);
  const [expandedManifesto, setExpandedManifesto] = useState(null);
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const { isAdminUser, studentData } = useAuth();
  const dashboardPath = isAdminUser ? '/admin' : '/student';
  const navigate = useNavigate();

  const loadElectionData = async (electionId, studentId) => {
    setLoading(true);
    try {
      const bundle = await api.fetchBundle(electionId);

      let positionsList;
      let candidatesList;

      if (bundle && Array.isArray(bundle)) {
        positionsList = bundle.map(p => ({
          id: p.id, title: p.title, description: p.description || '', displayOrder: p.displayOrder,
        }));
        candidatesList = bundle.flatMap(p =>
          (p.candidates || []).map(c => ({ ...c, positionId: p.id }))
        );
      } else {
        const [posData, candData] = await Promise.all([
          api.fetchPositions(electionId),
          api.fetchCandidates({ electionId }),
        ]);
        positionsList = posData;
        positionsList.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        candidatesList = candData;
        api.buildBundle(electionId).catch(() => {});
      }

      const { votes } = await api.checkVoteStatus(electionId);
      const existing = {};
      (votes || []).forEach(v => { existing[v.positionId] = v.candidateId; });

      const seed = hashCode(`${studentId}_${electionId}`);
      const randomized = {};
      for (const pos of positionsList) {
        const posCandidates = candidatesList.filter(c => c.positionId === pos.id);
        randomized[pos.id] = seededShuffle(posCandidates, seed + hashCode(pos.id));
      }

      setPositions(positionsList);
      setCandidates(candidatesList);
      setMyVotes(existing);
      setRandomizedCandidates(randomized);

      const firstUnvoted = positionsList.findIndex(p => !existing[p.id]);
      setActivePositionIdx(firstUnvoted >= 0 ? firstUnvoted : 0);
    } catch (err) {
      console.error('Failed to load election data:', err);
      swal.error('Error', getUserFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) { navigate('/login'); return; }

      let currentStudent = null;

      if (studentData && studentData.id) {
        currentStudent = {
          id: studentData.id,
          ...studentData,
          fullName: studentData.fullName || '',
          matricNumber: studentData.matricNumber || '',
        };
      }

      if (!currentStudent && isAdminUser) {
        currentStudent = {
          id: user.uid,
          fullName: user.email?.split('@')[0] || 'Admin',
          matricNumber: 'ADMIN_ACCOUNT',
          email: user.email?.toLowerCase() || '',
        };
      }

      if (!currentStudent) {
        swal.error('Account Error', 'Student profile not found.');
        navigate(dashboardPath);
        return;
      }
      setStudent(currentStudent);

      const openElections = await api.fetchElections('open');
      setElections(openElections);

      if (openElections.length === 0) {
        setLoading(false);
        return;
      }

      if (openElections.length === 1) {
        const e = openElections[0];
        setSelectedElection(e);
        await loadElectionData(e.id, currentStudent.id);
      }
    } catch (err) {
      console.error('Failed to load voting data:', err);
      swal.error('Error', getUserFriendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [navigate, dashboardPath, isAdminUser, studentData]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSelectElection = async (election) => {
    setSelectedElection(election);
    setMyVotes({});
    setActivePositionIdx(0);
    await loadElectionData(election.id, student.id);
  };

  const goToPosition = (idx) => {
    setPendingConfirm(null);
    setActivePositionIdx(idx);
    setTimeout(() => {
      const el = document.getElementById(`position-section-${idx}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const castVote = async (positionId, candidateId) => {
    if (!student || !selectedElection || voting) return;

    if (selectedElection.closesAt && new Date().getTime() > new Date(selectedElection.closesAt).getTime()) {
      swal.info('Voting Closed', 'This election has ended. Voting is closed.');
      try {
        await api.updateElectionStatus(selectedElection.id, 'closed');
        setSelectedElection(null);
      } catch { /* ignore */ }
      return;
    }

    setVoting(true);
    setVotingCandidateId(candidateId);
    setMyVotes(prev => ({ ...prev, [positionId]: 'processing' }));

    const beforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);

    try {
      await api.castVote({
        candidateId,
        electionId: selectedElection.id,
        positionId,
      });

      setMyVotes(prev => ({ ...prev, [positionId]: candidateId }));

      setVotingCandidateId(null);

      setTimeout(() => {
        const nextUnvoted = positions.findIndex((p, i) => i > activePositionIdx && !myVotes[p.id] && p.id !== positionId);
        const target = nextUnvoted >= 0 ? nextUnvoted : activePositionIdx + 1;
        if (target < positions.length && !(myVotes[positions[target]?.id] && positions[target]?.id !== positionId)) {
          goToPosition(target);
        }
      }, 1000);
    } catch (error) {
      setVotingCandidateId(null);
      if (error.status === 409 || error.message?.includes('Already voted')) {
        swal.error('Already Voted', 'You have already voted for this position.');
        setMyVotes(prev => ({ ...prev, [positionId]: 'existing' }));
      } else {
        swal.error('Vote Failed', 'Your vote was NOT recorded. Please try again.');
        setMyVotes(prev => {
          const updated = { ...prev };
          delete updated[positionId];
          return updated;
        });
      }
    } finally {
      setVoting(false);
      window.removeEventListener('beforeunload', beforeUnload);
    }
  };

  const votedCount = positions.filter(p => myVotes[p.id] && myVotes[p.id] !== 'processing').length;
  const allVoted = positions.length > 0 && votedCount >= positions.length;

  const levelWindow = selectedElection
    ? getLevelWindowStatus(selectedElection, studentData?.level)
    : null;
  const votingBlocked = levelWindow && levelWindow.status !== 'open';

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] bg-[#F5F6F8]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#1F3A5C] border-t-transparent mx-auto mb-4"></div>
          <p className="text-[#667085] text-base font-medium">Loading elections…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <button
          onClick={() => selectedElection ? setSelectedElection(null) : navigate(dashboardPath)}
          className="flex items-center gap-1.5 text-[#4B5563] hover:text-[#1F3A5C] mb-5 text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {selectedElection ? 'Choose another election' : 'Back to dashboard'}
        </button>

        {/* ─── ELECTION SELECTION ─── */}
        {!selectedElection && (
          <div className="space-y-5">
            <div className="text-center mb-7">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1F3A5C] rounded-full mb-4">
                <Vote className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1C2430] tracking-tight">Cast your vote</h1>
              <p className="text-[#667085] text-[15px] mt-1.5">Select an election below to begin</p>
            </div>

            {elections.length === 0 ? (
              <div className="bg-white border border-[#E2E5EA] rounded-2xl shadow-sm p-10 text-center">
                <div className="w-16 h-16 rounded-full bg-[#FDF6E7] flex items-center justify-center mx-auto mb-5">
                  <AlertCircle className="w-8 h-8 text-[#B7791F]" />
                </div>
                <h2 className="text-xl font-bold text-[#1C2430] mb-2">No active election</h2>
                <p className="text-[#667085] text-[15px] leading-relaxed">Nothing is open for voting right now. Check back later.</p>
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
                      className="text-left bg-white rounded-2xl border border-[#E2E5EA] shadow-sm hover:border-[#1F3A5C] hover:shadow-md p-6 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-1.5 self-stretch rounded-full bg-[#1F3A5C] flex-shrink-0"></div>
                        <div className="flex-1 min-w-0">
                          <h2 className="text-lg font-extrabold text-[#1C2430] group-hover:text-[#1F3A5C] transition-colors">{election.title}</h2>
                          {session && <p className="text-[#8A93A3] text-xs font-semibold uppercase tracking-wide mt-1">{session}</p>}
                          {election.description && <p className="text-[#667085] text-sm mt-2">{election.description}</p>}
                          {endDate && (
                            <div className="inline-flex items-center gap-1.5 mt-3 bg-[#FBEAEA] rounded-full px-3 py-1">
                              <AlertCircle className="w-3.5 h-3.5 text-[#C0392B]" />
                              <p className="text-[#C0392B] text-xs font-bold">
                                Closes {new Date(endDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                              </p>
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-6 h-6 text-[#C7CDD6] group-hover:text-[#1F3A5C] flex-shrink-0 transition-colors" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── VOTING SCREEN ─── */}
        {selectedElection && (
          <div className="space-y-5">
            <div className="text-center mb-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1C2430] tracking-tight">{selectedElection.title}</h1>
              <p className="text-[#8A93A3] text-xs font-semibold uppercase tracking-wide mt-1">
                {selectedElection.academicSession || selectedElection.academic_session || ''}
              </p>
              <button
                onClick={startVotingTour}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors"
              >
                Take a tour
              </button>
            </div>

            {selectedElection.closesAt && <CountdownBanner closesAt={selectedElection.closesAt} />}

            {levelWindow && levelWindow.status !== 'open' && (
              <div className={`rounded-2xl p-5 text-center border ${
                levelWindow.status === 'pending'
                  ? 'bg-amber-50 border-amber-200'
                  : levelWindow.status === 'closed'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <Clock className={`w-6 h-6 mx-auto mb-2 ${
                  levelWindow.status === 'pending' ? 'text-amber-600' : levelWindow.status === 'closed' ? 'text-red-500' : 'text-gray-500'
                }`} />
                <h3 className={`text-base font-extrabold mb-1 ${
                  levelWindow.status === 'pending' ? 'text-amber-900' : levelWindow.status === 'closed' ? 'text-red-800' : 'text-gray-800'
                }`}>{levelWindow.title}</h3>
                <p className={`text-sm leading-relaxed ${
                  levelWindow.status === 'pending' ? 'text-amber-700' : levelWindow.status === 'closed' ? 'text-red-600' : 'text-gray-600'
                }`}>{levelWindow.message}</p>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-[#E2E5EA] shadow-sm px-4 py-4" id="voting-progress-section">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-[#1C2430]">Your progress</span>
                <span className="text-sm font-bold text-[#1F3A5C]">{votedCount} of {positions.length} complete</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-1">
                {positions.map((pos, idx) => {
                  const done = myVotes[pos.id] && myVotes[pos.id] !== 'processing';
                  const active = idx === activePositionIdx;
                  const processing = myVotes[pos.id] === 'processing';
                  return (
                    <button
                      key={pos.id}
                      onClick={() => goToPosition(idx)}
                      disabled={processing}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all flex-shrink-0 disabled:opacity-60 ${
                        active
                          ? 'bg-[#1F3A5C] text-white shadow-md'
                          : done
                          ? 'bg-[#EAF6EF] text-[#1F7A54] border border-[#BFE3D0]'
                          : 'bg-[#F5F6F8] text-[#667085] border border-[#E2E5EA] hover:border-[#1F3A5C]'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-extrabold ${
                        active ? 'bg-white/20 text-white' :
                        done ? 'bg-[#1F7A54] text-white' :
                        'bg-[#DEE2E8] text-[#667085]'
                      }`}>
                        {done ? <CheckCircle className="w-3 h-3" /> : processing ? '…' : idx + 1}
                      </span>
                      <span className="max-w-[80px] truncate">{pos.title}</span>
                    </button>
                  );
                })}
              </div>
              {!allVoted && (
                <p className="text-xs text-[#8A93A3] mt-2 text-center font-medium">
                  Swipe to view all candidates — tap one to cast your vote
                </p>
              )}
            </div>

            {/* Current position carousel */}
            {(() => {
              if (positions.length === 0 || activePositionIdx >= positions.length) return null;
              const position = positions[activePositionIdx];
              const done = myVotes[position.id] && myVotes[position.id] !== 'processing';
              const processing = myVotes[position.id] === 'processing';
              const positionCandidates = randomizedCandidates[position.id] || candidates.filter(c => c.positionId === position.id);

              return (
                <div id={`position-section-${activePositionIdx}`} className="bg-white rounded-2xl border border-[#E2E5EA] shadow-sm overflow-hidden animate-fade-in">
                  <div className="flex items-center justify-between px-5 py-4 bg-[#1F3A5C]">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-white/15 text-white text-sm font-extrabold flex items-center justify-center flex-shrink-0">
                        {activePositionIdx + 1}
                      </span>
                      <div>
                        <h2 className="text-lg font-extrabold text-white leading-tight">{position.title}</h2>
                        {position.description && (
                          <p className="text-[#9FB3C8] text-xs font-medium mt-0.5">{position.description}</p>
                        )}
                      </div>
                    </div>
                    {done && (
                      <span className="flex items-center gap-1 px-3 py-1.5 bg-[#1F7A54] text-white text-xs font-bold rounded-full">
                        <CheckCircle className="w-3.5 h-3.5" /> Voted
                      </span>
                    )}
                  </div>

                  <div className="p-4 sm:p-5">
                    {positionCandidates.length === 0 ? (
                      <div className="text-center py-10">
                        <div className="w-14 h-14 rounded-full bg-[#EEF1F4] flex items-center justify-center mx-auto mb-3">
                          <User className="w-7 h-7 text-[#98A2B3]" />
                        </div>
                        <p className="text-[#8A93A3] text-sm font-medium">No candidates for this position yet.</p>
                      </div>
                    ) : processing ? (
                      <div className="bg-[#EEF3F8] border border-[#C9D6E3] rounded-xl p-6 text-center">
                        <div className="animate-spin rounded-full h-9 w-9 border-4 border-[#1F3A5C] border-t-transparent mx-auto mb-3"></div>
                        <p className="text-[#1F3A5C] font-bold text-sm">Recording your vote…</p>
                        <p className="text-[#4B6480] text-xs mt-1 font-medium">Please wait, don&apos;t leave this page.</p>
                      </div>
                    ) : done ? (
                      <div className="space-y-4">
                        <div className="bg-[#EAF6EF] border border-[#BFE3D0] rounded-xl p-5">
                          <div className="flex items-center gap-2 mb-3.5">
                            <div className="w-6 h-6 rounded-full bg-[#1F7A54] flex items-center justify-center flex-shrink-0">
                              <CheckCircle className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-[#155C40] font-extrabold text-sm uppercase tracking-wide">Vote recorded</span>
                          </div>
                          {(() => {
                            const votedFor = positionCandidates.find(c => c.id === myVotes[position.id]);
                            return votedFor ? (
                              <div className="flex items-center gap-4 bg-white rounded-xl p-4 border border-[#D3ECDD]">
                                {votedFor.photoUrl ? (
                                  <img src={votedFor.photoUrl} alt="" className="w-16 h-16 rounded-xl object-cover border-2 border-[#1F7A54] flex-shrink-0" />
                                ) : (
                                  <div className="w-16 h-16 bg-[#EEF1F4] rounded-xl flex items-center justify-center flex-shrink-0">
                                    <User className="w-8 h-8 text-[#98A2B3]" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <h3 className="text-base font-extrabold text-[#1C2430] truncate">{votedFor.fullName}</h3>
                                  <p className="text-[#667085] text-xs font-medium">{votedFor.level}</p>
                                </div>
                              </div>
                            ) : null;
                          })()}
                        </div>
                        <button
                          onClick={() => {
                            const next = activePositionIdx + 1;
                            if (next < positions.length) goToPosition(next);
                          }}
                          disabled={activePositionIdx >= positions.length - 1}
                          className="w-full py-3 bg-[#F5F6F8] border border-[#E2E5EA] text-[#1F3A5C] font-bold rounded-xl hover:bg-[#EEF1F4] transition-colors disabled:opacity-40 text-sm"
                        >
                          Next position <ChevronRight className="w-4 h-4 inline ml-1" />
                        </button>
                      </div>
                    ) : (
                      <>
                        {pendingConfirm && pendingConfirm.positionId === position.id && (
                          <div className="mb-4 bg-[#F5F8FD] border-2 border-[#1F3A5C] rounded-2xl p-4 sm:p-5 animate-fade-in">
                            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                              <div className="flex-shrink-0">
                                {pendingConfirm.candidate.photoUrl ? (
                                  <img src={pendingConfirm.candidate.photoUrl} alt="" className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-[#1F3A5C]" />
                                ) : (
                                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[#EEF1F4] rounded-2xl flex items-center justify-center border-2 border-[#1F3A5C]">
                                    <User className="w-10 h-10 text-[#98A2B3]" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-[#4B6480] uppercase tracking-wide mb-1">Confirm your vote for {position.title}</p>
                                <h3 className="text-lg font-extrabold text-[#1C2430]">{pendingConfirm.candidate.fullName}</h3>
                                <p className="text-[#8A93A3] text-xs font-semibold mt-0.5">{pendingConfirm.candidate.level}</p>
                                {pendingConfirm.candidate.manifesto && (
                                  <p className="text-[#667085] text-sm mt-2 line-clamp-2">{pendingConfirm.candidate.manifesto}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#DEE2E8]">
                              <div className="flex items-start gap-2 flex-1">
                                <AlertCircle className="w-4 h-4 text-[#C0392B] flex-shrink-0 mt-0.5" />
                                <p className="text-[#C0392B] text-xs font-semibold leading-snug">You cannot change your vote after confirming.</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  onClick={() => setPendingConfirm(null)}
                                  className="px-5 py-2.5 bg-white border border-[#DEE2E8] text-[#4B5563] font-bold rounded-xl hover:bg-[#F5F6F8] transition-colors text-sm"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={async () => {
                                    const pid = pendingConfirm.positionId;
                                    const cid = pendingConfirm.candidate.id;
                                    setPendingConfirm(null);
                                    await castVote(pid, cid);
                                  }}
                                  className="px-6 py-2.5 bg-[#1F3A5C] hover:bg-[#16293F] text-white font-bold rounded-xl transition-colors text-sm"
                                >
                                  Confirm vote
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="carousel-snap overflow-x-auto hide-scrollbar -mx-1 px-1">
                          <div className="flex gap-3 sm:gap-4 pb-4">
                            {positionCandidates.map(candidate => {
                              const isVoting = votingCandidateId === candidate.id && voting;
                              return (
                                <button
                                  key={candidate.id}
                                  onClick={() => !voting && !votingBlocked && setPendingConfirm({ positionId: position.id, candidate })}
                                  disabled={voting || votingBlocked}
                                  className={`carousel-card relative flex-shrink-0 w-[220px] sm:w-[240px] bg-white rounded-2xl border-2 p-4 sm:p-5 text-left transition-all duration-200 disabled:opacity-60 ${
                                    isVoting
                                      ? 'border-[#1F7A54] bg-[#EAF6EF] animate-vote-pulse'
                                      : 'border-[#E2E5EA] hover:border-[#1F3A5C] hover:shadow-lg active:scale-[0.98]'
                                  }`}
                                >
                                  <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-[#EEF1F4] border border-[#E2E5EA] mb-3">
                                    {candidate.photoUrl ? (
                                      <img src={candidate.photoUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <User className="w-16 h-16 text-[#98A2B3]" />
                                      </div>
                                    )}
                                    {isVoting && (
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                        <div className="animate-vote-checkmark w-12 h-12 rounded-full bg-[#1F7A54] flex items-center justify-center shadow-lg">
                                          <CheckCircle className="w-7 h-7 text-white" />
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <h3 className="text-base font-extrabold text-[#1C2430] leading-tight truncate">{candidate.fullName}</h3>
                                  <p className="text-[#8A93A3] text-xs font-semibold uppercase tracking-wide mt-1">{candidate.level}</p>

                                  {candidate.manifesto && (
                                    <div className="mt-3">
                                      {expandedManifesto === candidate.id ? (
                                        <p className="text-[#667085] text-xs leading-relaxed">{candidate.manifesto}</p>
                                      ) : (
                                        <p className="text-[#667085] text-xs leading-relaxed line-clamp-2">{candidate.manifesto}</p>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedManifesto(expandedManifesto === candidate.id ? null : candidate.id);
                                        }}
                                        className="text-[#1F3A5C] text-xs font-bold mt-1 hover:underline inline-flex items-center gap-0.5"
                                      >
                                        {expandedManifesto === candidate.id ? (
                                          <>Show less <ChevronUp className="w-3 h-3" /></>
                                        ) : (
                                          <>View manifesto <ChevronDown className="w-3 h-3" /></>
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {positionCandidates.length > 1 && (
                          <div className="flex justify-center gap-1.5 mt-1">
                            {positionCandidates.map((_, i) => (
                              <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-[#1F3A5C]' : 'bg-[#DEE2E8]'}`} />
                            ))}
                            <span className="text-[10px] text-[#98A2B3] ml-1 font-medium">{positionCandidates.length} candidate{positionCandidates.length > 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {positions.length > 1 && (
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => activePositionIdx > 0 && goToPosition(activePositionIdx - 1)}
                  disabled={activePositionIdx === 0}
                  className="flex items-center gap-1 px-4 py-2.5 bg-white border border-[#E2E5EA] text-[#4B5563] font-bold rounded-xl hover:bg-[#F5F6F8] transition-colors disabled:opacity-30 text-sm"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <span className="text-sm font-semibold text-[#8A93A3]">
                  {activePositionIdx + 1} of {positions.length}
                </span>
                <button
                  onClick={() => activePositionIdx < positions.length - 1 && goToPosition(activePositionIdx + 1)}
                  disabled={activePositionIdx >= positions.length - 1}
                  className="flex items-center gap-1 px-4 py-2.5 bg-white border border-[#E2E5EA] text-[#4B5563] font-bold rounded-xl hover:bg-[#F5F6F8] transition-colors disabled:opacity-30 text-sm"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {allVoted && (
              <div className="text-center pt-3">
                <button
                  onClick={() => navigate(isAdminUser ? '/admin' : '/student/confirmation')}
                  className="inline-flex items-center gap-2 px-10 py-4 bg-[#1F7A54] hover:bg-[#155C40] text-white text-lg font-bold rounded-2xl shadow-md transition-colors"
                >
                  <CheckCircle className="w-5 h-5" />
                  Finish voting
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VotingPage;
