import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Vote, Clock, AlertCircle, LogOut, CheckCircle } from 'lucide-react';

const StudentDashboard = () => {
  const { user, studentData: ctxStudent, loading: authLoading, logout, isAdminUser } = useAuth();
  const [student, setStudent] = useState(null);
  const [election, setElection] = useState(null);
  const [progress, setProgress] = useState({ voted: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = useCallback(async (studentId) => {
    try {
      const eSnap = await getDocs(query(collection(db, 'elections'), where('status', '==', 'open')));
      if (eSnap.empty) { setElection(null); return; }

      const el = { id: eSnap.docs[0].id, ...eSnap.docs[0].data() };
      setElection(el);

      const pSnap = await getDocs(query(collection(db, 'positions'), where('electionId', '==', el.id)));
      const total = pSnap.size;

      const vSnap = await getDocs(query(
        collection(db, 'votes'),
        where('electionId', '==', el.id),
        where('studentId', '==', studentId)
      ));
      const voted = vSnap.size;

      setProgress({ voted, total });
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

      {/* Has election */}
      {election && (
        <div className="space-y-5">
          {/* Election info card */}
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

          {/* Progress */}
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

          {/* Action button */}
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

          {/* Already started but not done? show tiny note */}
          {hasStarted && !allDone && (
            <p className="text-xs text-gray-400 text-center">You have already voted for some positions. Tap the button to continue.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
