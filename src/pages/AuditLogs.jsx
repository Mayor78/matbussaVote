import { useState, useEffect, useCallback } from 'react';
import { auditService } from '../services/auditService';
import { FileText, Search, Calendar, User, RefreshCw, ShieldCheck, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';

const PAGE_SIZE = 25;

const actionColors = {
  ELECTION_CREATED: 'bg-green-100 text-green-800',
  ELECTION_UPDATED: 'bg-blue-100 text-blue-800',
  ELECTION_DELETED: 'bg-red-100 text-red-800',
  ELECTION_OPEN: 'bg-green-100 text-green-800',
  ELECTION_CLOSED: 'bg-red-100 text-red-800',
  ELECTION_PUBLISHED: 'bg-purple-100 text-purple-800',
  ELECTION_DRAFT: 'bg-yellow-100 text-yellow-800',
  VOTE_CAST: 'bg-primary-100 text-primary-800',
  STUDENT_REGISTERED: 'bg-blue-100 text-blue-800',
  STUDENT_PRELOADED: 'bg-yellow-100 text-yellow-800',
  STUDENT_UPDATED: 'bg-orange-100 text-orange-800',
  STUDENT_DELETED: 'bg-red-100 text-red-800',
  STUDENTS_BATCH_DELETED: 'bg-red-100 text-red-800',
  CANDIDATE_ADDED: 'bg-teal-100 text-teal-800',
  CANDIDATE_UPDATED: 'bg-teal-100 text-teal-800',
  CANDIDATE_DELETED: 'bg-red-100 text-red-800',
  POSITION_ADDED: 'bg-indigo-100 text-indigo-800',
  POSITION_UPDATED: 'bg-indigo-100 text-indigo-800',
  POSITION_DELETED: 'bg-red-100 text-red-800',
  ADMIN_ADDED: 'bg-purple-100 text-purple-800',
  ADMIN_REMOVED: 'bg-red-100 text-red-800',
  ADMIN_PROMOTED: 'bg-purple-100 text-purple-800',
  ADMIN_DEMOTED: 'bg-orange-100 text-orange-800',
  AUTH_CODE_GENERATED: 'bg-gray-100 text-gray-800',
  SUSPICIOUS_VOTE: 'bg-red-100 text-red-800',
};

const actionIcons = {
  ELECTION_CREATED: '📋',
  ELECTION_OPEN: '▶️',
  ELECTION_CLOSED: '⏹️',
  ELECTION_DELETED: '🗑️',
  VOTE_CAST: '🗳️',
  STUDENT_PRELOADED: '👤',
  STUDENT_DELETED: '🗑️',
  STUDENTS_BATCH_DELETED: '🗑️',
  ADMIN_ADDED: '🛡️',
  ADMIN_REMOVED: '🚫',
  AUTH_CODE_GENERATED: '🔑',
};

const formatDate = (iso) => {
  if (!iso) return 'Unknown';
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

const formatTime = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(0);
  const [cursors, setCursors] = useState([null]);
  const [hasMore, setHasMore] = useState(true);
  const [actionCounts, setActionCounts] = useState({});
  const [isFetching, setIsFetching] = useState(false);

  const fetchPage = useCallback(async (pageIndex, cursor, filter) => {
    setIsFetching(true);
    try {
      const result = await auditService.getAuditLogs({
        pageSize: PAGE_SIZE,
        lastVisible: cursor,
        actionFilter: filter,
      });
      return result;
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await fetchPage(0, null, actionFilter);
      setLogs(result.logs);
      setHasMore(result.hasMore);
      setCursors([null, result.lastVisible]);
      setPage(0);
      setLoading(false);
    };
    load();
  }, [actionFilter, fetchPage]);

  useEffect(() => {
    auditService.getActionCounts().then(setActionCounts).catch(() => {});
  }, [logs.length]);

  const goToPage = async (newPage) => {
    if (newPage < 0) return;
    if (newPage >= cursors.length && !hasMore) return;

    if (newPage < cursors.length) {
      setPage(newPage);
      return;
    }

    const result = await fetchPage(newPage, cursors[cursors.length - 1], actionFilter);
    setLogs(result.logs);
    setHasMore(result.hasMore);
    setCursors(prev => [...prev, result.lastVisible]);
    setPage(newPage);
  };

  const handleRefresh = async () => {
    setLoading(true);
    const result = await fetchPage(0, null, actionFilter);
    setLogs(result.logs);
    setHasMore(result.hasMore);
    setCursors([null, result.lastVisible]);
    setPage(0);
    setLoading(false);
  };

  const handleActionFilter = (filter) => {
    setActionFilter(filter === actionFilter ? '' : filter);
    setCursors([null]);
    setPage(0);
  };

  const filteredLogs = searchTerm
    ? logs.filter(log =>
        log.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : logs;

  const sortedActionCounts = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1]);

  let lastDate = '';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600 text-sm mt-0.5">Every admin action is permanently recorded here — immutable and verifiable</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} loading={isFetching} size="sm">
          <RefreshCw className="w-4 h-4 mr-1.5 inline" /> Refresh
        </Button>
      </div>

      <Card className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by email, action, or details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => handleActionFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Actions</option>
            {Object.keys(actionCounts).sort().map(action => (
              <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quick Filters</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sortedActionCounts.slice(0, 12).map(([action, count]) => (
            <button
              key={action}
              onClick={() => handleActionFilter(action)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                actionFilter === action
                  ? (actionColors[action] || 'bg-gray-200 text-gray-800') + ' ring-2 ring-offset-1'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {action.replace(/_/g, ' ')} ({count})
            </button>
          ))}
          {sortedActionCounts.length > 12 && (
            <span className="px-2.5 py-1 text-xs text-gray-400">+{sortedActionCounts.length - 12} more types</span>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 sm:px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-gray-200 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-1/4 animate-pulse" />
                    <div className="h-3 bg-gray-100 rounded w-3/4 animate-pulse" />
                  </div>
                  <div className="h-3 bg-gray-200 rounded w-20 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-1">No Logs Found</h3>
            <p className="text-gray-500 text-sm">
              {logs.length === 0 ? 'No activity recorded yet. Actions appear here as admins use the system.' : 'No results match your filter.'}
            </p>
          </div>
        ) : (
          <div>
            {filteredLogs.map((log) => {
              const dateLabel = formatDate(log.timestamp);
              const showDate = dateLabel !== lastDate;
              lastDate = dateLabel;

              return (
                <div key={log.id}>
                  {showDate && (
                    <div className="px-4 sm:px-6 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-600">{dateLabel}</span>
                      <span className="text-xs text-gray-400 ml-auto">
                        {new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  )}
                  <div className="px-4 sm:px-6 py-3 hover:bg-gray-50/50 transition-colors border-b border-gray-50">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <span className="text-sm" title={log.action}>
                          {actionIcons[log.action] || '📌'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${actionColors[log.action] || 'bg-gray-100 text-gray-800'}`}>
                            {log.action?.replace(/_/g, ' ') || 'Action'}
                          </span>
                          {log.userEmail && (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                              <User className="w-3 h-3" />
                              {log.userEmail}
                            </span>
                          )}
                          {log.userEmail?.includes('admin') && (
                            <ShieldCheck className="w-3.5 h-3.5 text-purple-500" title="Admin" />
                          )}
                        </div>
                        <p className="text-sm text-gray-700">{log.details || '—'}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs font-mono text-gray-400 whitespace-nowrap">{formatTime(log.timestamp)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && logs.length > 0 && (
          <div className="px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Page {page + 1} &middot; {logs.length} entries
              {actionFilter && ` &middot; Filtered: ${actionFilter.replace(/_/g, ' ')}`}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page === 0}
                className="p-1.5 rounded-lg border hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: 5 }, (_, i) => page - 2 + i).filter(i => i >= 0).map(i => (
                <button
                  key={i}
                  onClick={() => i <= cursors.length + 1 ? goToPage(i) : null}
                  className={`w-8 h-8 text-xs rounded-lg font-medium transition-colors ${
                    i === page
                      ? 'bg-primary-600 text-white shadow'
                      : i < cursors.length
                        ? 'hover:bg-gray-100 text-gray-700'
                        : 'text-gray-300'
                  }`}
                >
                  {i + 1}
                </button>
              ))}

              {hasMore && page >= cursors.length - 3 && (
                <span className="px-1 text-gray-300">...</span>
              )}

              <button
                onClick={() => goToPage(page + 1)}
                disabled={!hasMore && page >= cursors.length - 1}
                className="p-1.5 rounded-lg border hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AuditLogs;
