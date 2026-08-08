import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import swal from '../utils/swal';
import { Users, UserCheck, UserMinus, Search, Trash2, Edit2, Plus, Upload, Inbox, ChevronLeft, ChevronRight, Trash, Ban, ShieldOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { auditService } from '../services/auditService';
import * as api from '../lib/api';
import Card from '../components/Card';
import Button from '../components/Button';
import Modal from '../components/Modal';
import AuthCodeModal from '../components/AuthCodeModal';
import { studentSchema } from '../utils/schemas';
import { getUserFriendlyError } from '../utils/errors';

const PAGE_SIZE = 25;

const fetchStudents = async () => {
  const snapshot = await getDocs(collection(db, 'students'));
  return snapshot.docs.map(doc => {
    const raw = doc.data();
    return {
      id: doc.id,
      fullName: raw.fullName || raw.full_name || '',
      matricNumber: raw.matricNumber || raw.matric_number || '',
      level: raw.level || '',
      email: raw.email || '',
      registeredStatus: raw.registeredStatus ?? raw.registered_status ?? false,
      votingStatus: raw.votingStatus ?? raw.voting_status ?? false,
      banned: raw.banned || false,
    };
  });
};

export const StudentManagement = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [bulkCsv, setBulkCsv] = useState('');
  const [page, setPage] = useState(0);

  const [showAuthCode, setShowAuthCode] = useState(false);
  const [authAction, setAuthAction] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [batchDeleteLevel, setBatchDeleteLevel] = useState('ND1');

  const { register, handleSubmit, reset, setError, clearErrors, formState: { errors } } = useForm({
    defaultValues: { fullName: '', matricNumber: '', level: 'ND1' },
  });

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: fetchStudents,
  });

  const addMutation = useMutation({
    mutationFn: async (data) => {
      await addDoc(collection(db, 'students'), {
        fullName: data.fullName, matricNumber: data.matricNumber, level: data.level,
        registeredStatus: false, votingStatus: false, createdAt: new Date().toISOString(),
      });
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      auditService.logAction({ action: 'STUDENT_PRELOADED', details: `Added student: ${data.fullName} (${data.matricNumber})` });
      swal.success('Success', 'Student preloaded');
    },
    onError: (error) => swal.error('Error', getUserFriendlyError(error)),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await updateDoc(doc(db, 'students', id), {
        fullName: data.fullName, matricNumber: data.matricNumber, level: data.level,
        updatedAt: new Date().toISOString(),
      });
    },
    onSuccess: (_, { id, data }) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      const student = students.find(s => s.id === id);
      auditService.logAction({
        action: 'STUDENT_UPDATED',
        details: `Edited student: ${student?.fullName || id} — new matric: ${data.matricNumber}, level: ${data.level}`,
      });
      swal.success('Success', 'Student updated');
    },
    onError: (error) => swal.error('Error', getUserFriendlyError(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteDoc(doc(db, 'students', id)),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      const student = students.find(s => s.id === id);
      auditService.logAction({
        action: 'STUDENT_DELETED',
        details: `Deleted student: ${student?.fullName || id} (${student?.matricNumber || 'N/A'})`,
      });
      swal.success('Success', 'Student removed');
    },
    onError: (error) => swal.error('Error', getUserFriendlyError(error)),
  });

  const batchDeleteMutation = useMutation({
    mutationFn: async (level) => {
      const toDelete = students.filter(s => s.level === level);
      let deleted = 0;
      for (const s of toDelete) {
        await deleteDoc(doc(db, 'students', s.id));
        deleted++;
      }
      return { level, count: deleted };
    },
    onSuccess: ({ level, count }) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      auditService.logAction({
        action: 'STUDENTS_BATCH_DELETED',
        details: `Batch deleted ${count} students from level ${level}`,
      });
      swal.success('Success', `Deleted ${count} students from ${level}`);
      setShowBatchDeleteModal(false);
    },
    onError: (error) => swal.error('Error', getUserFriendlyError(error)),
  });

  const banMutation = useMutation({
    mutationFn: (id) => api.banStudent(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      const student = students.find(s => s.id === id);
      swal.success('Banned', `${student?.fullName || 'Student'} has been banned.`);
    },
    onError: (error) => swal.error('Error', getUserFriendlyError(error)),
  });

  const unbanMutation = useMutation({
    mutationFn: (id) => api.unbanStudent(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      const student = students.find(s => s.id === id);
      swal.success('Unbanned', `${student?.fullName || 'Student'} has been unbanned.`);
    },
    onError: (error) => swal.error('Error', getUserFriendlyError(error)),
  });

  const onAddEditSubmit = async (data) => {
    clearErrors();
    const result = studentSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        setError(issue.path[0], { message: issue.message });
      }
      return;
    }

    setSubmitting(true);
    try {
      if (editingStudent) {
        const exists = students.some(s => s.matricNumber.toLowerCase() === result.data.matricNumber.toLowerCase() && s.id !== editingStudent.id);
        if (exists) { swal.error('Error', 'Matric number already exists'); return; }
        await updateMutation.mutateAsync({ id: editingStudent.id, data: result.data });
      } else {
        const exists = students.some(s => s.matricNumber.toLowerCase() === result.data.matricNumber.toLowerCase());
        if (exists) { swal.error('Error', 'Matric number already exists'); return; }
        await addMutation.mutateAsync(result.data);
      }
      setShowAddModal(false); setEditingStudent(null); reset({ fullName: '', matricNumber: '', level: 'ND1' });
    } catch (error) {
      swal.error('Error', getUserFriendlyError(error));
    } finally { setSubmitting(false); }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (!bulkCsv.trim()) return;
    setSubmitting(true);
    try {
      const lines = bulkCsv.split('\n');
      let success = 0, skipped = 0;
      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split(',').map(p => p.trim());
        if (parts.length < 3) continue;
        const [fullName, matricNumber, level] = parts;
        const exists = students.some(s => s.matricNumber.toLowerCase() === matricNumber.toLowerCase());
        if (exists) { skipped++; continue; }
        await addDoc(collection(db, 'students'), { fullName, matricNumber, level, registeredStatus: false, votingStatus: false, createdAt: new Date().toISOString() });
        success++;
      }
      auditService.logAction({ action: 'STUDENT_PRELOADED', details: `Bulk imported ${success} students (${skipped} skipped)` });
      swal.success('Success', `${success} preloaded! (${skipped} skipped)`);
      setShowBulkModal(false); setBulkCsv('');
      queryClient.invalidateQueries({ queryKey: ['students'] });
    } catch (error) { swal.error('Error', getUserFriendlyError(error)); }
    finally { setSubmitting(false); }
  };

  const requireCode = (action, callback) => {
    setAuthAction(action);
    setPendingAction(() => callback);
    setShowAuthCode(true);
  };

  const handleAuthorized = () => {
    if (pendingAction) pendingAction();
    setPendingAction(null);
  };

  const handleEditRequest = (student) => {
    requireCode('EDIT_STUDENT', () => {
      setEditingStudent(student);
      reset({ fullName: student.fullName || '', matricNumber: student.matricNumber || '', level: student.level || 'ND1' });
      setShowAddModal(true);
    }, student.id);
  };

  const handleDeleteRequest = (id, name) => {
    requireCode('DELETE_STUDENT', () => {
      if (window.confirm(`Remove ${name}?`)) {
        deleteMutation.mutateAsync(id);
      }
    }, id);
  };

  const handleBatchDeleteRequest = () => {
    const count = students.filter(s => s.level === batchDeleteLevel).length;
    if (count === 0) {
      swal.error('Error', `No students found in ${batchDeleteLevel}`);
      return;
    }
    requireCode('DELETE_STUDENT', () => {
      if (window.confirm(`Delete ALL ${count} students from ${batchDeleteLevel}? This cannot be undone.`)) {
        batchDeleteMutation.mutateAsync(batchDeleteLevel);
      }
    });
  };

  const handleBan = (id) => {
    if (window.confirm('Ban this student? They will not be able to log in.')) {
      banMutation.mutateAsync(id);
    }
  };

  const handleUnban = (id) => {
    requireCode('UNBAN_STUDENT', () => unbanMutation.mutateAsync(id));
  };

  const openAddModal = () => {
    setEditingStudent(null);
    reset({ fullName: '', matricNumber: '', level: 'ND1' });
    setShowAddModal(true);
  };

  const filtered = students.filter(s => {
    const matchesSearch = s.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || s.matricNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = levelFilter === '' || s.level === levelFilter;
    const matchesStatus = statusFilter === '' || (statusFilter === 'registered' && s.registeredStatus) || (statusFilter === 'preloaded' && !s.registeredStatus);
    return matchesSearch && matchesLevel && matchesStatus;
  });

  const total = students.length;
  const registered = students.filter(s => s.registeredStatus).length;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pagedStudents = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Student Management</h1>
          <p className="text-gray-600 text-sm mt-0.5">Manage eligible student voters</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulkModal(true)} size="sm"><Upload className="w-3.5 h-3.5 mr-1.5 inline" /> CSV Import</Button>
          <Button variant="outline" onClick={() => setShowBatchDeleteModal(true)} size="sm" className="text-red-600 border-red-200 hover:bg-red-50"><Trash className="w-3.5 h-3.5 mr-1.5 inline" /> Batch Delete</Button>
          <Button onClick={openAddModal} size="sm"><Plus className="w-3.5 h-3.5 mr-1.5 inline" /> Add</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="flex items-center gap-3 p-4"><div className="p-2.5 bg-primary-100 text-primary-600 rounded-lg"><Users className="w-5 h-5" /></div><div><p className="text-xs text-gray-500">Total</p><p className="text-xl font-bold">{total}</p></div></Card>
        <Card className="flex items-center gap-3 p-4"><div className="p-2.5 bg-green-100 text-green-600 rounded-lg"><UserCheck className="w-5 h-5" /></div><div><p className="text-xs text-gray-500">Registered</p><p className="text-xl font-bold">{registered}</p></div></Card>
        <Card className="flex items-center gap-3 p-4"><div className="p-2.5 bg-gray-100 text-gray-600 rounded-lg"><UserMinus className="w-5 h-5" /></div><div><p className="text-xs text-gray-500">Not Registered</p><p className="text-xl font-bold">{total - registered}</p></div></Card>
      </div>

      <Card className="p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" /><input type="text" placeholder="Search name or matric..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
        <div className="flex gap-2">
          <select value={levelFilter} onChange={(e) => { setLevelFilter(e.target.value); setPage(0); }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm"><option value="">All Levels</option><option value="ND1">ND1</option><option value="ND2">ND2</option><option value="HND1">HND1</option><option value="HND2">HND2</option></select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm"><option value="">All Status</option><option value="registered">Registered</option><option value="preloaded">Preloaded</option></select>
        </div>
      </Card>

      {isLoading ? (
        <div className="text-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto mb-3"></div></div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center"><Inbox className="w-12 h-12 text-gray-400 mx-auto mb-3" /><p className="text-gray-500 text-sm">No students found</p></Card>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Matric</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Voted</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Ban</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pagedStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><div className="font-medium text-gray-900 text-xs">{s.fullName}</div>{s.email && <div className="text-xs text-gray-400">{s.email}</div>}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 font-mono">{s.matricNumber}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{s.level}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${s.registeredStatus ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{s.registeredStatus ? 'REGISTERED' : 'PRELOADED'}</span></td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${s.votingStatus ? 'bg-blue-100 text-blue-800' : 'bg-yellow-50 text-yellow-800'}`}>{s.votingStatus ? 'YES' : 'NO'}</span></td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${s.banned ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-500'}`}>
                          {s.banned ? 'BANNED' : 'OK'}
                        </span>
                      </td>
                      <td className="px-4 py-3"><div className="flex gap-1">
                        <button onClick={() => handleEditRequest(s)} className="p-1.5 text-gray-600 hover:text-primary-600"><Edit2 className="w-3.5 h-3.5" /></button>
                        {s.banned ? (
                          <button onClick={() => handleUnban(s.id)} className="p-1.5 text-green-600 hover:text-green-800" title="Unban (requires code)"><ShieldOff className="w-3.5 h-3.5" /></button>
                        ) : (
                          <button onClick={() => handleBan(s.id)} className="p-1.5 text-orange-600 hover:text-orange-800" title="Ban student"><Ban className="w-3.5 h-3.5" /></button>
                        )}
                        <button onClick={() => handleDeleteRequest(s.id, s.fullName)} className="p-1.5 text-red-600 hover:text-red-800"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">Page {page + 1} of {totalPages} ({filtered.length} total)</p>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 border rounded-lg disabled:opacity-30 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pageNum = totalPages <= 5 ? i : page < 3 ? i : page > totalPages - 3 ? totalPages - 5 + i : page - 2 + i;
                  return <button key={pageNum} onClick={() => setPage(pageNum)} className={`w-8 h-8 text-xs rounded-lg ${page === pageNum ? 'bg-primary-600 text-white' : 'hover:bg-gray-100'}`}>{pageNum + 1}</button>;
                })}
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1.5 border rounded-lg disabled:opacity-30 hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setEditingStudent(null); }} title={editingStudent ? 'Edit Student' : 'Add Student'}>
        <form onSubmit={handleSubmit(onAddEditSubmit)} className="space-y-3">
          <div>
            <input {...register('fullName')} placeholder="Full Name" className="w-full px-3 py-2 border rounded-lg text-sm" />
            {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
          </div>
          <div>
            <input {...register('matricNumber')} placeholder="Matric Number" className="w-full px-3 py-2 border rounded-lg text-sm font-mono" />
            {errors.matricNumber && <p className="text-red-500 text-xs mt-1">{errors.matricNumber.message}</p>}
          </div>
          <div>
            <select {...register('level')} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="ND1">ND1</option><option value="ND2">ND2</option><option value="HND1">HND1</option><option value="HND2">HND2</option>
            </select>
            {errors.level && <p className="text-red-500 text-xs mt-1">{errors.level.message}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="secondary" onClick={() => { setShowAddModal(false); setEditingStudent(null); }}>Cancel</Button>
            <Button type="submit" loading={submitting}>{editingStudent ? 'Save' : 'Add'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showBulkModal} onClose={() => setShowBulkModal(false)} title="Bulk Import CSV" size="lg">
        <form onSubmit={handleBulkSubmit} className="space-y-3">
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 text-xs text-primary-800"><strong>Format:</strong> Full Name, Matric Number, Level<br /><code className="block bg-white p-2 rounded border mt-1 text-xs">John Doe, 2025/MTBM/ND/101, ND1</code></div>
          <textarea value={bulkCsv} onChange={(e) => setBulkCsv(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" rows="8" placeholder="Full Name, Matric Number, Level" required />
          <div className="flex justify-end gap-2 pt-3 border-t"><Button variant="secondary" onClick={() => setShowBulkModal(false)}>Cancel</Button><Button type="submit" loading={submitting}>Import</Button></div>
        </form>
      </Modal>

      <Modal isOpen={showBatchDeleteModal} onClose={() => setShowBatchDeleteModal(false)} title="Batch Delete Students by Level">
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
            <strong>Warning:</strong> This will permanently delete ALL students in the selected level. This action cannot be undone.
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Level to Delete</label>
            <select
              value={batchDeleteLevel}
              onChange={(e) => setBatchDeleteLevel(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="ND1">ND1</option>
              <option value="ND2">ND2</option>
              <option value="HND1">HND1</option>
              <option value="HND2">HND2</option>
            </select>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-700">
              Students in <strong>{batchDeleteLevel}</strong>:{' '}
              <strong className="text-red-600">{students.filter(s => s.level === batchDeleteLevel).length}</strong>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Registered: {students.filter(s => s.level === batchDeleteLevel && s.registeredStatus).length} | Not registered: {students.filter(s => s.level === batchDeleteLevel && !s.registeredStatus).length}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="secondary" onClick={() => setShowBatchDeleteModal(false)}>Cancel</Button>
            <Button
              onClick={handleBatchDeleteRequest}
              loading={batchDeleteMutation.isPending}
              disabled={students.filter(s => s.level === batchDeleteLevel).length === 0}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete All {batchDeleteLevel} Students
            </Button>
          </div>
        </div>
      </Modal>

      <AuthCodeModal
        isOpen={showAuthCode}
        onClose={() => { setShowAuthCode(false); setPendingAction(null); }}
        action={authAction}
        onAuthorized={handleAuthorized}
      />
    </div>
  );
};

export default StudentManagement;
