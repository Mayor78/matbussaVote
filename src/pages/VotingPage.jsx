import { useState, useEffect, useCallback } from 'react';
import { auth, db } from '../lib/firebase';
import { collection, query, where, getDocs, getDoc, runTransaction, doc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, User, AlertCircle, ArrowLeft, Vote, ChevronRight, Clock } from 'lucide-react';
import Modal from '../components/Modal';
import Button from '../components/Button';
import { getUserFriendlyError } from '../utils/errors';
import { auditService } from '../services/auditService';
import { generateDeviceSignature } from '../utils/deviceFingerprint';
import { CountdownBanner, useCountdown } from '../components/CountdownTimer';
import { bundleService } from '../services/electionBundleService';
import swal from '../utils/swal';

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
      let bundle = await bundleService.getBundle(electionId);
      let positionsList;
      let candidatesList;

      if (bundle && bundle.positions) {
        positionsList = bundle.positions.map(p => ({
          id: p.id, title: p.title, description: p.description, displayOrder: p.displayOrder,
        }));
        candidatesList = bundle.positions.flatMap(p =>
          (p.candidates || []).map(c => ({ ...c, positionId: p.id }))
        );
      } else {
        const [posSnap, candSnap] = await Promise.all([
          getDocs(query(collection(db, 'positions'), where('electionId', '==', electionId))),
          getDocs(query(collection(db, 'candidates'), where('electionId', '==', electionId))),
        ]);
        positionsList = posSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        positionsList.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        candidatesList = candSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        bundleService.buildBundle(electionId).catch(() => {});
      }

      const voteSnap = await getDocs(query(
        collection(db, 'votes'),
        where('electionId', '==', electionId),
        where('studentId', '==', studentId)
      ));

      setPositions(positionsList);
      setCandidates(candidatesList);

      const existing = {};
      voteSnap.docs.forEach(d => { const v = d.data(); existing[v.positionId] = v.candidateId; });
      setMyVotes(existing);
    } catch (err) {
      console.error('Failed to load election data:', err.code, err.message);
      swal.error('Error', getUserFriendlyError(err));
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
      if (!currentStudent) { swal.error('Account Error', 'Student profile not found.'); navigate('/student'); return; }
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
      swal.error('Error', getUserFriendlyError(err));
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
      swal.info('Voting Closed', 'This election has ended. Voting is closed.');
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

        const candidateRef = doc(db, 'candidates', candidateId);
        const candSnap = await transaction.get(candidateRef);
        const currentCount = (candSnap.data()?.voteCount || 0) + 1;
        transaction.update(candidateRef, { voteCount: currentCount });

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
      swal.success('Vote Recorded', 'Your vote has been successfully cast.');

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
      setActivePositionId(null);
      setSelectedCandidate(null);
    } finally {
      setVoting(false);
      window.removeEventListener('beforeunload', beforeUnload);
    }
  };

  const votedCount = Object.keys(myVotes).length;
  const allVoted = positions.length > 0 && votedCount >= positions.length;
  const progressPct = positions.length > 0 ? Math.round((votedCount / positions.length) * 100) : 0;

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
        <button onClick={() => selectedElection ? setSelectedElection(null) : navigate('/student')}
          className="flex items-center gap-1.5 text-[#4B5563] hover:text-[#1F3A5C] mb-5 text-sm font-semibold transition-colors">
          <ArrowLeft className="w-4 h-4" /> {selectedElection ? 'Choose another election' : 'Back to dashboard'}
        </button>

        {/* ELECTION SELECTION SCREEN */}
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
                              <Clock className="w-3.5 h-3.5 text-[#C0392B]" />
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

        {/* VOTING SCREEN */}
        {selectedElection && (
          <div className="space-y-5">
            <div className="text-center mb-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1C2430] tracking-tight">{selectedElection.title}</h1>
              <p className="text-[#8A93A3] text-xs font-semibold uppercase tracking-wide mt-1">
                {selectedElection.academicSession || selectedElection.academic_session || ''}
              </p>
            </div>

            {selectedElection.closesAt && (
              <CountdownBanner closesAt={selectedElection.closesAt} />
            )}

            {/* Progress bar */}
            <div className="bg-white rounded-2xl border border-[#E2E5EA] shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-[#1C2430]">Your progress</span>
                <span className="text-lg font-extrabold text-[#1F3A5C] font-mono tabular-nums">
                  {votedCount}<span className="text-[#98A2B3] font-semibold text-sm"> / {positions.length}</span>
                </span>
              </div>
              <div className="w-full bg-[#EEF1F4] rounded-full h-2.5 overflow-hidden">
                <div className="bg-[#1F7A54] h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}>
                </div>
              </div>
              {!allVoted && <p className="text-xs text-[#8A93A3] mt-2.5 text-center font-medium">Vote for each position below</p>}
            </div>

            {/* Positions */}
            {positions.map((position, posIdx) => {
              const positionCandidates = candidates.filter(c => c.positionId === position.id);
              const hasVoted = myVotes[position.id];
              const isProcessing = hasVoted === 'processing';
              const votedCandidate = positionCandidates.find(c => c.id === hasVoted && hasVoted !== 'existing' && hasVoted !== 'processing');

              return (
                <div key={position.id} className="bg-white rounded-2xl border border-[#E2E5EA] shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4 bg-[#1F3A5C]">
                    <span className="w-7 h-7 rounded-full bg-white/15 text-white text-xs font-extrabold flex items-center justify-center flex-shrink-0 font-mono">
                      {String(posIdx + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h2 className="text-lg font-extrabold text-white leading-tight">{position.title}</h2>
                      <p className="text-[#9FB3C8] text-xs font-medium mt-0.5">Choose one candidate</p>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    {positionCandidates.length === 0 ? (
                      <div className="text-center py-10">
                        <div className="w-14 h-14 rounded-full bg-[#EEF1F4] flex items-center justify-center mx-auto mb-3">
                          <User className="w-7 h-7 text-[#98A2B3]" />
                        </div>
                        <p className="text-[#8A93A3] text-sm font-medium">No candidates for this position yet.</p>
                      </div>
                    ) : isProcessing ? (
                      <div className="bg-[#EEF3F8] border border-[#C9D6E3] rounded-xl p-6 text-center">
                        <div className="animate-spin rounded-full h-9 w-9 border-4 border-[#1F3A5C] border-t-transparent mx-auto mb-3"></div>
                        <p className="text-[#1F3A5C] font-bold text-sm">Recording your vote…</p>
                        <p className="text-[#4B6480] text-xs mt-1 font-medium">Please wait, don't leave this page.</p>
                      </div>
                    ) : hasVoted ? (
                      <div className="bg-[#EAF6EF] border border-[#BFE3D0] rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-3.5">
                          <div className="w-6 h-6 rounded-full bg-[#1F7A54] flex items-center justify-center flex-shrink-0">
                            <CheckCircle className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-[#155C40] font-extrabold text-sm uppercase tracking-wide">Vote recorded</span>
                        </div>
                        {votedCandidate ? (
                          <div className="flex items-center gap-4 bg-white rounded-xl p-4 border border-[#D3ECDD]">
                            {votedCandidate.photoUrl ? (
                              <img src={votedCandidate.photoUrl} alt=""
                                className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover border-2 border-[#1F7A54] flex-shrink-0" />
                            ) : (
                              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[#EEF1F4] rounded-xl flex items-center justify-center flex-shrink-0">
                                <User className="w-10 h-10 text-[#98A2B3]" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <h3 className="text-lg font-extrabold text-[#1C2430] truncate">{votedCandidate.fullName}</h3>
                              <p className="text-[#667085] text-sm font-medium">{votedCandidate.level}</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[#2F855A] text-sm font-medium">You have voted for this position.</p>
                        )}
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {positionCandidates.map(candidate => (
                          <div key={candidate.id}
                            className="flex flex-col sm:flex-row items-center gap-4 p-4 border border-[#E2E5EA] rounded-2xl hover:border-[#1F3A5C] hover:bg-[#F7F9FB] transition-all cursor-pointer"
                            onClick={() => {
                              if (!voting) {
                                setActivePositionId(position.id);
                                setSelectedCandidate(candidate);
                              }
                            }}
                          >
                            {/* Photo */}
                            <div className="flex-shrink-0">
                              {candidate.photoUrl ? (
                                <img src={candidate.photoUrl} alt={candidate.fullName}
                                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border border-[#E2E5EA]" />
                              ) : (
                                <div className="w-24 h-24 sm:w-28 sm:h-28 bg-[#EEF1F4] rounded-2xl flex items-center justify-center border border-[#E2E5EA]">
                                  <User className="w-12 h-12 sm:w-14 sm:h-14 text-[#98A2B3]" />
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 text-center sm:text-left min-w-0">
                              <h3 className="text-base sm:text-lg font-extrabold text-[#1C2430]">{candidate.fullName}</h3>
                              <p className="text-[#8A93A3] text-xs font-semibold uppercase tracking-wide mt-0.5">{candidate.level}</p>
                              {candidate.manifesto && (
                                <p className="text-[#667085] text-sm mt-2 line-clamp-3">{candidate.manifesto}</p>
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
                              className="flex-shrink-0 w-full sm:w-auto px-7 py-3.5 bg-[#1F3A5C] hover:bg-[#16293F] text-white text-base font-bold rounded-xl transition-colors disabled:opacity-50 shadow-sm"
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
              <div className="text-center pt-3">
                <button
                  onClick={() => navigate('/student/confirmation')}
                  className="inline-flex items-center gap-2 px-10 py-4 bg-[#1F7A54] hover:bg-[#155C40] text-white text-lg font-bold rounded-2xl shadow-md transition-colors"
                >
                  <CheckCircle className="w-5 h-5" />
                  Finish voting
                </button>
              </div>
            )}
          </div>
        )}

        {/* CONFIRMATION MODAL */}
        <Modal
          isOpen={!!selectedCandidate}
          onClose={() => { setSelectedCandidate(null); setActivePositionId(null); }}
          title="Cast your vote"
          size="sm"
        >
          {selectedCandidate && activePositionId && (
            <div className="space-y-4">
              <div className="text-center">
                {selectedCandidate.photoUrl ? (
                  <img src={selectedCandidate.photoUrl} alt=""
                    className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl object-cover mx-auto border-2 border-[#1F3A5C]" />
                ) : (
                  <div className="w-32 h-32 sm:w-36 sm:h-36 bg-[#EEF1F4] rounded-2xl mx-auto flex items-center justify-center border-2 border-[#1F3A5C]">
                    <User className="w-16 h-16 text-[#98A2B3]" />
                  </div>
                )}
                <h3 className="text-xl font-extrabold text-[#1C2430] mt-4">{selectedCandidate.fullName}</h3>
                <p className="text-[#8A93A3] text-xs font-semibold uppercase tracking-wide mt-0.5">{selectedCandidate.level}</p>
                {selectedCandidate.manifesto && (
                  <p className="text-[#667085] text-sm mt-2.5 max-w-xs mx-auto leading-relaxed">{selectedCandidate.manifesto}</p>
                )}
              </div>

              <div className="bg-[#F5F6F8] border border-[#E2E5EA] rounded-xl p-3.5 text-center">
                <p className="text-[#4B5563] text-sm">
                  <span className="font-semibold text-[#1C2430]">Position:</span> {positions.find(p => p.id === activePositionId)?.title}
                </p>
              </div>

              <div className="flex items-start gap-2.5 bg-[#FBEAEA] border border-[#F3C9C4] rounded-xl p-3.5">
                <AlertCircle className="w-4 h-4 text-[#C0392B] flex-shrink-0 mt-0.5" />
                <p className="text-[#C0392B] text-sm font-semibold leading-snug">You can't change your vote after this.</p>
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="secondary" className="flex-1 text-sm py-3"
                  onClick={() => { setSelectedCandidate(null); setActivePositionId(null); }}
                  disabled={voting}>
                  Go back
                </Button>
                <Button className="flex-1 text-sm py-3"
                  onClick={async () => {
                    const pid = activePositionId;
                    const cid = selectedCandidate.id;
                    setSelectedCandidate(null);
                    setActivePositionId(null);
                    await castVote(pid, cid);
                  }}
                  loading={voting}>
                  Confirm vote
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default VotingPage;