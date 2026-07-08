import React, { useState, useEffect } from 'react';
import { Calendar, Users, Shield, Tag, BarChart3, Vote, AlertCircle, Clock } from 'lucide-react';
import Card from '../../components/Card';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { CountdownTimer } from '../../components/CountdownTimer';

const statusBadges = {
  draft: 'bg-gray-100 text-gray-800 border-gray-200',
  published: 'bg-blue-100 text-blue-800 border-blue-200',
  open: 'bg-green-100 text-green-800 border-green-200',
  closed: 'bg-red-100 text-red-800 border-red-200',
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

  if (!election) return <div className="text-gray-500 text-sm">No election details.</div>;

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

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="flex items-center gap-3 p-4"><div className="p-2.5 bg-primary-100 text-primary-600 rounded-lg"><Shield className="w-5 h-5" /></div><div><p className="text-xs text-gray-500">Positions</p><p className="text-xl font-bold">{positions.length}</p></div></Card>
        <Card className="flex items-center gap-3 p-4"><div className="p-2.5 bg-green-100 text-green-600 rounded-lg"><Users className="w-5 h-5" /></div><div><p className="text-xs text-gray-500">Candidates</p><p className="text-xl font-bold">{candidates.length}</p></div></Card>
        <Card className="flex items-center gap-3 p-4"><div className="p-2.5 bg-yellow-100 text-yellow-600 rounded-lg"><Vote className="w-5 h-5" /></div><div><p className="text-xs text-gray-500">Votes Cast</p><p className="text-xl font-bold">{loadingVotes ? '...' : votes.length}</p></div></Card>
        <Card className="flex items-center gap-3 p-4"><div className="p-2.5 bg-purple-100 text-purple-600 rounded-lg"><Tag className="w-5 h-5" /></div><div><p className="text-xs text-gray-500">Status</p><span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border mt-1 ${statusBadges[election.status]}`}>{election.status?.toUpperCase()}</span></div></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2">
          <Card className="p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Election Details</h3>
            <div className="space-y-3">
              <div><p className="text-xs text-gray-500">Title</p><p className="text-gray-900 font-medium">{election.title}</p></div>
              <div><p className="text-xs text-gray-500">Academic Session</p><p className="text-gray-800 font-medium">{session}</p></div>
              <div><p className="text-xs text-gray-500">Description</p><p className="text-gray-600 text-sm whitespace-pre-wrap">{election.description || 'No description'}</p></div>
            </div>
          </Card>
        </div>
        <Card className="p-4 sm:p-6 h-fit">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Schedule</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-2"><Calendar className="w-4 h-4 text-gray-400 mt-0.5" /><div><p className="text-xs text-gray-500">Start Date</p><p className="text-sm font-semibold">{start ? new Date(start).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Not Set'}</p></div></div>
            <div className="flex items-start gap-2"><Calendar className="w-4 h-4 text-gray-400 mt-0.5" /><div><p className="text-xs text-gray-500">End Date</p><p className="text-sm font-semibold">{end ? new Date(end).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Not Set'}</p></div></div>
            {election.status === 'open' && election.closesAt && (
              <div className="flex items-start gap-2"><Clock className="w-4 h-4 text-blue-500 mt-0.5" /><div><p className="text-xs text-gray-500">Time Remaining</p><CountdownTimer closesAt={election.closesAt} /></div></div>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4 border-b pb-2">
          <BarChart3 className="w-5 h-5 text-primary-600" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">{isClosed ? 'Results' : 'Live Vote Breakdown'}</h3>
        </div>
        {election.status === 'draft' ? (
          <div className="text-center py-8"><AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-2" /><p className="text-gray-500 text-sm">Analytics available after publishing.</p></div>
        ) : loadingVotes ? (
          <div className="text-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto mb-2"></div><p className="text-gray-500 text-sm">Loading results...</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {positions.map(position => {
              const positionCandidates = candidates.filter(c => c.positionId === position.id);
              const totalPosVotes = getPositionTotalVotes(position.id);
              const leadingCandidate = getWinnerForPosition(position.id, positionCandidates);
              return (
                <div key={position.id} className="border rounded-xl p-3 sm:p-4 bg-gray-50/50">
                  <div className="flex justify-between items-center mb-3 border-b pb-2">
                    <h4 className="font-bold text-gray-800 text-sm">{position.title}</h4>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full">{totalPosVotes} vote{totalPosVotes !== 1 ? 's' : ''}</span>
                  </div>
                  {positionCandidates.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No candidates.</p>
                  ) : (
                    <div className="space-y-2">
                      {positionCandidates.map(candidate => {
                        const count = getCandidateVotes(candidate.id);
                        const percentage = totalPosVotes > 0 ? (count / totalPosVotes) * 100 : 0;
                        const isLeader = leadingCandidate?.id === candidate.id;
                        return (
                          <div key={candidate.id} className={`p-2.5 rounded-lg border bg-white ${isLeader ? 'border-green-300 shadow-sm' : 'border-gray-100'}`}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                {candidate.photoUrl ? <img src={candidate.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover border" /> : <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center border"><Users className="w-4 h-4 text-gray-400" /></div>}
                                <div>
                                  <span className="text-xs font-semibold">{candidate.fullName}</span>
                                  {isLeader && <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold rounded bg-green-100 text-green-800">{isClosed ? 'Winner' : 'Leading'}</span>}
                                </div>
                              </div>
                              <div className="text-right"><span className="text-xs font-bold">{count}</span><span className="text-xs text-gray-400 block">{Math.round(percentage)}%</span></div>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5"><div className={`h-1.5 rounded-full transition-all ${isLeader ? 'bg-green-600' : 'bg-primary-600'}`} style={{ width: `${percentage}%` }}></div></div>
                          </div>
                        );
                      })}
                    </div>
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
