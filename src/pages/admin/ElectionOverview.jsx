import React, { useState, useEffect } from 'react';
import { Calendar, Users, Shield, Tag, BarChart3, Vote, AlertCircle, Clock, Trophy } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../../components/Card';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { CountdownTimer } from '../../components/CountdownTimer';

const STATUS_STYLE = {
  draft:     { bg: '#FDF6E7', fg: '#B7791F', label: 'Draft' },
  published: { bg: '#EEF3F8', fg: '#1F3A5C', label: 'Published' },
  open:      { bg: '#EAF6EF', fg: '#155C40', label: 'Open' },
  closed:    { bg: '#FBEAEA', fg: '#C0392B', label: 'Closed' },
};

// Solid, non-gradient palette for non-leading slices; the leader always renders
// in gold (closed election) or navy (open election) so it reads the same way
// as its bar and its avatar ring.
const SLICE_COLORS = ['#7C3AED', '#0E7490', '#DB2777', '#65A30D', '#4338CA', '#0F766E'];

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

export const ElectionOverview = ({ election, positions = [], candidates = [] }) => {
  const [votes, setVotes] = useState([]);
  const [loadingVotes, setLoadingVotes] = useState(true);

  useEffect(() => {
    if (!election?.id) return;
    const fetchVotes = async () => {
      try {
        setLoadingVotes(true);
        const votesQuery = query(collection(db, 'votes'), where('electionId', '==', election.id));
        const snapshot = await getDocs(votesQuery);
        setVotes(snapshot.docs.map(doc => doc.data()));
      } catch (error) {
        console.error('Error fetching votes:', error);
      } finally {
        setLoadingVotes(false);
      }
    };
    fetchVotes();
  }, [election?.id]);

  if (!election) return <div className="text-[#8A93A3] text-sm font-medium">No election details.</div>;

  const getCandidateVotes = (candidateId) => votes.filter(v => v.candidateId === candidateId).length;
  const getPositionTotalVotes = (positionId) => votes.filter(v => v.positionId === positionId).length;

  const getWinnerForPosition = (positionId, positionCandidates) => {
    if (votes.length === 0 || positionCandidates.length === 0) return null;
    let maxVotes = -1, winner = null, isTie = false;
    positionCandidates.forEach(c => {
      const count = getCandidateVotes(c.id);
      if (count > maxVotes) { maxVotes = count; winner = c; isTie = false; }
      else if (count === maxVotes && count > 0) { isTie = true; }
    });
    return maxVotes > 0 && !isTie ? winner : null;
  };

  const session = election.academicSession || election.academic_session || 'N/A';
  const start = election.startDate || election.start_date;
  const end = election.endDate || election.end_date;
  const isClosed = election.status === 'closed';
  const statusStyle = STATUS_STYLE[election.status] || STATUS_STYLE.draft;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="flex items-center gap-3 p-4 !border-[#E2E5EA]">
          <div className="w-11 h-11 flex items-center justify-center bg-[#EEF3F8] text-[#1F3A5C] rounded-xl flex-shrink-0"><Shield className="w-5 h-5" /></div>
          <div className="min-w-0"><p className="text-[11px] text-[#8A93A3] font-semibold uppercase tracking-wide">Positions</p><p className="text-xl font-extrabold text-[#1C2430] font-mono tabular-nums">{positions.length}</p></div>
        </Card>
        <Card className="flex items-center gap-3 p-4 !border-[#E2E5EA]">
          <div className="w-11 h-11 flex items-center justify-center bg-[#EAF6EF] text-[#1F7A54] rounded-xl flex-shrink-0"><Users className="w-5 h-5" /></div>
          <div className="min-w-0"><p className="text-[11px] text-[#8A93A3] font-semibold uppercase tracking-wide">Candidates</p><p className="text-xl font-extrabold text-[#1C2430] font-mono tabular-nums">{candidates.length}</p></div>
        </Card>
        <Card className="flex items-center gap-3 p-4 !border-[#E2E5EA]">
          <div className="w-11 h-11 flex items-center justify-center bg-[#F3ECFA] text-[#7C3AED] rounded-xl flex-shrink-0"><Vote className="w-5 h-5" /></div>
          <div className="min-w-0"><p className="text-[11px] text-[#8A93A3] font-semibold uppercase tracking-wide">Votes cast</p><p className="text-xl font-extrabold text-[#1C2430] font-mono tabular-nums">{loadingVotes ? '…' : votes.length}</p></div>
        </Card>
        <Card className="flex items-center gap-3 p-4 !border-[#E2E5EA]">
          <div className="w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: statusStyle.bg, color: statusStyle.fg }}><Tag className="w-5 h-5" /></div>
          <div className="min-w-0">
            <p className="text-[11px] text-[#8A93A3] font-semibold uppercase tracking-wide">Status</p>
            <span className="inline-flex px-2 py-0.5 text-[11px] font-bold rounded-full mt-0.5" style={{ backgroundColor: statusStyle.bg, color: statusStyle.fg }}>{statusStyle.label.toUpperCase()}</span>
          </div>
        </Card>
      </div>

      {/* Details + Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2">
          <Card className="p-4 sm:p-6 !border-[#E2E5EA] h-full">
            <h3 className="text-base sm:text-lg font-extrabold text-[#1C2430] mb-4 pb-3 border-b border-[#EDEFF2]">Election details</h3>
            <div className="space-y-4">
              <div><p className="text-[11px] text-[#8A93A3] font-semibold uppercase tracking-wide mb-0.5">Title</p><p className="text-[#1C2430] font-bold">{election.title}</p></div>
              <div><p className="text-[11px] text-[#8A93A3] font-semibold uppercase tracking-wide mb-0.5">Academic session</p><p className="text-[#1C2430] font-semibold">{session}</p></div>
              <div><p className="text-[11px] text-[#8A93A3] font-semibold uppercase tracking-wide mb-0.5">Description</p><p className="text-[#667085] text-sm whitespace-pre-wrap leading-relaxed">{election.description || 'No description'}</p></div>
            </div>
          </Card>
        </div>
        <Card className="p-4 sm:p-6 h-fit !border-[#E2E5EA]">
          <h3 className="text-base sm:text-lg font-extrabold text-[#1C2430] mb-4 pb-3 border-b border-[#EDEFF2]">Schedule</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#EEF1F4] flex items-center justify-center flex-shrink-0"><Calendar className="w-4 h-4 text-[#8A93A3]" /></div>
              <div className="min-w-0">
                <p className="text-[11px] text-[#8A93A3] font-semibold uppercase tracking-wide">Start date</p>
                <p className="text-sm font-bold text-[#1C2430]">{start ? new Date(start).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#EEF1F4] flex items-center justify-center flex-shrink-0"><Calendar className="w-4 h-4 text-[#8A93A3]" /></div>
              <div className="min-w-0">
                <p className="text-[11px] text-[#8A93A3] font-semibold uppercase tracking-wide">End date</p>
                <p className="text-sm font-bold text-[#1C2430]">{end ? new Date(end).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set'}</p>
              </div>
            </div>
            {election.status === 'open' && election.closesAt && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#EEF3F8] flex items-center justify-center flex-shrink-0"><Clock className="w-4 h-4 text-[#1F3A5C]" /></div>
                <div className="min-w-0">
                  <p className="text-[11px] text-[#8A93A3] font-semibold uppercase tracking-wide">Time remaining</p>
                  <CountdownTimer closesAt={election.closesAt} />
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Vote breakdown */}
      <Card className="p-4 sm:p-6 !border-[#E2E5EA]">
        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#EDEFF2]">
          <div className="w-8 h-8 rounded-lg bg-[#EEF3F8] flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-4 h-4 text-[#1F3A5C]" />
          </div>
          <h3 className="text-base sm:text-lg font-extrabold text-[#1C2430]">{isClosed ? 'Results' : 'Live vote breakdown'}</h3>
        </div>
        {election.status === 'draft' ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 rounded-full bg-[#EEF1F4] flex items-center justify-center mx-auto mb-3"><AlertCircle className="w-7 h-7 text-[#98A2B3]" /></div>
            <p className="text-[#8A93A3] text-sm font-medium">Analytics available after publishing.</p>
          </div>
        ) : loadingVotes ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#1F3A5C] border-t-transparent mx-auto mb-3"></div>
            <p className="text-[#8A93A3] text-sm font-medium">Loading results…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {positions.map(position => {
              const positionCandidates = candidates.filter(c => c.positionId === position.id);
              const totalPosVotes = getPositionTotalVotes(position.id);
              const leadingCandidate = getWinnerForPosition(position.id, positionCandidates);
              const sortedCandidates = [...positionCandidates].sort((a, b) => getCandidateVotes(b.id) - getCandidateVotes(a.id));
              const maxVotes = sortedCandidates[0] ? getCandidateVotes(sortedCandidates[0].id) : 0;

              return (
                <div key={position.id} className="border border-[#E2E5EA] rounded-2xl p-4 bg-[#FAFBFC]">
                  <div className="flex justify-between items-center mb-3.5 pb-2.5 border-b border-[#EDEFF2]">
                    <h4 className="font-extrabold text-[#1C2430] text-sm">{position.title}</h4>
                    <span className="text-xs font-bold px-2.5 py-1 bg-white border border-[#E2E5EA] text-[#4B5563] rounded-full font-mono tabular-nums">{totalPosVotes} vote{totalPosVotes !== 1 ? 's' : ''}</span>
                  </div>
                  {sortedCandidates.length === 0 ? (
                    <p className="text-xs text-[#8A93A3] italic">No candidates.</p>
                  ) : (
                    <>
                      {totalPosVotes > 0 && (
                        <div className="relative w-[104px] h-[104px] mx-auto mb-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={sortedCandidates.map((c, idx) => ({
                                  name: c.fullName,
                                  value: getCandidateVotes(c.id),
                                  pct: Math.round((getCandidateVotes(c.id) / totalPosVotes) * 100),
                                  color: leadingCandidate?.id === c.id
                                    ? (isClosed ? '#B8862E' : '#1F3A5C')
                                    : SLICE_COLORS[idx % SLICE_COLORS.length],
                                }))}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={32}
                                outerRadius={50}
                                paddingAngle={sortedCandidates.length > 1 ? 2 : 0}
                                stroke="none"
                              >
                                {sortedCandidates.map((c, idx) => (
                                  <Cell
                                    key={c.id}
                                    fill={leadingCandidate?.id === c.id ? (isClosed ? '#B8862E' : '#1F3A5C') : SLICE_COLORS[idx % SLICE_COLORS.length]}
                                  />
                                ))}
                              </Pie>
                              <Tooltip content={<ChartTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-base font-extrabold text-[#1C2430] font-mono tabular-nums">{totalPosVotes}</span>
                            <span className="text-[9px] text-[#8A93A3] font-bold uppercase tracking-wide">votes</span>
                          </div>
                        </div>
                      )}
                      <div className="space-y-3">
                      {sortedCandidates.map(candidate => {
                        const count = getCandidateVotes(candidate.id);
                        const percentage = totalPosVotes > 0 ? (count / totalPosVotes) * 100 : 0;
                        const widthPct = maxVotes > 0 ? Math.max((count / maxVotes) * 100, count > 0 ? 8 : 0) : 0;
                        const isLeader = leadingCandidate?.id === candidate.id;
                        const barColor = isLeader ? (isClosed ? '#B8862E' : '#1F3A5C') : '#94A3B8';

                        return (
                          <div key={candidate.id} className="flex items-center gap-2.5">
                            <div className="relative flex-shrink-0">
                              {candidate.photoUrl ? (
                                <img
                                  src={candidate.photoUrl}
                                  alt=""
                                  className="rounded-full object-cover"
                                  style={{ width: 36, height: 36, border: `2px solid ${isLeader ? barColor : '#E2E5EA'}` }}
                                />
                              ) : (
                                <div className="rounded-full flex items-center justify-center bg-white" style={{ width: 36, height: 36, border: `2px solid ${isLeader ? barColor : '#E2E5EA'}` }}>
                                  <Users className="w-4 h-4 text-[#98A2B3]" />
                                </div>
                              )}
                              {isLeader && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center" style={{ backgroundColor: barColor }}>
                                  <Trophy className="w-2 h-2 text-white" />
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-xs font-bold text-[#1C2430] truncate">{candidate.fullName}</span>
                                  {isLeader && (
                                    <span
                                      className="px-1.5 py-0.5 text-[9px] font-extrabold rounded uppercase tracking-wide flex-shrink-0"
                                      style={{ backgroundColor: isClosed ? '#B8862E' : '#EEF3F8', color: isClosed ? '#FFFFFF' : '#1F3A5C' }}
                                    >
                                      {isClosed ? 'Winner' : 'Leading'}
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs font-extrabold text-[#1C2430] font-mono tabular-nums flex-shrink-0">
                                  {count}<span className="text-[#98A2B3] font-semibold"> ({Math.round(percentage)}%)</span>
                                </span>
                              </div>
                              <div className="w-full bg-[#EEF1F4] rounded-full h-2 overflow-hidden">
                                <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${widthPct}%`, backgroundColor: barColor }}></div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};