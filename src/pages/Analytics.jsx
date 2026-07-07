import { useQuery } from '@tanstack/react-query';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { BarChart3, Users, Vote, TrendingUp, Calendar, Award, PieChart, Activity } from 'lucide-react';

const fetchAnalytics = async () => {
  const [electionsSnap, positionsSnap, candidatesSnap, votesSnap, studentsSnap] = await Promise.all([
    getDocs(collection(db, 'elections')),
    getDocs(collection(db, 'positions')),
    getDocs(collection(db, 'candidates')),
    getDocs(collection(db, 'votes')),
    getDocs(collection(db, 'students')),
  ]);

  const elections = electionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const positions = positionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const candidates = candidatesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const votes = votesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const totalStudents = studentsSnap.docs.length;
  let registeredStudents = 0;
  studentsSnap.docs.forEach(doc => {
    const d = doc.data();
    if (d.registeredStatus ?? d.registered_status) registeredStudents++;
  });

  const electionStats = elections.map(election => {
    const electionPositions = positions.filter(p => p.electionId === election.id);
    const electionCandidates = candidates.filter(c => c.electionId === election.id);
    const electionVotes = votes.filter(v => v.electionId === election.id);
    
    const totalPossibleVotes = registeredStudents * electionPositions.length;
    const turnout = totalPossibleVotes > 0 ? ((electionVotes.length / totalPossibleVotes) * 100).toFixed(1) : 0;

    return {
      id: election.id,
      title: election.title,
      status: election.status,
      session: election.academicSession || election.academic_session,
      positions: electionPositions.length,
      candidates: electionCandidates.length,
      votes: electionVotes.length,
      turnout,
    };
  });

  const levelDistribution = {};
  candidates.forEach(c => { levelDistribution[c.level] = (levelDistribution[c.level] || 0) + 1; });

  const statusDistribution = { draft: 0, published: 0, open: 0, closed: 0 };
  elections.forEach(e => { if (statusDistribution[e.status] !== undefined) statusDistribution[e.status]++; });

  const totalVotes = votes.length;
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

const Analytics = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: fetchAnalytics,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const analytics = data || {
    electionStats: [], levelDistribution: {}, statusDistribution: { draft: 0, published: 0, open: 0, closed: 0 },
    totalStudents: 0, registeredStudents: 0, totalVotes: 0, totalElections: 0, totalCandidates: 0, totalPositions: 0,
  };

  const maxBarWidth = Math.max(...Object.values(analytics.levelDistribution), 1);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 text-sm mt-0.5">Comprehensive election statistics and insights</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MiniStat title="Total Elections" value={analytics.totalElections} icon={Calendar} color="blue" />
        <MiniStat title="Total Votes" value={analytics.totalVotes} icon={Vote} color="purple" />
        <MiniStat title="Candidates" value={analytics.totalCandidates} icon={Users} color="green" />
        <MiniStat title="Positions" value={analytics.totalPositions} icon={Award} color="orange" />
      </div>

      {/* Election Performance */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary-600" />
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Election Performance</h2>
        </div>
        {analytics.electionStats.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No election data available yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">Election</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">Session</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">Positions</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">Candidates</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">Votes</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">Turnout</th>
                </tr>
              </thead>
              <tbody>
                {analytics.electionStats.map((stat) => (
                  <tr key={stat.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-2 font-medium text-gray-900 text-xs">{stat.title}</td>
                    <td className="py-2.5 px-2 text-xs text-gray-600">{stat.session}</td>
                    <td className="py-2.5 px-2 text-center">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                        stat.status === 'open' ? 'bg-green-100 text-green-800' :
                        stat.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                        stat.status === 'published' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>{stat.status}</span>
                    </td>
                    <td className="py-2.5 px-2 text-center text-xs">{stat.positions}</td>
                    <td className="py-2.5 px-2 text-center text-xs">{stat.candidates}</td>
                    <td className="py-2.5 px-2 text-center text-xs font-semibold">{stat.votes}</td>
                    <td className="py-2.5 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-12 sm:w-16 bg-gray-100 rounded-full h-1.5">
                          <div className="bg-primary-600 h-1.5 rounded-full" style={{ width: `${Math.min(stat.turnout, 100)}%` }}></div>
                        </div>
                        <span className="text-xs text-gray-600">{stat.turnout}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Level Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-primary-600" />
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Candidates by Level</h2>
          </div>
          {Object.keys(analytics.levelDistribution).length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No candidates yet.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(analytics.levelDistribution).map(([level, count]) => (
                <div key={level}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{level}</span>
                    <span className="text-gray-500">{count}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-primary-500 h-2 rounded-full" style={{ width: `${(count / maxBarWidth) * 100}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-primary-600" />
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Election Status</h2>
          </div>
          <div className="space-y-3">
            {[
              { key: 'draft', label: 'Draft', color: 'bg-yellow-400' },
              { key: 'published', label: 'Published', color: 'bg-blue-400' },
              { key: 'open', label: 'Open', color: 'bg-green-400' },
              { key: 'closed', label: 'Closed', color: 'bg-gray-400' },
            ].map(({ key, label, color }) => {
              const count = analytics.statusDistribution[key] || 0;
              const pct = analytics.totalElections > 0 ? (count / analytics.totalElections) * 100 : 0;
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{label}</span>
                    <span className="text-gray-500">{count}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Voter Engagement */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary-600" />
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Voter Engagement</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-primary-600">{analytics.totalStudents}</p>
            <p className="text-xs text-gray-500 mt-1">Eligible Students</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-green-600">{analytics.registeredStudents}</p>
            <p className="text-xs text-gray-500 mt-1">Registered Voters</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-purple-600">
              {analytics.totalStudents > 0 ? ((analytics.registeredStudents / analytics.totalStudents) * 100).toFixed(1) : 0}%
            </p>
            <p className="text-xs text-gray-500 mt-1">Registration Rate</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const MiniStat = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
    <div className="flex items-center gap-3">
      <div className={`p-2 bg-${color}-100 rounded-lg`}>
        <Icon className={`w-4 h-4 sm:w-5 sm:h-5 text-${color}-600`} />
      </div>
      <div>
        <p className="text-lg sm:text-xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{title}</p>
      </div>
    </div>
  </div>
);

export default Analytics;
