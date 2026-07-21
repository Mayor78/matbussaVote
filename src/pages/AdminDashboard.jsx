import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, getCountFromServer, updateDoc, doc, addDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Users, Vote, TrendingUp, UserCheck, Plus, Play, Square, Eye } from 'lucide-react';
import AuthCodeModal from '../components/AuthCodeModal';
import { electionSchema } from '../utils/schemas';
import { getUserFriendlyError } from '../utils/errors';
import { bundleService } from '../services/electionBundleService';

const fetchStats = async () => {
  const [totalStudentsCount, registeredCount, votesCount, activeCount, positionsCount, candidatesCount] = await Promise.all([
    getCountFromServer(collection(db, 'students')),
    getCountFromServer(query(collection(db, 'students'), where('registeredStatus', '==', true))),
    getCountFromServer(collection(db, 'votes')),
    getCountFromServer(query(collection(db, 'elections'), where('status', '==', 'open'))),
    getCountFromServer(collection(db, 'positions')),
    getCountFromServer(collection(db, 'candidates')),
  ]);

  const totalStudents = totalStudentsCount.data().count;
  const registeredStudents = registeredCount.data().count;
  const totalVotes = votesCount.data().count;
  const activeElections = activeCount.data().count;
  const totalPositions = positionsCount.data().count;
  const totalCandidates = candidatesCount.data().count;
  const turnout = registeredStudents > 0 && totalPositions > 0
    ? ((totalVotes / (registeredStudents * Math.max(totalPositions, 1))) * 100).toFixed(1)
    : 0;

  return { totalStudents, registeredStudents, totalVotesCast: totalVotes, activeElections, totalPositions, totalCandidates, turnoutPercentage: turnout };
};

const fetchElections = async () => {
  const snapshot = await getDocs(query(collection(db, 'elections')));
  const elections = await Promise.all(
    snapshot.docs.map(async (d) => {
      const data = d.data();
      const eid = d.id;
      const [posCount, candCount, voteCount] = await Promise.all([
        getCountFromServer(query(collection(db, 'positions'), where('electionId', '==', eid))),
        getCountFromServer(query(collection(db, 'candidates'), where('electionId', '==', eid))),
        getCountFromServer(query(collection(db, 'votes'), where('electionId', '==', eid))),
      ]);
      return {
        id: eid, ...data,
        positionsCount: posCount.data().count,
        candidatesCount: candCount.data().count,
        votesCount: voteCount.data().count,
      };
    })
  );

  elections.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return elections;
};

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 border border-gray-100">
    <div className="flex items-center justify-between mb-3">
      <div className={`p-2 sm:p-3 bg-${color}-100 rounded-lg`}>
        <Icon className={`w-5 h-5 sm:w-6 sm:h-6 text-${color}-600`} />
      </div>
      <span className="text-xl sm:text-2xl font-bold text-gray-900">{value}</span>
    </div>
    <h3 className="text-gray-500 text-xs sm:text-sm">{title}</h3>
  </div>
);

const statusColors = {
  draft: 'bg-yellow-100 text-yellow-800',
  published: 'bg-blue-100 text-blue-800',
  open: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAuthCode, setShowAuthCode] = useState(false);
  const [authAction, setAuthAction] = useState('');
  const [pendingElectionId, setPendingElectionId] = useState(null);

  const { register, handleSubmit, reset, setError, clearErrors, formState: { errors } } = useForm({
    defaultValues: { title: '', description: '', academicSession: '', startDate: '', endDate: '', durationHours: 24 },
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: fetchStats,
    refetchInterval: 120000,
  });

  const { data: elections = [], isLoading: electionsLoading } = useQuery({
    queryKey: ['adminElections'],
    queryFn: fetchElections,
    refetchInterval: 120000,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ electionId, action }) => {
      const ref = doc(db, 'elections', electionId);
      const status = action === 'activate' ? 'open' : 'closed';
      await updateDoc(ref, { status, updatedAt: new Date().toISOString() });
      return { electionId, status };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['adminElections'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      if (result.status === 'open') {
        bundleService.buildBundle(result.electionId).catch(() => {});
      }
      toast.success(`Election ${result.status}!`);
    },
    onError: (error) => toast.error(getUserFriendlyError(error)),
  });

  useEffect(() => {
    const checkExpired = async () => {
      try {
        const openSnap = await getDocs(query(collection(db, 'elections'), where('status', '==', 'open')));
        const now = Date.now();
        for (const d of openSnap.docs) {
          const data = d.data();
          if (data.closesAt && now > new Date(data.closesAt).getTime()) {
            await updateDoc(doc(db, 'elections', d.id), {
              status: 'closed',
              updatedAt: new Date().toISOString(),
            });
            queryClient.invalidateQueries({ queryKey: ['adminElections'] });
            queryClient.invalidateQueries({ queryKey: ['adminStats'] });
            console.log(`[AutoClose] Election ${d.id} auto-closed`);
          }
        }
      } catch { /* auto-close is best-effort */ }
    };

    const interval = setInterval(checkExpired, 30000);
    checkExpired();
    return () => clearInterval(interval);
  }, [queryClient]);

  const handleElectionAction = (electionId, action) => {
    if (action === 'activate') {
      statusMutation.mutate({ electionId, action });
    } else {
      setAuthAction('CLOSE_ELECTION');
      setPendingElectionId(electionId);
      setShowAuthCode(true);
    }
  };

  const onCreateElection = async (data) => {
    clearErrors();
    const result = electionSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        setError(issue.path[0], { message: issue.message });
      }
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'elections'), {
        title: result.data.title,
        description: result.data.description,
        academicSession: result.data.academicSession,
        startDate: result.data.startDate,
        endDate: result.data.endDate,
        durationHours: result.data.durationHours || 24,
        closesAt: null,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      toast.success('Election created!');
      setShowCreateModal(false);
      reset({ title: '', description: '', academicSession: '', startDate: '', endDate: '', durationHours: 24 });
      queryClient.invalidateQueries({ queryKey: ['adminElections'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    } catch (error) {
      toast.error(getUserFriendlyError(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (statsLoading || electionsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 text-sm mt-0.5">Manage elections, candidates, and monitor voting</p>
        </div>
        <button onClick={() => { reset({ title: '', description: '', academicSession: '', startDate: '', endDate: '' }); setShowCreateModal(true); }} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
          <Plus className="w-4 h-4 mr-1.5" /> Create Election
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Total Students" value={stats?.totalStudents || 0} icon={Users} color="blue" />
        <StatCard title="Registered Voters" value={stats?.registeredStudents || 0} icon={UserCheck} color="green" />
        <StatCard title="Votes Cast" value={stats?.totalVotesCast || 0} icon={Vote} color="purple" />
        <StatCard title="Turnout Rate" value={`${stats?.turnoutPercentage || 0}%`} icon={TrendingUp} color="orange" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 border-b border-gray-200">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Elections</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 sm:px-6 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-4 sm:px-6 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Session</th>
                <th className="px-4 sm:px-6 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 sm:px-6 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Pos</th>
                <th className="px-4 sm:px-6 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Cand</th>
                <th className="px-4 sm:px-6 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Votes</th>
                <th className="px-4 sm:px-6 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {elections.map((election) => (
                <tr key={election.id} className="hover:bg-gray-50">
                  <td className="px-4 sm:px-6 py-3">
                    <div className="font-medium text-gray-900 text-sm">{election.title}</div>
                    <div className="text-xs text-gray-500 truncate max-w-[150px]">{election.description}</div>
                  </td>
                  <td className="px-4 sm:px-6 py-3 text-xs text-gray-600">{election.academicSession || election.academic_session}</td>
                  <td className="px-4 sm:px-6 py-3">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusColors[election.status] || ''}`}>
                      {election.status?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-3 text-xs text-gray-600">{election.positionsCount || 0}</td>
                  <td className="px-4 sm:px-6 py-3 text-xs text-gray-600">{election.candidatesCount || 0}</td>
                  <td className="px-4 sm:px-6 py-3 text-xs text-gray-600">{election.votesCount || 0}</td>
                  <td className="px-4 sm:px-6 py-3">
                    <div className="flex gap-1">
                      {election.status === 'draft' && (
                        <button onClick={() => handleElectionAction(election.id, 'activate')} className="p-1.5 text-green-600 hover:text-green-800" title="Open Election">
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {election.status === 'open' && (
                        <button onClick={() => handleElectionAction(election.id, 'close')} className="p-1.5 text-red-600 hover:text-red-800" title="Close Election">
                          <Square className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => navigate(`/admin/elections/${election.id}`)} className="p-1.5 text-gray-600 hover:text-gray-800" title="View">
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Create Election</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <form onSubmit={handleSubmit(onCreateElection)} className="space-y-3">
              <div>
                <input {...register('title')} placeholder="Election Title" className="w-full px-3 py-2 border rounded-lg text-sm" />
                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
              </div>
              <div>
                <textarea {...register('description')} placeholder="Description" className="w-full px-3 py-2 border rounded-lg text-sm" rows="3" />
              </div>
              <div>
                <input {...register('academicSession')} placeholder="Academic Session (e.g., 2025/2026)" className="w-full px-3 py-2 border rounded-lg text-sm" />
                {errors.academicSession && <p className="text-red-500 text-xs mt-1">{errors.academicSession.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" {...register('startDate')} className="w-full px-3 py-2 border rounded-lg text-sm" />
                <input type="date" {...register('endDate')} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Duration (auto-close after)</label>
                <select {...register('durationHours')} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="1">1 hour</option>
                  <option value="3">3 hours</option>
                  <option value="6">6 hours</option>
                  <option value="12">12 hours</option>
                  <option value="24">24 hours</option>
                  <option value="48">48 hours</option>
                  <option value="72">72 hours</option>
                  <option value="168">168 hours (1 week)</option>
                </select>
              </div>
              <button type="submit" disabled={submitting} className="w-full bg-primary-600 text-white py-2.5 rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50">
                {submitting ? 'Creating...' : 'Create Election'}
              </button>
            </form>
          </div>
        </div>
      )}

      <AuthCodeModal
        isOpen={showAuthCode}
        onClose={() => { setShowAuthCode(false); setPendingElectionId(null); }}
        action={authAction}
        onAuthorized={() => {
          if (pendingElectionId) {
            statusMutation.mutate({ electionId: pendingElectionId, action: 'close' });
            setPendingElectionId(null);
          }
        }}
      />
    </div>
  );
};

export default AdminDashboard;
