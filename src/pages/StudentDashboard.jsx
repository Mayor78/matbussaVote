import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Vote, Clock, AlertCircle, LogOut, CheckCircle, Trophy, User, Medal,
  Lock, ChevronDown, ChevronUp, Share2,
} from 'lucide-react';
import * as api from '../lib/api';
import VotingGuide from '../components/VotingGuide';
import { getLevelWindowStatus, LEVEL_GROUPS } from '../utils/electionValidation';

// Counts up from 0 to `value` once on mount/whenever value changes.
// Used for vote counts and summary stats so the results reveal feels alive
// without going overboard (~900ms, no bounce/confetti).
const AnimatedNumber = ({ value, duration = 900 }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let startTs = null;
    let raf;
    const step = (ts) => {
      if (startTs === null) startTs = ts;
      const progress = Math.min((ts - startTs) / duration, 1);
      setDisplay(Math.round(progress * value));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{display}</>;
};

const StudentDashboard = () => {
  const { user, studentData: ctxStudent, loading: authLoading, logout, isAdminUser } = useAuth();
  const [student, setStudent] = useState(null);
  const [election, setElection] = useState(null);
  const [progress, setProgress] = useState({ voted: 0, total: 0 });
  const [results, setResults] = useState(null);
  const [summary, setSummary] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const navigate = useNavigate();

  const fetchData = useCallback(async (studentId) => {
    try {
      const openElections = await api.fetchElections('open');
      if (openElections.length > 0) {
        const el = openElections[0];
        setElection(el);
        setResults(null);
        setSummary(null);

        const posData = await api.fetchPositions(el.id);
        const total = posData.length;

        const { votes } = await api.checkVoteStatus(el.id);
        setProgress({ voted: votes.length, total });
        return;
      }

      const closedElections = await api.fetchElections('closed');
      if (closedElections.length === 0) { setElection(null); setResults(null); setSummary(null); return; }

      closedElections.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      const el = closedElections[0];
      setElection(el);

      const [bundle, voteRes, stats] = await Promise.all([
        api.fetchBundle(el.id),
        api.checkVoteStatus(el.id),
        api.fetchStats(el.id),
      ]);

      const positions = (bundle && Array.isArray(bundle))
        ? bundle.map(p => ({ id: p.id, title: p.title, description: p.description, displayOrder: p.displayOrder }))
        : [];
      positions.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

      const candData = (bundle && Array.isArray(bundle))
        ? bundle.flatMap(p => (p.candidates || []).map(c => ({ ...c, positionId: p.id })))
        : [];

      const myVotes = {};
      (voteRes.votes || []).forEach(v => { myVotes[v.positionId] = v.candidateId; });

      const resultsData = positions.map(pos => ({
        ...pos,
        myVote: myVotes[pos.id] || null,
        candidates: candData
          .filter(c => c.positionId === pos.id)
          .map(c => ({ id: c.id, fullName: c.fullName, level: c.level, photoUrl: c.photoUrl || null, voteCount: c.voteCount || 0 }))
          .sort((a, b) => b.voteCount - a.voteCount),
      }));

      setResults(resultsData);
      setExpanded(Object.fromEntries(resultsData.map(p => [p.id, true])));
      setProgress({ voted: 0, total: 0 });

      setSummary({
        registeredCount: stats.registeredVoters || 0,
        uniqueVoters: stats.votedStudents || 0,
        totalBallots: stats.totalVotes || 0,
        turnoutPct: stats.turnout || 0,
      });
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
      if (!sessionStorage.getItem('votingGuideShown')) {
        setTimeout(() => setShowGuide(true), 500);
        sessionStorage.setItem('votingGuideShown', 'true');
      }
    } else {
      setLoading(false);
    }
  }, [authLoading, ctxStudent, user, fetchData, isAdminUser, navigate]);

  const togglePosition = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const shareResult = async (position, winner, pct) => {
    const text = `🏆 ${winner.fullName} won ${position.title} in the ${election.title} with ${winner.voteCount} votes (${pct}%)!`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Election result', text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopiedId(position.id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch {
      // user closed the share sheet — nothing to do
    }
  };

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
  const levelWindow = election && !isResults
    ? getLevelWindowStatus(election, student?.level)
    : null;
  const votingBlocked = levelWindow && levelWindow.status !== 'open';

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

            {levelWindow && levelWindow.status !== 'open' && (
              <div className={`rounded-2xl p-4 text-center border ${
                levelWindow.status === 'pending'
                  ? 'bg-amber-50 border-amber-200'
                  : levelWindow.status === 'closed'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <Clock className={`w-5 h-5 mx-auto mb-1.5 ${
                  levelWindow.status === 'pending' ? 'text-amber-600' : levelWindow.status === 'closed' ? 'text-red-500' : 'text-gray-500'
                }`} />
                <h3 className={`text-sm font-extrabold mb-1 ${
                  levelWindow.status === 'pending' ? 'text-amber-900' : levelWindow.status === 'closed' ? 'text-red-800' : 'text-gray-800'
                }`}>{levelWindow.title}</h3>
                <p className={`text-xs leading-relaxed ${
                  levelWindow.status === 'pending' ? 'text-amber-700' : levelWindow.status === 'closed' ? 'text-red-600' : 'text-gray-600'
                }`}>{levelWindow.message}</p>
              </div>
            )}

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
            ) : votingBlocked ? (
              <button
                disabled
                className="w-full py-5 bg-gray-300 text-gray-500 rounded-2xl text-xl font-bold cursor-not-allowed shadow-md"
              >
                {levelWindow.status === 'pending' ? 'Voting not open yet' : 'Voting closed'}
              </button>
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
              <div className="inline-flex items-center gap-1.5 mt-3 bg-white/10 rounded-full px-3.5 py-1.5">
                <Lock className="w-3 h-3 text-[#DDF2E6]" />
                <p className="text-[#DDF2E6] text-[11px] font-bold uppercase tracking-widest">Final results</p>
              </div>
            </div>

            {/* Election summary */}
            {summary && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-2xl border border-[#E2E5EA] shadow-sm p-4 text-center">
                  <p className="text-2xl font-extrabold text-[#1F3A5C] font-mono tabular-nums"><AnimatedNumber value={summary.registeredCount} /></p>
                  <p className="text-[11px] text-[#8A93A3] font-semibold uppercase tracking-wide mt-1">Registered voters</p>
                </div>
                <div className="bg-white rounded-2xl border border-[#E2E5EA] shadow-sm p-4 text-center">
                  <p className="text-2xl font-extrabold text-[#1F7A54] font-mono tabular-nums"><AnimatedNumber value={summary.uniqueVoters} /></p>
                  <p className="text-[11px] text-[#8A93A3] font-semibold uppercase tracking-wide mt-1">Votes cast</p>
                </div>
                <div className="bg-white rounded-2xl border border-[#E2E5EA] shadow-sm p-4 text-center">
                  <p className="text-2xl font-extrabold text-[#B8862E] font-mono tabular-nums"><AnimatedNumber value={summary.turnoutPct} />%</p>
                  <p className="text-[11px] text-[#8A93A3] font-semibold uppercase tracking-wide mt-1">Turnout</p>
                </div>
                <div className="bg-white rounded-2xl border border-[#E2E5EA] shadow-sm p-4 text-center">
                  <p className="text-2xl font-extrabold text-[#7C3AED] font-mono tabular-nums"><AnimatedNumber value={summary.totalBallots} /></p>
                  <p className="text-[11px] text-[#8A93A3] font-semibold uppercase tracking-wide mt-1">Valid votes</p>
                </div>
              </div>
            )}

            {results.map((position) => {
              const totalVotes = position.candidates.reduce((sum, c) => sum + c.voteCount, 0);
              const positionHasVote = !!position.myVote;
              const winner = position.candidates[0];
              const runnerUp = position.candidates[1];
              const hasVotes = totalVotes > 0;
              const isTie = hasVotes && !!runnerUp && runnerUp.voteCount === winner.voteCount;
              const winnerPct = hasVotes ? Math.round((winner.voteCount / totalVotes) * 100) : 0;
              const margin = hasVotes && runnerUp ? winner.voteCount - runnerUp.voteCount : null;
              const marginPct = hasVotes && runnerUp ? winnerPct - Math.round((runnerUp.voteCount / totalVotes) * 100) : null;
              const isOpen = expanded[position.id] !== false;
              const otherCandidates = position.candidates.slice(1);

              return (
                <div key={position.id} className="bg-white rounded-2xl border border-[#E2E5EA] shadow-sm overflow-hidden">
                  {/* Header — tap to collapse/expand; winner is visible even collapsed */}
                  <button
                    onClick={() => togglePosition(position.id)}
                    className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <h3 className="text-lg font-extrabold text-[#1C2430] truncate">{position.title}</h3>
                      {hasVotes ? (
                        <p className="text-[#8A93A3] text-xs mt-0.5 truncate">
                          <span className="font-semibold text-[#B8862E]">🏆 {winner.fullName}</span>
                          <span className="mx-1">·</span>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}
                        </p>
                      ) : (
                        <p className="text-[#8A93A3] text-xs mt-0.5">No votes cast</p>
                      )}
                    </div>
                    {isOpen ? <ChevronUp className="w-5 h-5 text-[#98A2B3] flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-[#98A2B3] flex-shrink-0" />}
                  </button>

                  {isOpen && (
                    <div>
                      {/* Ticket-stub divider — signature motif */}
                      <div className="relative flex items-center px-5">
                        <div className="w-3 h-3 rounded-full bg-[#F5F6F8] border border-[#E2E5EA] -ml-[26px]"></div>
                        <div className="flex-1 border-t-2 border-dashed border-[#E2E5EA]"></div>
                        <div className="w-3 h-3 rounded-full bg-[#F5F6F8] border border-[#E2E5EA] -mr-[26px]"></div>
                      </div>

                      {!hasVotes ? (
                        <p className="text-xs text-[#98A2B3] text-center py-8 font-medium">No votes were cast for this position.</p>
                      ) : (
                        <>
                          {/* Winner spotlight — the "victory card" */}
                          <div className="mx-4 mt-4 bg-white border-2 border-[#B8862E] rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-center gap-2 mb-3.5">
                              <Trophy className="w-4 h-4 text-[#B8862E]" />
                              <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#B8862E]">{isTie ? 'Leading (tied)' : 'Winner'}</span>
                              <Trophy className="w-4 h-4 text-[#B8862E]" />
                            </div>
                            <div className="flex flex-col items-center text-center">
                              {winner.photoUrl ? (
                                <img src={winner.photoUrl} alt="" className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-[#B8862E] shadow-sm" />
                              ) : (
                                <div className="w-24 h-24 sm:w-28 sm:h-28 bg-[#FBF4E4] rounded-2xl flex items-center justify-center border-2 border-[#B8862E]">
                                  <User className="w-12 h-12 text-[#B8862E]" />
                                </div>
                              )}
                              <p className="text-xl sm:text-2xl font-extrabold text-[#1C2430] mt-3">{winner.fullName}</p>
                              <p className="text-[#8A93A3] text-sm font-medium">{winner.level}</p>
                              <div className="flex items-baseline gap-1.5 mt-2 font-mono tabular-nums">
                                <span className="text-3xl sm:text-4xl font-black text-[#B8862E]"><AnimatedNumber value={winner.voteCount} /></span>
                                <span className="text-[#8A93A3] text-sm font-semibold">votes · {winnerPct}%</span>
                              </div>
                              {!isTie && margin !== null && runnerUp && (
                                <p className="text-xs text-[#667085] font-semibold mt-1.5">
                                  Won by {margin} vote{margin !== 1 ? 's' : ''} <span className="text-[#98A2B3] font-medium">({marginPct}% lead)</span>
                                </p>
                              )}
                              {!runnerUp && <p className="text-xs text-[#667085] font-semibold mt-1.5">Unopposed</p>}
                              {position.myVote === winner.id && (
                                <div className="flex items-center gap-1.5 bg-[#EAF6EF] rounded-full px-3 py-1.5 mt-3">
                                  <CheckCircle className="w-3.5 h-3.5 text-[#1F7A54]" />
                                  <span className="text-xs font-bold text-[#155C40]">Your vote</span>
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => shareResult(position, winner, winnerPct)}
                              className="mt-4 w-full flex items-center justify-center gap-1.5 py-2.5 bg-[#1C2430] hover:bg-[#0F141C] text-white rounded-xl text-xs font-bold transition-colors"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              {copiedId === position.id ? 'Copied to clipboard' : 'Share result'}
                            </button>
                          </div>

                          {/* Other candidates — ranked, animated bars, medals for 2nd/3rd */}
                          {otherCandidates.length > 0 && (
                            <div className="px-4 sm:px-5 pt-4 pb-5">
                              <p className="text-[10px] font-bold text-[#8A93A3] uppercase tracking-widest mb-3">Other candidates</p>
                              <div className="space-y-3">
                                {otherCandidates.map((candidate, i) => {
                                  const rank = i + 2;
                                  const isMyVote = position.myVote === candidate.id;
                                  const candPct = totalVotes > 0 ? Math.round((candidate.voteCount / totalVotes) * 100) : 0;
                                  const barColor = isMyVote ? '#1F7A54' : '#94A3B8';
                                  return (
                                    <div key={candidate.id} className="flex items-center gap-3">
                                      <span className="w-6 flex-shrink-0 flex items-center justify-center">
                                        {rank === 2 ? (
                                          <Medal className="w-4 h-4 text-[#94A3B8]" />
                                        ) : rank === 3 ? (
                                          <Medal className="w-4 h-4 text-[#B08D57]" />
                                        ) : (
                                          <span className="text-xs font-bold text-[#98A2B3]">{rank}</span>
                                        )}
                                      </span>
                                      {candidate.photoUrl ? (
                                        <img
                                          src={candidate.photoUrl}
                                          alt=""
                                          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                                          style={{ border: `2px solid ${isMyVote ? '#1F7A54' : '#E2E5EA'}` }}
                                        />
                                      ) : (
                                        <div
                                          className="w-9 h-9 bg-[#EEF1F4] rounded-full flex items-center justify-center flex-shrink-0"
                                          style={{ border: `2px solid ${isMyVote ? '#1F7A54' : '#E2E5EA'}` }}
                                        >
                                          <User className="w-4 h-4 text-[#98A2B3]" />
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="text-sm font-bold text-[#1C2430] truncate">{candidate.fullName}</span>
                                            {isMyVote && (
                                              <span className="text-[9px] bg-[#1F7A54] text-white px-1.5 py-0.5 rounded font-bold flex-shrink-0">YOU</span>
                                            )}
                                          </div>
                                          <span className="text-xs font-extrabold text-[#1C2430] font-mono tabular-nums flex-shrink-0">
                                            <AnimatedNumber value={candidate.voteCount} /> <span className="text-[#98A2B3] font-semibold">({candPct}%)</span>
                                          </span>
                                        </div>
                                        <div className="w-full bg-[#EEF1F4] rounded-full h-2 overflow-hidden">
                                          <div
                                            className="h-2 rounded-full transition-all duration-700"
                                            style={{ width: `${candPct}%`, backgroundColor: barColor }}
                                          ></div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {!positionHasVote && hasVotes && (
                        <p className="text-xs text-[#98A2B3] text-center pb-4 font-medium">You did not vote for this position</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <VotingGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  );
};

export default StudentDashboard;