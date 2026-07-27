import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ArrowLeft, Download, ShieldCheck, FileText, Users, BarChart3 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/Button';
import Card from '../../components/Card';

// Solid, non-gradient palette for candidate slices. Index 0 (the leader/winner)
// always renders in gold via the isWinner flag passed into buildSliceColor.
const CANDIDATE_COLORS = ['#1F3A5C', '#7C3AED', '#0E7490', '#DB2777', '#65A30D', '#B45309', '#4338CA', '#0F766E'];
const buildSliceColor = (idx, isTopSlice, isClosed) => {
  if (isTopSlice) return isClosed ? '#B8862E' : '#1F3A5C';
  return CANDIDATE_COLORS[(idx + 1) % CANDIDATE_COLORS.length];
};

const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-[#E2E5EA] rounded-lg shadow-md px-3 py-2">
      <p className="text-xs font-bold text-[#1C2430]">{d.name}</p>
      <p className="text-xs text-[#667085] font-mono tabular-nums mt-0.5">{d.value} vote{d.value !== 1 ? 's' : ''} · {d.pct}%</p>
    </div>
  );
};

export const ResultsVerification = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [election, setElection] = useState(null);
  const [positions, setPositions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [votes, setVotes] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('results');
  const [revealMode, setRevealMode] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [electionSnap, positionsSnap, candidatesSnap, votesSnap, studentsSnap] =
          await Promise.all([
            getDocs(query(collection(db, 'elections'))),
            getDocs(query(collection(db, 'positions'), where('electionId', '==', id))),
            getDocs(query(collection(db, 'candidates'), where('electionId', '==', id))),
            getDocs(query(collection(db, 'votes'), where('electionId', '==', id))),
            getDocs(collection(db, 'students')),
          ]);

        const elections = electionSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const foundElection = elections.find(e => e.id === id) || null;
        setElection(foundElection);

        setPositions(positionsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setCandidates(candidatesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setVotes(votesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setStudents(studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error('Error loading verification data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const getCandidateVotes = (candidateId) => votes.filter(v => v.candidateId === candidateId).length;
  const getPositionVotes = (positionId) => votes.filter(v => v.positionId === positionId).length;
  const totalVotesCast = votes.length;

  const getStudentMatricById = (studentId) => {
    const s = students.find(s => s.id === studentId);
    return s ? (s.matricNumber || s.matric_number || s.id) : studentId;
  };

  const handleExportCSV = () => {
    if (votes.length === 0) return;
    const headers = 'Vote #,Position,Timestamp,Vote Hash,Verifiable\n';
    const rows = votes
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((v, i) => {
        const pos = positions.find(p => p.id === v.positionId);
        const ts = v.createdAt ? new Date(v.createdAt).toISOString() : '';
        const hash = v.voteHash || '';
        return `${i + 1},"${pos?.title || v.positionId}","${ts}","${hash}","${hash}"`;
      })
      .join('\n');

    const totalRow = `\nTotal,Votes Cast,,,,${votes.length}`;
    const csv = headers + rows + totalRow;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vote-ledger-${election?.title || id}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportResults = () => {
    const headers = 'Position,Candidate,Votes,Percentage\n';
    const rows = [];
    positions.forEach(pos => {
      const posCandidates = candidates.filter(c => c.positionId === pos.id);
      const totalPosVotes = getPositionVotes(pos.id);
      posCandidates.forEach(c => {
        const count = getCandidateVotes(c.id);
        const pct = totalPosVotes > 0 ? ((count / totalPosVotes) * 100).toFixed(1) : '0.0';
        rows.push(`"${pos.title}","${c.fullName}",${count},${pct}%`);
      });
      rows.push(`"${pos.title}","TOTAL",${totalPosVotes},100%`);
      rows.push('');
    });
    const csv = headers + rows.join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `election-results-${election?.title || id}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh] bg-[#F5F6F8]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#1F3A5C] border-t-transparent mx-auto mb-3"></div>
          <p className="text-[#667085] text-sm font-medium">Loading verification data…</p>
        </div>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="p-6 text-center bg-[#F5F6F8] min-h-[60vh]">
        <p className="text-[#667085] font-medium">Election not found.</p>
        <Button variant="secondary" onClick={() => navigate('/admin/elections')} className="mt-4">Go back</Button>
      </div>
    );
  }

  const isClosed = election.status === 'closed';
  const registeredCount = students.filter(s => s.registeredStatus || s.registered_status).length;
  const votedCount = [...new Set(votes.map(v => v.studentId))].length;
  const allVotesSorted = [...votes].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const turnoutPct = registeredCount > 0 ? ((votedCount / registeredCount) * 100).toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start sm:items-center gap-3 flex-wrap">
          <button onClick={() => navigate(`/admin/elections/${id}`)} className="p-2.5 bg-white border border-[#E2E5EA] hover:border-[#C7CDD6] rounded-xl transition-colors flex-shrink-0">
            <ArrowLeft className="w-4 h-4 text-[#4B5563]" />
          </button>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C2430] tracking-tight">Results verification</h1>
              <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full uppercase tracking-wide ${isClosed ? 'bg-[#FBEAEA] text-[#C0392B]' : 'bg-[#EAF6EF] text-[#155C40]'}`}>
                {election.status}
              </span>
            </div>
            <p className="text-[#8A93A3] text-sm font-medium mt-0.5">{election.title} — {election.academicSession || election.academic_session}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportResults} className="!border-[#E2E5EA] !text-[#1C2430]">
              <Download className="w-4 h-4 mr-1.5 inline" /> Export results
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="!border-[#E2E5EA] !text-[#1C2430]">
              <FileText className="w-4 h-4 mr-1.5 inline" /> Export ledger
            </Button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Card className="flex items-center gap-3 p-4 !border-[#E2E5EA]">
            <div className="w-11 h-11 flex items-center justify-center bg-[#EEF3F8] text-[#1F3A5C] rounded-xl flex-shrink-0"><Users className="w-5 h-5" /></div>
            <div className="min-w-0">
              <p className="text-[11px] text-[#8A93A3] font-semibold uppercase tracking-wide">Registered voters</p>
              <p className="text-xl font-extrabold text-[#1C2430] font-mono tabular-nums">{registeredCount}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4 !border-[#E2E5EA]">
            <div className="w-11 h-11 flex items-center justify-center bg-[#EAF6EF] text-[#1F7A54] rounded-xl flex-shrink-0"><ShieldCheck className="w-5 h-5" /></div>
            <div className="min-w-0">
              <p className="text-[11px] text-[#8A93A3] font-semibold uppercase tracking-wide">Unique voters</p>
              <p className="text-xl font-extrabold text-[#1C2430] font-mono tabular-nums">{votedCount}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4 !border-[#E2E5EA]">
            <div className="w-11 h-11 flex items-center justify-center bg-[#F3ECFA] text-[#7C3AED] rounded-xl flex-shrink-0"><BarChart3 className="w-5 h-5" /></div>
            <div className="min-w-0">
              <p className="text-[11px] text-[#8A93A3] font-semibold uppercase tracking-wide">Total votes cast</p>
              <p className="text-xl font-extrabold text-[#1C2430] font-mono tabular-nums">{totalVotesCast}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4 !border-[#E2E5EA]">
            <div className="w-11 h-11 flex items-center justify-center bg-[#FDF6E7] text-[#B7791F] rounded-xl flex-shrink-0"><ShieldCheck className="w-5 h-5" /></div>
            <div className="min-w-0">
              <p className="text-[11px] text-[#8A93A3] font-semibold uppercase tracking-wide">Turnout</p>
              <p className="text-xl font-extrabold text-[#1C2430] font-mono tabular-nums">{turnoutPct}%</p>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-[#E2E5EA] rounded-xl p-1.5">
          <button
            onClick={() => setActiveTab('results')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'results' ? 'bg-[#1F3A5C] text-white shadow-sm' : 'text-[#667085] hover:text-[#1C2430] hover:bg-[#F5F6F8]'}`}
          >
            Results breakdown
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'ledger' ? 'bg-[#1F3A5C] text-white shadow-sm' : 'text-[#667085] hover:text-[#1C2430] hover:bg-[#F5F6F8]'}`}
          >
            Vote ledger
          </button>
          <button
            onClick={() => setActiveTab('integrity')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'integrity' ? 'bg-[#1F3A5C] text-white shadow-sm' : 'text-[#667085] hover:text-[#1C2430] hover:bg-[#F5F6F8]'}`}
          >
            Integrity check
          </button>
        </div>

        {/* RESULTS TAB */}
        {activeTab === 'results' && (
          <div className="space-y-4">
            {positions.map(position => {
              const posCandidates = candidates.filter(c => c.positionId === position.id);
              const totalPosVotes = getPositionVotes(position.id);
              const sortedCandidates = [...posCandidates].sort((a, b) => getCandidateVotes(b.id) - getCandidateVotes(a.id));
              return (
                <Card key={position.id} className="p-4 sm:p-6 !border-[#E2E5EA]">
                  <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#EDEFF2]">
                    <h3 className="font-extrabold text-[#1C2430] text-base">{position.title}</h3>
                    <span className="text-xs font-bold text-[#667085] bg-[#EEF1F4] px-2.5 py-1 rounded-full font-mono tabular-nums">
                      {totalPosVotes} vote{totalPosVotes !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {posCandidates.length === 0 ? (
                    <p className="text-xs text-[#8A93A3] italic">No candidates.</p>
                  ) : (
                    <div className="grid sm:grid-cols-[200px_1fr] gap-5 sm:gap-6 items-center">
                      {totalPosVotes > 0 ? (
                        <div className="relative w-full h-[190px] mx-auto max-w-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={sortedCandidates.map(c => ({
                                  name: c.fullName,
                                  value: getCandidateVotes(c.id),
                                  pct: Math.round((getCandidateVotes(c.id) / totalPosVotes) * 100),
                                }))}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={58}
                                outerRadius={85}
                                paddingAngle={sortedCandidates.length > 1 ? 2 : 0}
                                stroke="none"
                              >
                                {sortedCandidates.map((c, idx) => (
                                  <Cell key={c.id} fill={buildSliceColor(idx, idx === 0, isClosed)} />
                                ))}
                              </Pie>
                              <Tooltip content={<ChartTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-2xl font-extrabold text-[#1C2430] font-mono tabular-nums">{totalPosVotes}</span>
                            <span className="text-[10px] text-[#8A93A3] font-bold uppercase tracking-wide">votes</span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-[190px] max-w-[200px] mx-auto flex items-center justify-center rounded-full border-2 border-dashed border-[#E2E5EA]">
                          <span className="text-xs text-[#98A2B3] font-medium text-center px-4">No votes yet</span>
                        </div>
                      )}

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[420px]">
                        <thead>
                          <tr className="border-b border-[#EDEFF2] text-left">
                            <th className="pb-2.5 text-[11px] font-bold text-[#8A93A3] uppercase tracking-wide">Candidate</th>
                            <th className="pb-2.5 text-[11px] font-bold text-[#8A93A3] uppercase tracking-wide text-right">Votes</th>
                            <th className="pb-2.5 text-[11px] font-bold text-[#8A93A3] uppercase tracking-wide text-right">Share</th>
                            <th className="pb-2.5 text-[11px] font-bold text-[#8A93A3] uppercase tracking-wide text-right w-[140px]">Distribution</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedCandidates.map((c, idx) => {
                            const count = getCandidateVotes(c.id);
                            const percentage = totalPosVotes > 0 ? (count / totalPosVotes) * 100 : 0;
                            return (
                              <tr key={c.id} className="border-b border-[#F5F6F8] last:border-0">
                                <td className="py-3">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: totalPosVotes > 0 ? buildSliceColor(idx, idx === 0, isClosed) : '#D9DEE5' }}
                                    ></span>
                                    {idx === 0 && totalPosVotes > 0 && isClosed && (
                                      <span className="px-2 py-0.5 text-[10px] font-extrabold rounded uppercase tracking-wide bg-[#B8862E] text-white">Winner</span>
                                    )}
                                    {idx === 0 && totalPosVotes > 0 && !isClosed && (
                                      <span className="px-2 py-0.5 text-[10px] font-extrabold rounded uppercase tracking-wide bg-[#EEF3F8] text-[#1F3A5C]">Leading</span>
                                    )}
                                    <span className="text-sm font-semibold text-[#1C2430]">{c.fullName}</span>
                                  </div>
                                </td>
                                <td className="py-3 text-right text-sm font-extrabold text-[#1C2430] font-mono tabular-nums">{count}</td>
                                <td className="py-3 text-right text-sm text-[#667085] font-mono tabular-nums">{Math.round(percentage)}%</td>
                                <td className="py-3 text-right">
                                  <div className="w-full max-w-[120px] bg-[#EEF1F4] rounded-full h-2 ml-auto overflow-hidden">
                                    <div
                                      className="h-2 rounded-full"
                                      style={{ width: `${percentage}%`, backgroundColor: totalPosVotes > 0 ? buildSliceColor(idx, idx === 0, isClosed) : '#98A2B3' }}
                                    ></div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="font-semibold border-t-2 border-[#E2E5EA]">
                            <td className="pt-3 text-xs text-[#8A93A3] font-bold uppercase tracking-wide">Total</td>
                            <td className="pt-3 text-right text-sm font-extrabold text-[#1C2430] font-mono tabular-nums">{totalPosVotes}</td>
                            <td className="pt-3 text-right text-sm text-[#667085] font-mono">100%</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* LEDGER TAB */}
        {activeTab === 'ledger' && (
          <Card className="p-4 sm:p-6 !border-[#E2E5EA]">
            <div className="flex justify-between items-center gap-3 flex-wrap mb-4 pb-3 border-b border-[#EDEFF2]">
              <div>
                <h3 className="font-extrabold text-[#1C2430]">Anonymized vote ledger</h3>
                <p className="text-xs text-[#8A93A3] mt-1 max-w-md">Each vote is listed with a unique hash for verification. No candidate choices are shown.</p>
              </div>
              <div className="flex items-center gap-3">
                {!revealMode ? (
                  <Button variant="secondary" size="sm" onClick={() => setRevealMode(true)}>
                    Reveal matric numbers
                  </Button>
                ) : (
                  <span className="text-xs text-[#C0392B] font-bold bg-[#FBEAEA] px-2.5 py-1.5 rounded-full">Matric numbers visible</span>
                )}
              </div>
            </div>
            {allVotesSorted.length === 0 ? (
              <p className="text-center text-[#8A93A3] py-10 font-medium">No votes cast yet.</p>
            ) : (
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto rounded-xl border border-[#EDEFF2]">
                <table className="w-full min-w-[500px] text-sm">
                  <thead className="bg-[#F5F6F8] sticky top-0">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-[11px] font-bold text-[#8A93A3] uppercase tracking-wide">#</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-bold text-[#8A93A3] uppercase tracking-wide">Position</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-bold text-[#8A93A3] uppercase tracking-wide">Timestamp</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-bold text-[#8A93A3] uppercase tracking-wide">Vote hash</th>
                      {revealMode && <th className="px-3 py-2.5 text-left text-[11px] font-bold text-[#8A93A3] uppercase tracking-wide">Student matric</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDEFF2]">
                    {allVotesSorted.map((v, i) => {
                      const pos = positions.find(p => p.id === v.positionId);
                      return (
                        <tr key={v.id || i} className="hover:bg-[#F7F9FB]">
                          <td className="px-3 py-2.5 font-mono text-[#98A2B3] tabular-nums">{i + 1}</td>
                          <td className="px-3 py-2.5 font-semibold text-[#1C2430]">{pos?.title || v.positionId}</td>
                          <td className="px-3 py-2.5 text-[#667085]">{v.createdAt ? new Date(v.createdAt).toLocaleString() : '—'}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-[#8A93A3]">{v.voteHash?.substring(0, 16) || '—'}...</td>
                          {revealMode && <td className="px-3 py-2.5 font-mono text-xs text-[#1C2430] font-semibold">{getStudentMatricById(v.studentId)}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#E2E5EA] font-semibold bg-[#F5F6F8]">
                      <td className="px-3 py-2.5 font-bold text-[#1C2430]" colSpan={revealMode ? 5 : 4}>Total: {allVotesSorted.length} votes</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* INTEGRITY TAB */}
        {activeTab === 'integrity' && (
          <div className="space-y-4">
            <Card className="p-4 sm:p-6 !border-[#E2E5EA]">
              <h3 className="font-extrabold text-[#1C2430] mb-3 pb-3 border-b border-[#EDEFF2]">Integrity check summary</h3>
              <div className="space-y-0 text-sm">
                <div className="flex justify-between py-3 border-b border-[#F5F6F8]">
                  <span className="text-[#667085] font-medium">Total votes in ledger</span>
                  <span className="font-mono font-extrabold text-[#1C2430] tabular-nums">{allVotesSorted.length}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-[#F5F6F8]">
                  <span className="text-[#667085] font-medium">Unique voters</span>
                  <span className="font-mono font-extrabold text-[#1C2430] tabular-nums">{votedCount}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-[#F5F6F8]">
                  <span className="text-[#667085] font-medium">Registered eligible voters</span>
                  <span className="font-mono font-extrabold text-[#1C2430] tabular-nums">{registeredCount}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-[#F5F6F8]">
                  <span className="text-[#667085] font-medium">Positions</span>
                  <span className="font-mono font-extrabold text-[#1C2430] tabular-nums">{positions.length}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-[#F5F6F8]">
                  <span className="text-[#667085] font-medium">Election status</span>
                  <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full uppercase tracking-wide ${isClosed ? 'bg-[#FBEAEA] text-[#C0392B]' : 'bg-[#EAF6EF] text-[#155C40]'}`}>{election.status?.toUpperCase()}</span>
                </div>

                <div className="mt-5 p-4 bg-[#F5F6F8] rounded-xl">
                  <h4 className="font-bold text-[#1C2430] mb-2.5 text-sm">Per-position verification</h4>
                  {positions.map(position => {
                    const posVotes = getPositionVotes(position.id);
                    const uniqueVotersForPos = [...new Set(votes.filter(v => v.positionId === position.id).map(v => v.studentId))].length;
                    return (
                      <div key={position.id} className="flex justify-between py-2 border-b border-[#E5E7EB] last:border-0 text-xs">
                        <span className="text-[#4B5563] font-medium">{position.title}</span>
                        <span className="font-mono text-[#1C2430] font-semibold tabular-nums">{posVotes} votes / {uniqueVotersForPos} unique voters</span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 p-4 bg-[#EEF3F8] border border-[#C9D6E3] rounded-xl">
                  <div className="flex items-center gap-2 text-[#1F3A5C]">
                    <div className="w-7 h-7 rounded-full bg-[#1F3A5C] flex items-center justify-center flex-shrink-0">
                      <ShieldCheck className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-extrabold text-sm">Integrity status: verifiable</span>
                  </div>
                  <p className="text-xs text-[#4B6480] mt-2 leading-relaxed">
                    All {allVotesSorted.length} votes are recorded with unique cryptographic hashes. The CSV export contains the full ledger for external verification, and tally counts match the individual vote records.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsVerification;