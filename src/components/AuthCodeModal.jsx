import { useState } from 'react';
import { authCodeService } from '../services/authCodeService';
import { Key, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from './Button';

const AuthCodeModal = ({ isOpen, onClose, action, target = '', onAuthorized }) => {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);

  if (!isOpen) return null;

  const actionLabels = {
    EDIT_STUDENT: 'Edit Student Details',
    DELETE_STUDENT: 'Delete Student Record',
    DELETE_CANDIDATE: 'Delete Candidate',
    CLOSE_ELECTION: 'Close Election',
    DELETE_ELECTION: 'Delete Election',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setChecking(true);
    try {
      const result = await authCodeService.validateAndConsume(code.trim().toUpperCase(), action);
      if (!result.valid) {
        toast.error(result.error);
        return;
      }
      toast.success('Code validated!');
      onAuthorized(result.data);
      setCode('');
      onClose();
    } catch {
      toast.error('Failed to validate code');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-gray-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-fade-in">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-100 rounded-full mb-3">
            <Key className="w-7 h-7 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Authorization Required</h2>
          <p className="text-gray-600 text-sm mt-1">
            {actionLabels[action] || action}
          </p>
          {target && <p className="text-gray-500 text-sm mt-0.5">{target}</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Enter Authorization Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. A3B7K9X2"
              maxLength={8}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-center text-xl font-mono tracking-widest uppercase focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              autoFocus
              required
            />
            <p className="text-xs text-gray-400 mt-1.5 text-center">
              Ask the super admin for a single-use code
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" loading={checking} className="flex-1">Verify & Continue</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthCodeModal;
