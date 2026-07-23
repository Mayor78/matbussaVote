import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where, updateDoc, setDoc } from 'firebase/firestore';
import swal from '../utils/swal';
import { Shield, ShieldAlert, UserPlus, Search, Trash2, ShieldCheck, Key, Copy, ArrowUp, ArrowDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auditService } from '../services/auditService';
import { authCodeService } from '../services/authCodeService';
import { adminAddSchema } from '../utils/schemas';
import { getUserFriendlyError } from '../utils/errors';
import Card from '../components/Card';
import Button from '../components/Button';
import Modal from '../components/Modal';

const fetchAdmins = async () => {
  const snapshot = await getDocs(collection(db, 'admin_users'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const CODE_ACTIONS = [
  { value: 'EDIT_STUDENT', label: 'Edit Student Details' },
  { value: 'DELETE_STUDENT', label: 'Delete Student Record' },
  { value: 'DELETE_CANDIDATE', label: 'Delete Candidate' },
  { value: 'CLOSE_ELECTION', label: 'Close Election' },
  { value: 'DELETE_ELECTION', label: 'Delete Election' },
];

const AdminManagement = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState('admins');
  const [codeAction, setCodeAction] = useState('EDIT_STUDENT');
  const [generatedCode, setGeneratedCode] = useState('');

  const { register, handleSubmit, reset, setError, clearErrors, formState: { errors } } = useForm({
    defaultValues: { email: '' },
  });

  const { data: admins = [], isLoading: adminsLoading } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: fetchAdmins,
  });

  const { data: authCodes = [], isLoading: codesLoading } = useQuery({
    queryKey: ['authCodes'],
    queryFn: authCodeService.getAllCodes,
    enabled: tab === 'codes',
  });

  const currentAdmin = admins.find(a => a.user_id === user?.uid || a.email === user?.email?.toLowerCase());
  const isSuperAdmin = currentAdmin?.role === 'super_admin';

  const addAdminMutation = useMutation({
    mutationFn: async (email) => {
      const lowerEmail = email.toLowerCase().trim();
      const exists = admins.some(a => a.email === lowerEmail);
      if (exists) throw new Error('This email is already an admin');

      const studentQuery = query(collection(db, 'students'), where('email', '==', lowerEmail));
      const studentSnap = await getDocs(studentQuery);

      const adminData = { email: lowerEmail, role: 'admin', createdAt: new Date().toISOString(), isActive: true };

      if (!studentSnap.empty) {
        const student = studentSnap.docs[0];
        adminData.userId = student.data().userId || '';
        await updateDoc(doc(db, 'students', student.id), { isAdmin: true, updatedAt: new Date().toISOString() });
      }

      const existingSnap = await getDocs(query(collection(db, 'admin_users'), where('email', '==', lowerEmail)));
      if (!existingSnap.empty) throw new Error('Admin already exists');

      await addDoc(collection(db, 'admin_users'), adminData);

      // If student has a userId, pre-create adminAccess marker for security rules
      if (!studentSnap.empty && adminData.userId) {
        await setDoc(doc(db, 'adminAccess', adminData.userId), {
          email: lowerEmail,
          role: 'admin',
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }

      await auditService.logAction({ action: 'ADMIN_ADDED', details: `Added admin: ${lowerEmail}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      swal.success('Success', 'Admin added');
      setShowAddModal(false); reset({ email: '' });
    },
    onError: (error) => swal.error('Error', getUserFriendlyError(error)),
  });

  const removeAdminMutation = useMutation({
    mutationFn: async (adminId) => {
      const admin = admins.find(a => a.id === adminId);
      if (admin?.role === 'super_admin') throw new Error('Cannot remove super admin');
      await deleteDoc(doc(db, 'admin_users', adminId));
      if (admin?.email) {
        const studentSnap = await getDocs(query(collection(db, 'students'), where('email', '==', admin.email)));
        if (!studentSnap.empty) {
          const student = studentSnap.docs[0];
          const studentData = student.data();
          await updateDoc(doc(db, 'students', student.id), { isAdmin: false, updatedAt: new Date().toISOString() });
          // Remove adminAccess marker if exists
          const uid = studentData.userId || studentData.user_id;
          if (uid) {
            try { await deleteDoc(doc(db, 'adminAccess', uid)); } catch { /* marker may not exist */ }
          }
        }
      }
      await auditService.logAction({ action: 'ADMIN_REMOVED', details: `Removed admin: ${admin?.email || adminId}` });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['adminUsers'] }); swal.success('Success', 'Admin removed'); },
    onError: (error) => swal.error('Error', getUserFriendlyError(error)),
  });

  const promoteMutation = useMutation({
    mutationFn: async (adminId) => {
      const admin = admins.find(a => a.id === adminId);
      if (!admin || admin.role === 'super_admin') throw new Error('Already super admin');
      await updateDoc(doc(db, 'admin_users', adminId), {
        role: 'super_admin',
        updatedAt: new Date().toISOString(),
      });
      if (admin.email) {
        const studentSnap = await getDocs(query(collection(db, 'students'), where('email', '==', admin.email)));
        if (!studentSnap.empty) {
          const student = studentSnap.docs[0];
          const studentData = student.data();
          const uid = studentData.userId || studentData.user_id;
          if (uid) {
            await setDoc(doc(db, 'adminAccess', uid), {
              email: admin.email.toLowerCase(),
              role: 'super_admin',
              updatedAt: new Date().toISOString(),
            }, { merge: true });
          }
        }
      }
      await auditService.logAction({ action: 'ADMIN_PROMOTED', details: `Promoted ${admin.email} to super admin` });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['adminUsers'] }); swal.success('Success', 'Promoted to super admin'); },
    onError: (error) => swal.error('Error', getUserFriendlyError(error)),
  });

  const demoteMutation = useMutation({
    mutationFn: async (adminId) => {
      const admin = admins.find(a => a.id === adminId);
      if (!admin || admin.role !== 'super_admin') throw new Error('Not a super admin');
      await updateDoc(doc(db, 'admin_users', adminId), {
        role: 'admin',
        updatedAt: new Date().toISOString(),
      });
      if (admin.email) {
        const studentSnap = await getDocs(query(collection(db, 'students'), where('email', '==', admin.email)));
        if (!studentSnap.empty) {
          const student = studentSnap.docs[0];
          const studentData = student.data();
          const uid = studentData.userId || studentData.user_id;
          if (uid) {
            await setDoc(doc(db, 'adminAccess', uid), {
              email: admin.email.toLowerCase(),
              role: 'admin',
              updatedAt: new Date().toISOString(),
            }, { merge: true });
          }
        }
      }
      await auditService.logAction({ action: 'ADMIN_DEMOTED', details: `Demoted ${admin.email} from super admin to admin` });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['adminUsers'] }); swal.success('Success', 'Demoted to regular admin'); },
    onError: (error) => swal.error('Error', getUserFriendlyError(error)),
  });

  const deleteCodeMutation = useMutation({
    mutationFn: authCodeService.deleteCode,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['authCodes'] }); swal.success('Success', 'Code deleted'); },
  });

  const handleGenerateCode = async () => {
    setSubmitting(true);
    try {
      const code = await authCodeService.generateCode(user?.email, codeAction);
      setGeneratedCode(code);
      queryClient.invalidateQueries({ queryKey: ['authCodes'] });
      await auditService.logAction({ action: 'AUTH_CODE_GENERATED', details: `Generated ${codeAction} code` });
    } catch { swal.error('Error', 'Failed to generate code'); }
    finally { setSubmitting(false); }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    swal.success('Success', 'Code copied!');
  };

  if (!isSuperAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Manage Admins</h1>
        <Card className="p-10 text-center">
          <ShieldAlert className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Access Denied</h2>
          <p className="text-gray-500 text-sm">Only super admins can manage admin accounts and auth codes.</p>
        </Card>
      </div>
    );
  }

  const filteredAdmins = admins.filter(a => a.email?.toLowerCase().includes(searchTerm.toLowerCase()));
  const unusedCodes = authCodes.filter(c => !c.used);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Manage Admins</h1>
          <p className="text-gray-600 text-sm mt-0.5">Add/remove admins and generate authorization codes</p>
        </div>
        {tab === 'admins' ? (
          <Button onClick={() => setShowAddModal(true)} size="sm"><UserPlus className="w-4 h-4 mr-1.5 inline" /> Add Admin</Button>
        ) : (
          <Button onClick={() => setShowCodeModal(true)} size="sm"><Key className="w-4 h-4 mr-1.5 inline" /> Generate Code</Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button onClick={() => setTab('admins')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${tab === 'admins' ? 'bg-white shadow text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}>
          Admins
        </button>
        <button onClick={() => setTab('codes')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${tab === 'codes' ? 'bg-white shadow text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}>
          Auth Codes {unusedCodes.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">{unusedCodes.length} active</span>}
        </button>
      </div>

      {/* Admins Tab */}
      {tab === 'admins' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <Card className="flex items-center gap-3 p-4"><div className="p-2.5 bg-purple-100 text-purple-600 rounded-lg"><ShieldCheck className="w-5 h-5" /></div><div><p className="text-xs text-gray-500">Super Admins</p><p className="text-xl font-bold">{admins.filter(a => a.role === 'super_admin').length}</p></div></Card>
            <Card className="flex items-center gap-3 p-4"><div className="p-2.5 bg-blue-100 text-blue-600 rounded-lg"><Shield className="w-5 h-5" /></div><div><p className="text-xs text-gray-500">Admins</p><p className="text-xl font-bold">{admins.filter(a => a.role === 'admin').length}</p></div></Card>
            <Card className="flex items-center gap-3 p-4"><div className="p-2.5 bg-green-100 text-green-600 rounded-lg"><ShieldCheck className="w-5 h-5" /></div><div><p className="text-xs text-gray-500">Active</p><p className="text-xl font-bold">{admins.filter(a => a.isActive !== false).length}</p></div></Card>
          </div>

          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" /><input type="text" placeholder="Search by email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm" /></div>

          {adminsLoading ? <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div></div> : (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[500px]"><thead className="bg-gray-50"><tr><th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Email</th><th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Role</th><th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Added</th><th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead><tbody className="divide-y divide-gray-200">{filteredAdmins.map((admin) => (<tr key={admin.id} className="hover:bg-gray-50"><td className="px-4 py-3"><div className="flex items-center gap-2">{admin.role === 'super_admin' ? <ShieldCheck className="w-4 h-4 text-purple-600" /> : <Shield className="w-4 h-4 text-blue-600" />}<span className="text-sm font-medium text-gray-900">{admin.email}</span></div></td><td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${admin.role === 'super_admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>{admin.role?.replace('_', ' ').toUpperCase()}</span></td><td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${admin.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{admin.isActive !== false ? 'ACTIVE' : 'INACTIVE'}</span></td><td className="px-4 py-3 text-xs text-gray-500">{admin.createdAt || admin.created_at ? new Date(admin.createdAt || admin.created_at).toLocaleDateString() : 'N/A'}</td><td className="px-4 py-3">
  {admin.role !== 'super_admin' ? (
    <div className="flex gap-1">
      <button onClick={() => promoteMutation.mutateAsync(admin.id)} className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg" title="Promote to Super Admin"><ArrowUp className="w-4 h-4" /></button>
      <button onClick={() => removeAdminMutation.mutateAsync(admin.id)} className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
    </div>
  ) : admin.email?.toLowerCase() !== user?.email?.toLowerCase() ? (
    <div className="flex gap-1">
      <button onClick={() => demoteMutation.mutateAsync(admin.id)} className="p-1.5 text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded-lg" title="Demote to Regular Admin"><ArrowDown className="w-4 h-4" /></button>
    </div>
  ) : null}
</td></tr>))}</tbody></table></div></div>
          )}
        </>
      )}

      {/* Auth Codes Tab */}
      {tab === 'codes' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Single-use codes for sensitive admin actions. Share one code per task.</p>
          </div>
          {codesLoading ? <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div></div> : authCodes.length === 0 ? (
            <Card className="p-8 text-center"><Key className="w-12 h-12 text-gray-400 mx-auto mb-3" /><p className="text-gray-500 text-sm">No codes generated yet.</p></Card>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[500px]"><thead className="bg-gray-50"><tr><th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Code</th><th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Action</th><th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Created</th><th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Used By</th><th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase"></th></tr></thead><tbody className="divide-y divide-gray-200">{authCodes.map((c) => (<tr key={c.id} className={`hover:bg-gray-50 ${c.used ? 'opacity-60' : ''}`}><td className="px-4 py-3"><span className="text-sm font-mono font-bold tracking-wider">{c.code}</span></td><td className="px-4 py-3"><span className="text-xs text-gray-700">{c.action?.replace(/_/g, ' ')}</span></td><td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${c.used ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{c.used ? 'USED' : 'ACTIVE'}</span></td><td className="px-4 py-3 text-xs text-gray-500">{new Date(c.createdAt).toLocaleString()}</td><td className="px-4 py-3 text-xs text-gray-500">{c.usedBy || '—'}</td><td className="px-4 py-3">{!c.used && <button onClick={() => deleteCodeMutation.mutateAsync(c.id)} className="text-red-500 hover:text-red-700 text-xs">Revoke</button>}</td></tr>))}</tbody></table></div></div>
          )}
        </>
      )}

      {/* Add Admin Modal */}
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); reset({ email: '' }); }} title="Add New Admin">
        <form onSubmit={handleSubmit((data) => {
          clearErrors();
          const result = adminAddSchema.safeParse(data);
          if (!result.success) {
            for (const issue of result.error.issues) {
              setError(issue.path[0], { message: issue.message });
            }
            return;
          }
          addAdminMutation.mutateAsync(result.data.email);
        })} className="space-y-4">
          <div>
            <input type="email" {...register('email')} placeholder="Enter email address" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <p className="text-xs text-gray-500">The person must have a registered account on the platform.</p>
          <div className="flex justify-end gap-2 pt-3 border-t"><Button variant="secondary" onClick={() => { setShowAddModal(false); reset({ email: '' }); }}>Cancel</Button><Button type="submit" loading={addAdminMutation.isPending}>Add Admin</Button></div>
        </form>
      </Modal>

      {/* Generate Code Modal */}
      <Modal isOpen={showCodeModal} onClose={() => { setShowCodeModal(false); setGeneratedCode(''); }} title="Generate Authorization Code">
        {generatedCode ? (
          <div className="space-y-4">
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5 text-center">
              <p className="text-sm text-green-700 mb-2">Share this code with the admin. It can only be used once.</p>
              <div className="bg-white rounded-lg p-4 border border-green-300">
                <span className="text-3xl font-mono font-bold tracking-[0.3em] text-gray-900">{generatedCode}</span>
              </div>
              <button onClick={copyCode} className="mt-3 flex items-center gap-1.5 mx-auto text-primary-600 hover:text-primary-700 text-sm font-medium">
                <Copy className="w-4 h-4" /> Copy Code
              </button>
            </div>
            <Button variant="secondary" onClick={() => { setShowCodeModal(false); setGeneratedCode(''); setCodeAction('EDIT_STUDENT'); }} className="w-full">Close</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <select value={codeAction} onChange={(e) => setCodeAction(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              {CODE_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
            <p className="text-xs text-gray-500">The code will authorize one {CODE_ACTIONS.find(a => a.value === codeAction)?.label.toLowerCase()} action.</p>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="secondary" onClick={() => setShowCodeModal(false)}>Cancel</Button>
              <Button onClick={handleGenerateCode} loading={submitting}>Generate</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminManagement;
