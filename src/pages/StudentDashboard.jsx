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
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-3 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Account Not Found</h1>
        <p className="text-gray-500 mb-6">We could not find your student profile. Contact your department admin.</p>
        <button onClick={logout} className="px-6 py-3 bg-red-600 text-white rounded-xl text-lg font-semibold">Go to Login</button>
      </div>
    );
  }

  const displayName = student.fullName?.split(' ')[0] || 'Student';
  const allDone = progress.total > 0 && progress.voted >= progress.total;
  const hasStarted = progress.voted > 0;
  const pct = progress.total > 0 ? Math.round((progress.voted / progress.total) * 100) : 0;
  const isResults = results && results.length > 0;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 sm:py-8">
      {/* Top: name + logout */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-gray-500 text-sm">Welcome,</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{displayName}</h1>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 rounded-xl text-gray-600 hover:bg-gray-200 text-sm font-medium">
          <LogOut className="w-4 h-4" /> Exit
        </button>
      </div>

      {/* No election */}
      {!election && (
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
          <Clock className="w-20 h-20 text-gray-300 mx-auto mb-5" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Active Election</h2>
          <p className="text-gray-500 text-base">There is no election open for voting right now. Please check back later.</p>
        </div>
      )}

      {/* Open election — voting */}
      {election && !isResults && (
        <div className="space-y-5">
          <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-6 sm:p-8 text-white text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
              <Vote className="w-8 h-8" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-1">{election.title}</h2>
            <p className="text-primary-100 text-sm">{election.academicSession || election.academic_session}</p>
            {(election.endDate || election.end_date) && (
              <p className="text-primary-200 text-xs mt-2">
                Deadline: {new Date(election.endDate || election.end_date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            )}
          </div>

          {progress.total > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">Your Progress</span>
                <span className="text-lg font-bold text-primary-600">{progress.voted} of {progress.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className={`h-3 rounded-full transition-all duration-700 ${allDone ? 'bg-green-500' : 'bg-primary-600'}`}
                  style={{ width: `${pct}%` }}></div>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                {allDone ? 'All done! Thank you for voting.' : `${progress.total - progress.voted} position${progress.total - progress.voted !== 1 ? 's' : ''} remaining`}
              </p>
            </div>
          )}

          {allDone ? (
            <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-green-800 mb-1">Voting Complete</h3>
              <p className="text-green-600 text-sm">Thank you for participating!</p>
            </div>
          ) : (
            <button
              onClick={() => navigate('/student/vote')}
              className="w-full py-5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl text-2xl font-bold shadow-lg transition-all active:scale-95"
            >
              {hasStarted ? 'Continue Voting' : 'Start Voting'}
            </button>
          )}

          {hasStarted && !allDone && (
            <p className="text-xs text-gray-400 text-center">You have already voted for some positions. Tap the button to continue.</p>
          )}
        </div>
      )}

      {/* Closed election — results */}
      {election && isResults && (
        <div className="space-y-5">
          <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-2xl p-6 sm:p-8 text-white text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
              <Trophy className="w-8 h-8" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-1">{election.title}</h2>
            <p className="text-green-100 text-sm">{election.academicSession || election.academic_session}</p>
            <p className="text-green-200 text-xs mt-2 font-medium uppercase tracking-wide">Election Results</p>
          </div>

          {results.map((position) => {
            const winner = position.candidates[0];
            const totalVotes = position.candidates.reduce((sum, c) => sum + c.voteCount, 0);
            const positionHasVote = !!position.myVote;

            return (
              <div key={position.id} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                {/* Position header */}
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{position.title}</h3>
                      {position.description && (
                        <p className="text-gray-500 text-xs mt-0.5">{position.description}</p>
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                      {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Winner — large standout card */}
                {winner && (
                  <div className="mx-3 mt-3 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400 rounded-2xl p-5 text-white shadow-lg border-2 border-amber-300">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <Medal className="w-5 h-5" />
                      <span className="text-sm font-bold uppercase tracking-widest">Winner</span>
                      <Trophy className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-4">
                      {winner.photoUrl ? (
                        <img src={winner.photoUrl} alt="" className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-3 border-white/50 flex-shrink-0 shadow-md" />
                      ) : (
                        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 border-2 border-white/30">
                          <User className="w-10 h-10 sm:w-12 sm:h-12 text-white/70" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xl sm:text-2xl font-extrabold truncate">{winner.fullName}</p>
                        <p className="text-amber-100 text-sm">{winner.level}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-2xl sm:text-3xl font-black">{winner.voteCount}</span>
                          <span className="text-amber-200 text-sm font-medium">vote{winner.voteCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      {position.myVote === winner.id && (
                        <div className="flex items-center gap-1.5 bg-white/25 rounded-xl px-3 py-2 flex-shrink-0 border border-white/30">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-xs font-bold">Your vote</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* All candidates list */}
                <div className="px-4 py-3 space-y-2">
                  {position.candidates.map((candidate, idx) => {
                    const isWinner = idx === 0;
                    const isMyVote = position.myVote === candidate.id;
                    const maxVotes = position.candidates[0]?.voteCount || 1;
                    const pct = totalVotes > 0 ? Math.round((candidate.voteCount / totalVotes) * 100) : 0;

                    return (
                      <div
                        key={candidate.id}
                        className={`flex items-center gap-3 rounded-xl p-2.5 ${
                          isWinner ? 'bg-amber-50 border border-amber-200' :
                          isMyVote ? 'bg-green-50 border border-green-100' :
                          'bg-gray-50'
                        }`}
                      >
                        {/* Rank badge */}
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          idx === 0 ? 'bg-amber-500 text-white' :
                          idx === 1 ? 'bg-gray-400 text-white' :
                          idx === 2 ? 'bg-amber-700 text-white' :
                          'bg-gray-300 text-gray-600'
                        }`}>
                          {idx === 0 ? <Trophy className="w-3.5 h-3.5" /> : idx + 1}
                        </span>

                        {/* Photo */}
                        {candidate.photoUrl ? (
                          <img src={candidate.photoUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-gray-400" />
                          </div>
                        )}

                        {/* Name + level */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-gray-900 truncate">{candidate.fullName}</p>
                            {isMyVote && (
                              <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded font-medium flex-shrink-0">You</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{candidate.level}</p>
                        </div>

                        {/* Vote count + bar */}
                        <div className="text-right flex-shrink-0 min-w-[70px]">
                          <div className="flex items-center justify-end gap-2">
                            <div className="flex-1 max-w-[50px]">
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${isWinner ? 'bg-amber-500' : isMyVote ? 'bg-green-500' : 'bg-gray-400'}`}
                                  style={{ width: `${maxVotes > 0 ? (candidate.voteCount / maxVotes) * 100 : 0}%` }}
                                ></div>
                              </div>
                            </div>
                            <span className="text-sm font-bold text-gray-900 w-8 text-right">{candidate.voteCount}</span>
                          </div>
                          <p className="text-xs text-gray-400">{pct}%</p>
                        </div>
                      </div>
                    );
                  })}

                  {!positionHasVote && (
                    <p className="text-xs text-gray-400 text-center pt-1">You did not vote for this position</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
