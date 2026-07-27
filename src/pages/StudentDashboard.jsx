import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Vote, Clock, AlertCircle, LogOut, CheckCircle, Trophy, User, Medal } from 'lucide-react';

const StudentDashboard = () => {
  const { user, studentData: ctxStudent, loading: authLoading, logout, isAdminUser } = useAuth();
  const [student, setStudent] = useState(null);
  const [election, setElection] = useState(null);
  const [progress, setProgress] = useState({ voted: 0, total: 0 });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = useCallback(async (studentId) => {
    try {
      const openSnap = await getDocs(query(collection(db, 'elections'), where('status', '==', 'open')));
      if (!openSnap.empty) {
        const el = { id: openSnap.docs[0].id, ...openSnap.docs[0].data() };
        setElection(el);
        setResults(null);

        const pSnap = await getDocs(query(collection(db, 'positions'), where('electionId', '==', el.id)));
        const total = pSnap.size;

        const vSnap = await getDocs(query(
          collection(db, 'votes'),
          where('electionId', '==', el.id),
          where('studentId', '==', studentId)
        ));
        setProgress({ voted: vSnap.size, total });
        return;
      }

      const closedSnap = await getDocs(query(collection(db, 'elections'), where('status', '==', 'closed')));
      if (closedSnap.empty) { setElection(null); setResults(null); return; }

      const closed = closedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      closed.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      const el = closed[0];
      setElection(el);

      const [pSnap, cSnap, vSnap] = await Promise.all([
        getDocs(query(collection(db, 'positions'), where('electionId', '==', el.id))),
        getDocs(query(collection(db, 'candidates'), where('electionId', '==', el.id))),
        getDocs(query(collection(db, 'votes'), where('electionId', '==', el.id), where('studentId', '==', studentId))),
      ]);

      const positions = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      positions.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

      const candidates = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const myVotes = {};
      vSnap.docs.forEach(d => { const v = d.data(); myVotes[v.positionId] = v.candidateId; });

      const resultsData = positions.map(pos => ({
        ...pos,
        myVote: myVotes[pos.id] || null,
        candidates: candidates
          .filter(c => c.positionId === pos.id)
          .map(c => ({ id: c.id, fullName: c.fullName, level: c.level, photoUrl: c.photoUrl || null, voteCount: c.voteCount || 0 }))
          .sort((a, b) => b.voteCount - a.voteCount),
      }));

      setResults(resultsData);
      setProgress({ voted: 0, total: 0 });
    } catch (err) {
      console.error('Error fetching election:', err);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (isAdminUser) { navigate('/admin'); return; }

    if (ctxStudent) {
      setStudent(ctxStudent);
      fetchData(ctxStudent.id);
      setLoading(false);
    } else if (user?.email) {
      getDocs(collection(db, 'students')).then(snap => {
        snap.forEach(d => {
          const data = d.data();
          if (data.email?.toLowerCase() === user.email?.toLowerCase()) {
            const s = { id: d.id, ...data, fullName: data.fullName || data.full_name || '', matricNumber: data.matricNumber || data.matric_number || '' };
            setStudent(s);
            fetchData(s.id);
          }
        });
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [authLoading, ctxStudent, user, fetchData, isAdminUser, navigate]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] bg-[#F5F6F8]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#1F3A5C] border-t-transparent"></div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-[70vh] bg-[#F5F6F8] flex items-center justify-center px-4">
        <div className="max-w-md w-full mx-auto text-center bg-white rounded-2xl border border-[#E2E5EA] shadow-sm p-10">
          <div className="w-16 h-16 rounded-full bg-[#FBEAEA] flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-8 h-8 text-[#C0392B]" />
          </div>
          <h1 className="text-xl font-bold text-[#1C2430] mb-2">Account not found</h1>
          <p className="text-[#667085] text-[15px] leading-relaxed mb-7">
            We couldn't find your student profile. Contact your department admin for help getting access.
          </p>
          <button
            onClick={logout}
            className="w-full px-6 py-3.5 bg-[#1C2430] hover:bg-[#0F141C] text-white rounded-xl text-base font-semibold transition-colors"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  const displayName = student.fullName?.split(' ')[0] || 'Student';
  const allDone = progress.total > 0 && progress.voted >= progress.total;
  const hasStarted = progress.voted > 0;
  const pct = progress.total > 0 ? Math.round((progress.voted / progress.total) * 100) : 0;
  const isResults = results && results.length > 0;

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <div className="max-w-lg mx-auto px-4 py-4 sm:py-8">
        {/* Top: name + logout */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[#8A93A3] text-xs font-semibold uppercase tracking-wider mb-0.5">Welcome back</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1C2430] tracking-tight">{displayName}</h1>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-[#E2E5EA] rounded-xl text-[#4B5563] hover:border-[#C7CDD6] hover:text-[#1C2430] text-sm font-semibold transition-colors shadow-sm"
          >
            <LogOut className="w-4 h-4" /> Exit
          </button>
        </div>

        {/* No election */}
        {!election && (
          <div className="bg-white rounded-2xl border border-[#E2E5EA] shadow-sm p-10 text-center">
            <div className="w-20 h-20 rounded-full bg-[#EEF1F4] flex items-center justify-center mx-auto mb-6">
              <Clock className="w-9 h-9 text-[#8A93A3]" />
            </div>
            <h2 className="text-xl font-bold text-[#1C2430] mb-2">No active election</h2>
            <p className="text-[#667085] text-[15px] leading-relaxed">
              There's nothing open for voting right now. Check back later — you'll see it here the moment it starts.
            </p>
          </div>
        )}

        {/* Open election — voting */}
        {election && !isResults && (
          <div className="space-y-4">
            <div className="bg-[#1F3A5C] rounded-2xl p-6 sm:p-8 text-center border border-[#16293F]">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 rounded-full mb-4">
                <Vote className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-1">{election.title}</h2>
              <p className="text-[#9FB3C8] text-sm font-medium">{election.academicSession || election.academic_session}</p>
              {(election.endDate || election.end_date) && (
                <div className="inline-flex items-center gap-1.5 mt-4 bg-white/10 rounded-full px-3.5 py-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#C9D6E3]" />
                  <p className="text-[#E1E9F0] text-xs font-semibold">
                    Closes {new Date(election.endDate || election.end_date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              )}
            </div>

            {progress.total > 0 && (
              <div className="bg-white rounded-2xl border border-[#E2E5EA] shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-[#1C2430]">Your progress</span>
                  <span className="text-lg font-extrabold text-[#1F3A5C] font-mono tabular-nums">{progress.voted}<span className="text-[#98A2B3] font-semibold text-sm"> / {progress.total}</span></span>
                </div>
                <div className="w-full bg-[#EEF1F4] rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-700 ${allDone ? 'bg-[#1F7A54]' : 'bg-[#1F3A5C]'}`}
                    style={{ width: `${pct}%` }}
                  ></div>
                </div>
                <p className="text-xs text-[#8A93A3] mt-2.5 text-center font-medium">
                  {allDone ? 'All done — thank you for voting.' : `${progress.total - progress.voted} position${progress.total - progress.voted !== 1 ? 's' : ''} left to go`}
                </p>
              </div>
            )}

            {allDone ? (
              <div className="bg-[#EAF6EF] border border-[#BFE3D0] rounded-2xl p-7 text-center">
                <div className="w-14 h-14 rounded-full bg-[#1F7A54] flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-extrabold text-[#155C40] mb-1">Voting complete</h3>
                <p className="text-[#2F855A] text-sm font-medium">Thank you for taking part!</p>
              </div>
            ) : (
              <button
                onClick={() => navigate('/student/vote')}
                className="w-full py-5 bg-[#1F3A5C] hover:bg-[#16293F] text-white rounded-2xl text-xl font-bold shadow-md transition-all active:scale-[0.98]"
              >
                {hasStarted ? 'Continue voting' : 'Start voting'}
              </button>
            )}

            {hasStarted && !allDone && (
              <p className="text-xs text-[#8A93A3] text-center font-medium">You've already voted for some positions — tap above to continue.</p>
            )}
          </div>
        )}

        {/* Closed election — results */}
        {election && isResults && (
          <div className="space-y-5">
            <div className="bg-[#1F7A54] rounded-2xl p-6 sm:p-8 text-center border border-[#155C40]">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 rounded-full mb-4">
                <Trophy className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-1">{election.title}</h2>
              <p className="text-[#B7E3CC] text-sm font-medium">{election.academicSession || election.academic_session}</p>
              <p className="text-[#DDF2E6] text-[11px] mt-3 font-bold uppercase tracking-widest">Final results</p>
            </div>

            {results.map((position) => {
              const winner = position.candidates[0];
              const totalVotes = position.candidates.reduce((sum, c) => sum + c.voteCount, 0);
              const positionHasVote = !!position.myVote;

              return (
                <div key={position.id} className="bg-white rounded-2xl border border-[#E2E5EA] shadow-sm overflow-hidden">
                  {/* Position header */}
                  <div className="px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-lg font-extrabold text-[#1C2430] truncate">{position.title}</h3>
                        {position.description && (
                          <p className="text-[#8A93A3] text-xs mt-0.5">{position.description}</p>
                        )}
                      </div>
                      <span className="text-xs font-bold text-[#4B5563] bg-[#EEF1F4] px-2.5 py-1.5 rounded-full whitespace-nowrap font-mono tabular-nums">
                        {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Ticket-stub divider — signature motif */}
                  <div className="relative flex items-center px-5">
                    <div className="w-3 h-3 rounded-full bg-[#F5F6F8] border border-[#E2E5EA] -ml-[26px]"></div>
                    <div className="flex-1 border-t-2 border-dashed border-[#E2E5EA]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#F5F6F8] border border-[#E2E5EA] -mr-[26px]"></div>
                  </div>

                  {/* Winner — standout card */}
                  {winner && (
                    <div className="mx-4 mt-4 bg-[#B8862E] rounded-2xl p-5 text-white shadow-md">
                      <div className="flex items-center justify-center gap-2 mb-3.5">
                        <Medal className="w-4 h-4" />
                        <span className="text-xs font-extrabold uppercase tracking-[0.2em]">Winner</span>
                        <Trophy className="w-4 h-4" />
                      </div>
                      <div className="flex items-center gap-4">
                        {winner.photoUrl ? (
                          <img src={winner.photoUrl} alt="" className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-white/40 flex-shrink-0 shadow-sm" />
                        ) : (
                          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/15 rounded-2xl flex items-center justify-center flex-shrink-0 border-2 border-white/25">
                            <User className="w-10 h-10 sm:w-12 sm:h-12 text-white/80" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xl sm:text-2xl font-extrabold truncate">{winner.fullName}</p>
                          <p className="text-[#F3E3C4] text-sm font-medium">{winner.level}</p>
                          <div className="flex items-baseline gap-1.5 mt-1.5 font-mono tabular-nums">
                            <span className="text-2xl sm:text-3xl font-black">{winner.voteCount}</span>
                            <span className="text-[#F3E3C4] text-sm font-semibold">vote{winner.voteCount !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        {position.myVote === winner.id && (
                          <div className="flex items-center gap-1.5 bg-white/20 rounded-xl px-3 py-2 flex-shrink-0">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-xs font-bold">Your vote</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* All candidates list */}
                  <div className="px-4 py-4 space-y-2">
                    {position.candidates.map((candidate, idx) => {
                      const isWinner = idx === 0;
                      const isMyVote = position.myVote === candidate.id;
                      const maxVotes = position.candidates[0]?.voteCount || 1;
                      const candPct = totalVotes > 0 ? Math.round((candidate.voteCount / totalVotes) * 100) : 0;

                      return (
                        <div
                          key={candidate.id}
                          className={`flex items-center gap-3 rounded-xl p-3 border ${
                            isWinner ? 'bg-[#FBF4E4] border-[#EED8AE]' :
                            isMyVote ? 'bg-[#EAF6EF] border-[#BFE3D0]' :
                            'bg-[#FAFAFB] border-[#EDEFF2]'
                          }`}
                        >
                          {/* Rank badge */}
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            idx === 0 ? 'bg-[#B8862E] text-white' :
                            idx === 1 ? 'bg-[#94A3B8] text-white' :
                            idx === 2 ? 'bg-[#8B5E2B] text-white' :
                            'bg-[#D9DEE5] text-[#5B6472]'
                          }`}>
                            {idx === 0 ? <Trophy className="w-3.5 h-3.5" /> : idx + 1}
                          </span>

                          {/* Photo */}
                          {candidate.photoUrl ? (
                            <img src={candidate.photoUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 bg-[#EEF1F4] rounded-lg flex items-center justify-center flex-shrink-0">
                              <User className="w-5 h-5 text-[#98A2B3]" />
                            </div>
                          )}

                          {/* Name + level */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-bold text-[#1C2430] truncate">{candidate.fullName}</p>
                              {isMyVote && (
                                <span className="text-[10px] bg-[#1F7A54] text-white px-1.5 py-0.5 rounded font-bold flex-shrink-0">YOU VOTED</span>
                              )}
                            </div>
                            <p className="text-xs text-[#8A93A3] font-medium">{candidate.level}</p>
                          </div>

                          {/* Vote count + bar */}
                          <div className="text-right flex-shrink-0 min-w-[76px]">
                            <div className="flex items-center justify-end gap-2">
                              <div className="flex-1 max-w-[50px]">
                                <div className="w-full bg-[#E5E7EB] rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full ${isWinner ? 'bg-[#B8862E]' : isMyVote ? 'bg-[#1F7A54]' : 'bg-[#98A2B3]'}`}
                                    style={{ width: `${maxVotes > 0 ? (candidate.voteCount / maxVotes) * 100 : 0}%` }}
                                  ></div>
                                </div>
                              </div>
                              <span className="text-sm font-extrabold text-[#1C2430] w-8 text-right font-mono tabular-nums">{candidate.voteCount}</span>
                            </div>
                            <p className="text-[11px] text-[#98A2B3] font-medium font-mono tabular-nums">{candPct}%</p>
                          </div>
                        </div>
                      );
                    })}

                    {!positionHasVote && (
                      <p className="text-xs text-[#98A2B3] text-center pt-1 font-medium">You did not vote for this position</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;