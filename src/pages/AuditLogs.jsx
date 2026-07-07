import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { FileText, Search, Calendar, User, RefreshCw, ShieldCheck } from 'lucide-react';

const fetchAuditLogs = async () => {
  try {
    const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(200));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
};

const actionColors = {
  ELECTION_CREATED: 'bg-green-100 text-green-800',
  ELECTION_UPDATED: 'bg-blue-100 text-blue-800',
  ELECTION_DELETED: 'bg-red-100 text-red-800',
  ELECTION_OPEN: 'bg-green-100 text-green-800',
  ELECTION_CLOSED: 'bg-gray-100 text-gray-800',
  ELECTION_PUBLISHED: 'bg-purple-100 text-purple-800',
  ELECTION_DRAFT: 'bg-yellow-100 text-yellow-800',
  VOTE_CAST: 'bg-primary-100 text-primary-800',
  STUDENT_REGISTERED: 'bg-blue-100 text-blue-800',
  STUDENT_PRELOADED: 'bg-yellow-100 text-yellow-800',
  CANDIDATE_ADDED: 'bg-teal-100 text-teal-800',
  CANDIDATE_UPDATED: 'bg-teal-100 text-teal-800',
  CANDIDATE_DELETED: 'bg-red-100 text-red-800',
  POSITION_ADDED: 'bg-indigo-100 text-indigo-800',
  POSITION_UPDATED: 'bg-indigo-100 text-indigo-800',
  POSITION_DELETED: 'bg-red-100 text-red-800',
  ADMIN_ADDED: 'bg-purple-100 text-purple-800',
  ADMIN_REMOVED: 'bg-red-100 text-red-800',
  STUDENT_DELETED: 'bg-red-100 text-red-800',
};

const AuditLogs = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: fetchAuditLogs,
    refetchInterval: 15000,
  });

  const uniqueActions = [...new Set(logs.map(l => l.action))].sort();

  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchTerm === '' || 
      log.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter === '' || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600 text-sm mt-0.5">Track all admin actions and system events — see who did what and when</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input type="text" placeholder="Search by admin email, action, or details..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
        </div>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
          <option value="">All Actions</option>
          {uniqueActions.map(action => (
            <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Stats bar */}
      {!isLoading && logs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(
            logs.reduce((acc, log) => {
              acc[log.action] = (acc[log.action] || 0) + 1;
              return acc;
            }, {})
          ).slice(0, 5).map(([action, count]) => (
            <span key={action} className={`px-2.5 py-1 text-xs font-semibold rounded-full ${actionColors[action] || 'bg-gray-100 text-gray-800'}`}>
              {action.replace(/_/g, ' ')}: {count}
            </span>
          ))}
          {uniqueActions.length > 5 && (
            <span className="px-2.5 py-1 text-xs text-gray-500">+{uniqueActions.length - 5} more</span>
          )}
        </div>
      )}

      {/* Logs List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-1">No Audit Logs Found</h3>
            <p className="text-gray-500 text-sm">
              {logs.length === 0 ? 'No activity has been recorded yet. Actions will appear here as admins use the system.' : 'Try adjusting your filters.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredLogs.map((log) => (
              <div key={log.id} className="px-4 sm:px-6 py-3 hover:bg-gray-50/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${actionColors[log.action] || 'bg-gray-100 text-gray-800'}`}>
                        {log.action?.replace(/_/g, ' ') || 'Unknown Action'}
                      </span>
                      {log.userEmail && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                          {log.userEmail.includes('admin') ? (
                            <ShieldCheck className="w-3 h-3 text-purple-500" />
                          ) : (
                            <User className="w-3 h-3 text-gray-400" />
                          )}
                          {log.userEmail}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">{log.details || 'No details provided'}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 whitespace-nowrap">
                    <Calendar className="w-3 h-3" />
                    <span>{log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {filteredLogs.length > 0 && (
        <p className="text-xs text-gray-500 text-center">
          Showing {filteredLogs.length} of {logs.length} log entries
        </p>
      )}
    </div>
  );
};

export default AuditLogs;
