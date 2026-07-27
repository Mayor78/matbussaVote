import { useQuery } from '@tanstack/react-query';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where, getCountFromServer } from 'firebase/firestore';
import { BarChart3, Users, Vote, TrendingUp, Calendar, Award, PieChart as PieChartIcon, Activity } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const fetchAnalytics = async () => {
  const [electionsSnap, positionsSnap, candidatesSnap, totalStudentsCount, registeredCount] = await Promise.all([
    getDocs(collection(db, 'elections')),
    getDocs(collection(db, 'positions')),
    getDocs(collection(db, 'candidates')),
    getCountFromServer(collection(db, 'students')),
    getCountFromServer(query(collection(db, 'students'), where('registeredStatus', '==', true))),
  ]);

  const elections = electionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const positions = positionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const candidates = candidatesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const totalStudents = totalStudentsCount.data().count;
  const registeredStudents = registeredCount.data().count;

  const electionStats = elections.map(election => {
    const electionPositions = positions.filter(p => p.electionId === election.id);
    const electionCandidates = candidates.filter(c => c.electionId === election.id);
    const electionVoteCount = electionCandidates.reduce((sum, c) => sum + (c.voteCount || 0), 0);
    
    const totalPossibleVotes = registeredStudents * electionPositions.length;
    const turnout = totalPossibleVotes > 0 ? ((electionVoteCount / totalPossibleVotes) * 100).toFixed(1) : 0;

    return {
      id: election.id,
      title: election.title,
      status: election.status,
      session: election.academicSession || election.academic_session,
      positions: electionPositions.length,
      candidates: electionCandidates.length,
      votes: electionVoteCount,
      turnout,
    };
  });

  const levelDistribution = {};
  candidates.forEach(c => { levelDistribution[c.level] = (levelDistribution[c.level] || 0) + 1; });

  const statusDistribution = { draft: 0, published: 0, open: 0, closed: 0 };
  elections.forEach(e => { if (statusDistribution[e.status] !== undefined) statusDistribution[e.status]++; });

  const totalVotes = candidates.reduce((sum, c) => sum + (c.voteCount || 0), 0);
  const totalElections = elections.length;

  return {
    electionStats,
    levelDistribution,
    statusDistribution,
    totalStudents,
    registeredStudents,
    totalVotes,
    totalElections,
    totalCandidates: candidates.length,
    totalPositions: positions.length,
  };
};

// Fixed, solid palette — no gradients. Tailwind can't see class names built with
// template literals (e.g. `bg-${color}-100`) at build time, so colors are resolved
// through this map and applied as inline styles instead of dynamic class names.
const STAT_COLORS = {
  blue:   { bg: '#EEF3F8', fg: '#1F3A5C' },
  purple: { bg: '#F3ECFA', fg: '#7C3AED' },
  green:  { bg: '#EAF6EF', fg: '#1F7A54' },
  orange: { bg: '#FDF6E7', fg: '#B7791F' },
};

const LEVEL_COLORS = ['#1F3A5C', '#B8862E', '#7C3AED', '#0E7490', '#DB2777', '#65A30D', '#4338CA'];
const STATUS_COLORS = { draft: '#B7791F', published: '#1F3A5C', open: '#1F7A54', closed: '#8A93A3' };

const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-[#E2E5EA] rounded-lg shadow-md px-3 py-2">
      <p className="text-xs font-bold text-[#1C2430]">{d.name}</p>
      <p className="text-xs text-[#667085] font-mono tabular-nums mt-0.5">{d.value} · {d.pct}%</p>
    </div>
  );
};

const Analytics = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: fetchAnalytics,
    refetchInterval: 120000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-[#F5F6F8]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#1F3A5C] border-t-transparent"></div>
      </div>
    );
  }

  const analytics = data || {
    electionStats: [], levelDistribution: {}, statusDistribution: { draft: 0, published: 0, open: 0, closed: 0 },
    totalStudents: 0, registeredStudents: 0, totalVotes: 0, totalElections: 0, totalCandidates: 0, totalPositions: 0,
  };

  const levelEntries = Object.entries(analytics.levelDistribution);
  const totalLevelCandidates = levelEntries.reduce((sum, [, count]) => sum + count, 0);
  const levelChartData = levelEntries.map(([level, count], idx) => ({
    name: level,
    value: count,
    pct: totalLevelCandidates > 0 ? Math.round((count / totalLevelCandidates) * 100) : 0,
    color: LEVEL_COLORS[idx % LEVEL_COLORS.length],
  }));

  const statusMeta = [
    { key: 'draft', label: 'Draft' },
    { key: 'published', label: 'Published' },
    { key: 'open', label: 'Open' },
    { key: 'closed', label: 'Closed' },
  ];
  const statusChartData = statusMeta
    .map(({ key, label }) => ({
      name: label,
      value: analytics.statusDistribution[key] || 0,
      pct: analytics.totalElections > 0 ? Math.round(((analytics.statusDistribution[key] || 0) / analytics.totalElections) * 100) : 0,
      color: STATUS_COLORS[key],
    }));

  const registrationRatePct = analytics.totalStudents > 0 ? ((analytics.registeredStudents / analytics.totalStudents) * 100).toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <div className="space-y-5 sm:space-y-6 max-w-6xl mx-auto p-3 sm:p-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C2430] tracking-tight">Analytics</h1>
          <p className="text-[#8A93A3] text-sm font-medium mt-0.5">Comprehensive election statistics and insights</p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <MiniStat title="Total elections" value={analytics.totalElections} icon={Calendar} color="blue" />
          <MiniStat title="Total votes" value={analytics.totalVotes} icon={Vote} color="purple" />
          <MiniStat title="Candidates" value={analytics.totalCandidates} icon={Users} color="green" />
          <MiniStat title="Positions" value={analytics.totalPositions} icon={Award} color="orange" />
        </div>

        {/* Election Performance */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E2E5EA] p-4 sm:p-6">
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#EDEFF2]">
            <div className="w-8 h-8 rounded-lg bg-[#EEF3F8] flex items-center justify-center flex-shrink-0">
              <BarChart3 className="w-4 h-4 text-[#1F3A5C]" />
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-[#1C2430]">Election performance</h2>
          </div>
          {analytics.electionStats.length === 0 ? (
            <p className="text-[#8A93A3] text-sm text-center py-10 font-medium">No election data available yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-[#EDEFF2]">
                    <th className="text-left py-2.5 px-2 text-[11px] font-bold text-[#8A93A3] uppercase tracking-wide">Election</th>
                    <th className="text-left py-2.5 px-2 text-[11px] font-bold text-[#8A93A3] uppercase tracking-wide">Session</th>
                    <th className="text-center py-2.5 px-2 text-[11px] font-bold text-[#8A93A3] uppercase tracking-wide">Status</th>
                    <th className="text-center py-2.5 px-2 text-[11px] font-bold text-[#8A93A3] uppercase tracking-wide">Positions</th>
                    <th className="text-center py-2.5 px-2 text-[11px] font-bold text-[#8A93A3] uppercase tracking-wide">Candidates</th>
                    <th className="text-center py-2.5 px-2 text-[11px] font-bold text-[#8A93A3] uppercase tracking-wide">Votes</th>
                    <th className="text-center py-2.5 px-2 text-[11px] font-bold text-[#8A93A3] uppercase tracking-wide">Turnout</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.electionStats.map((stat) => {
                    const statusStyle = {
                      open: { bg: '#EAF6EF', fg: '#155C40' },
                      closed: { bg: '#EEF1F4', fg: '#4B5563' },
                      published: { bg: '#EEF3F8', fg: '#1F3A5C' },
                      draft: { bg: '#FDF6E7', fg: '#B7791F' },
                    }[stat.status] || { bg: '#FDF6E7', fg: '#B7791F' };
                    return (
                      <tr key={stat.id} className="border-b border-[#F5F6F8] hover:bg-[#F7F9FB]">
                        <td className="py-3 px-2 font-bold text-[#1C2430] text-xs">{stat.title}</td>
                        <td className="py-3 px-2 text-xs text-[#667085] font-medium">{stat.session}</td>
                        <td className="py-3 px-2 text-center">
                          <span
                            className="px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wide"
                            style={{ backgroundColor: statusStyle.bg, color: statusStyle.fg }}
                          >{stat.status}</span>
                        </td>
                        <td className="py-3 px-2 text-center text-xs font-mono tabular-nums text-[#1C2430]">{stat.positions}</td>
                        <td className="py-3 px-2 text-center text-xs font-mono tabular-nums text-[#1C2430]">{stat.candidates}</td>
                        <td className="py-3 px-2 text-center text-xs font-extrabold font-mono tabular-nums text-[#1C2430]">{stat.votes}</td>
                        <td className="py-3 px-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-12 sm:w-16 bg-[#EEF1F4] rounded-full h-1.5 overflow-hidden">
                              <div className="bg-[#1F3A5C] h-1.5 rounded-full" style={{ width: `${Math.min(stat.turnout, 100)}%` }}></div>
                            </div>
                            <span className="text-xs text-[#667085] font-mono tabular-nums font-semibold">{stat.turnout}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Level Distribution */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E2E5EA] p-4 sm:p-6">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#EDEFF2]">
              <div className="w-8 h-8 rounded-lg bg-[#F3ECFA] flex items-center justify-center flex-shrink-0">
                <PieChartIcon className="w-4 h-4 text-[#7C3AED]" />
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#1C2430]">Candidates by level</h2>
            </div>
            {levelChartData.length === 0 ? (
              <p className="text-[#8A93A3] text-sm text-center py-10 font-medium">No candidates yet.</p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-5">
                <div className="relative w-[170px] h-[170px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={levelChartData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={levelChartData.length > 1 ? 2 : 0} stroke="none">
                        {levelChartData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-extrabold text-[#1C2430] font-mono tabular-nums">{totalLevelCandidates}</span>
                    <span className="text-[10px] text-[#8A93A3] font-bold uppercase tracking-wide">total</span>
                  </div>
                </div>
                <div className="flex-1 w-full space-y-2.5">
                  {levelChartData.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }}></span>
                        <span className="font-semibold text-[#1C2430] truncate">{entry.name}</span>
                      </div>
                      <span className="text-[#667085] font-mono tabular-nums font-medium flex-shrink-0 ml-2">{entry.value} · {entry.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Status Distribution */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E2E5EA] p-4 sm:p-6">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#EDEFF2]">
              <div className="w-8 h-8 rounded-lg bg-[#EEF3F8] flex items-center justify-center flex-shrink-0">
                <Activity className="w-4 h-4 text-[#1F3A5C]" />
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#1C2430]">Election status</h2>
            </div>
            {analytics.totalElections === 0 ? (
              <p className="text-[#8A93A3] text-sm text-center py-10 font-medium">No elections yet.</p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-5">
                <div className="relative w-[170px] h-[170px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusChartData.filter(d => d.value > 0)} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none">
                        {statusChartData.filter(d => d.value > 0).map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-extrabold text-[#1C2430] font-mono tabular-nums">{analytics.totalElections}</span>
                    <span className="text-[10px] text-[#8A93A3] font-bold uppercase tracking-wide">elections</span>
                  </div>
                </div>
                <div className="flex-1 w-full space-y-2.5">
                  {statusChartData.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }}></span>
                        <span className="font-semibold text-[#1C2430] truncate">{entry.name}</span>
                      </div>
                      <span className="text-[#667085] font-mono tabular-nums font-medium flex-shrink-0 ml-2">{entry.value} · {entry.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Voter Engagement */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E2E5EA] p-4 sm:p-6">
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#EDEFF2]">
            <div className="w-8 h-8 rounded-lg bg-[#EAF6EF] flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-[#1F7A54]" />
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-[#1C2430]">Voter engagement</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#EEF3F8] rounded-xl p-5 text-center">
              <p className="text-2xl sm:text-3xl font-extrabold text-[#1F3A5C] font-mono tabular-nums">{analytics.totalStudents}</p>
              <p className="text-xs text-[#4B6480] mt-1.5 font-semibold uppercase tracking-wide">Eligible students</p>
            </div>
            <div className="bg-[#EAF6EF] rounded-xl p-5 text-center">
              <p className="text-2xl sm:text-3xl font-extrabold text-[#1F7A54] font-mono tabular-nums">{analytics.registeredStudents}</p>
              <p className="text-xs text-[#2F855A] mt-1.5 font-semibold uppercase tracking-wide">Registered voters</p>
            </div>
            <div className="bg-[#F3ECFA] rounded-xl p-5 text-center">
              <p className="text-2xl sm:text-3xl font-extrabold text-[#7C3AED] font-mono tabular-nums">{registrationRatePct}%</p>
              <p className="text-xs text-[#6B46C1] mt-1.5 font-semibold uppercase tracking-wide">Registration rate</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MiniStat = ({ title, value, icon: Icon, color }) => {
  const { bg, fg } = STAT_COLORS[color] || STAT_COLORS.blue;
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 border border-[#E2E5EA]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: fg }} />
        </div>
        <div className="min-w-0">
          <p className="text-lg sm:text-xl font-extrabold text-[#1C2430] font-mono tabular-nums">{value}</p>
          <p className="text-[11px] text-[#8A93A3] font-semibold uppercase tracking-wide truncate">{title}</p>
        </div>
      </div>
    </div>
  );
};

export default Analytics;