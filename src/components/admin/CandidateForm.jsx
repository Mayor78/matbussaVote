import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useCandidates } from '../../hooks/useCandidates';
import { positionService } from '../../services/positionService';
import { electionService } from '../../services/electionService';
import * as api from '../../lib/api';
import Button from '../Button';
import { Image, X, Search, Download } from 'lucide-react';
import { isValidFileType, isValidFileSize } from '../../utils/sanitize';
import { candidateSchema } from '../../utils/schemas';
import { getUserFriendlyError } from '../../utils/errors';
import swal from '../../utils/swal';

export const CandidateForm = ({ electionId: propElectionId = '', positionId = '', candidate = null, onSuccess, onCancel }) => {
  const [selectedElectionId, setSelectedElectionId] = useState(propElectionId || '');
  const { createCandidate, updateCandidate } = useCandidates(selectedElectionId);
  const [positions, setPositions] = useState([]);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [elections, setElections] = useState([]);
  const [loadingElections, setLoadingElections] = useState(false);
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [importedPhotoUrl, setImportedPhotoUrl] = useState(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importPool, setImportPool] = useState([]);
  const [importSearch, setImportSearch] = useState('');
  const [loadingPool, setLoadingPool] = useState(false);

  const { register, handleSubmit, reset, setError, clearErrors, setValue, formState: { errors } } = useForm({
    defaultValues: { fullName: '', level: 'ND1', manifesto: '', positionId: '' },
  });

  useEffect(() => {
    if (!propElectionId) {
      const fetchElections = async () => {
        try { setLoadingElections(true); setElections(await electionService.getAllElections()); } catch {} finally { setLoadingElections(false); }
      };
      fetchElections();
    } else {
      setSelectedElectionId(propElectionId);
    }
  }, [propElectionId]);

  useEffect(() => {
    if (!selectedElectionId) { setPositions([]); setLoadingPositions(false); return; }
    const fetchPositions = async () => {
      try { setLoadingPositions(true); setPositions(await positionService.getPositionsByElection(selectedElectionId)); } catch {} finally { setLoadingPositions(false); }
    };
    fetchPositions();
  }, [selectedElectionId]);

  useEffect(() => {
    if (candidate) {
      reset({
        fullName: candidate.fullName || '',
        level: candidate.level || '',
        manifesto: candidate.manifesto || '',
        positionId: candidate.positionId || '',
      });
      if (candidate.photoUrl) setPhotoPreview(candidate.photoUrl);
    } else {
      reset({ fullName: '', level: 'ND1', manifesto: '', positionId: positionId || '' });
      setPhotoPreview(null);
      setImportedPhotoUrl(null);
    }
  }, [candidate, positionId, reset]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!isValidFileType(file)) { swal.error('Error', 'Only JPG, PNG, and WebP images are allowed'); return; }
    if (!isValidFileSize(file, 2)) { swal.error('Error', 'Image must be under 2MB'); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setImportedPhotoUrl(null);
  };

  const handleRemovePhoto = () => { setPhotoFile(null); setPhotoPreview(null); setImportedPhotoUrl(null); };

  const openImport = async () => {
    setImportOpen(true);
    if (importPool.length === 0) {
      setLoadingPool(true);
      try {
        const pool = await api.fetchCandidatePool();
        setImportPool(pool.filter(c => c.id !== candidate?.id));
      } catch { swal.error('Error', 'Failed to load existing candidates'); }
      setLoadingPool(false);
    }
  };

  const importCandidate = (c) => {
    setValue('fullName', c.fullName || '');
    setValue('level', c.level || 'ND1');
    setValue('manifesto', c.manifesto || '');
    if (c.photoUrl) {
      setPhotoPreview(c.photoUrl);
      setPhotoFile(null);
      setImportedPhotoUrl(c.photoUrl);
    }
    setImportOpen(false);
  };

  const filteredPool = importSearch.trim()
    ? importPool.filter(c =>
        c.fullName?.toLowerCase().includes(importSearch.toLowerCase()) ||
        c.electionTitle?.toLowerCase().includes(importSearch.toLowerCase()) ||
        c.positionTitle?.toLowerCase().includes(importSearch.toLowerCase()))
    : importPool;

  const onSubmit = async (data) => {
    clearErrors();
    const result = candidateSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) { setError(issue.path[0], { message: issue.message }); }
      return;
    }
    setLoading(true);
    try {
      if (candidate) {
        await updateCandidate(candidate.id, { ...result.data, photoUrl: result.data.photoUrl || importedPhotoUrl || null }, photoFile);
      } else {
        await createCandidate({ ...result.data, photoUrl: result.data.photoUrl || importedPhotoUrl || null }, photoFile);
      }
      onSuccess();
    } catch (error) { swal.error('Error', getUserFriendlyError(error)); } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {!propElectionId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Election <span className="text-red-500">*</span></label>
          {loadingElections ? <div className="text-sm text-gray-500 py-2">Loading elections...</div> : (
            <select value={selectedElectionId} onChange={(e) => { setSelectedElectionId(e.target.value); reset((prev) => ({ ...prev, positionId: '' })); }} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" required>
              <option value="">Select Election</option>
              {elections.map(el => (<option key={el.id} value={el.id}>{el.title}</option>))}
            </select>
          )}
        </div>
      )}

      {!candidate && (
        <button type="button" onClick={openImport} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-primary-300 rounded-xl text-primary-600 hover:bg-primary-50 text-sm font-semibold transition-colors">
          <Download className="w-4 h-4" /> Import from existing candidates
        </button>
      )}

      {importOpen && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={importSearch}
              onChange={(e) => setImportSearch(e.target.value)}
              placeholder="Search by name, election, or position..."
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              autoFocus
            />
            <button type="button" onClick={() => setImportOpen(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
          {loadingPool ? (
            <p className="text-sm text-gray-500 text-center py-4">Loading candidates...</p>
          ) : filteredPool.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No matching candidates found.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredPool.slice(0, 30).map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => importCandidate(c)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white hover:shadow-sm text-left transition-all border border-transparent hover:border-gray-200"
                >
                  {c.photoUrl ? (
                    <img src={c.photoUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Image className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.fullName}</p>
                    <p className="text-xs text-gray-500 truncate">{c.electionTitle} · {c.positionTitle}</p>
                  </div>
                  <span className="text-xs text-primary-500 font-semibold flex-shrink-0">Import</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
        <input {...register('fullName')} placeholder="e.g., John Doe" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
        {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Position <span className="text-red-500">*</span></label>
          {loadingPositions ? <div className="text-sm text-gray-500 py-2">Loading positions...</div> : (
            <select {...register('positionId')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
              <option value="">Select Position</option>
              {positions.map(p => (<option key={p.id} value={p.id}>{p.title}</option>))}
            </select>
          )}
          {errors.positionId && <p className="text-red-500 text-xs mt-1">{errors.positionId.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Level <span className="text-red-500">*</span></label>
          <select {...register('level')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
            <option value="ND1">ND1</option>
            <option value="ND2">ND2</option>
            <option value="HND1">HND1</option>
            <option value="HND2">HND2</option>
          </select>
          {errors.level && <p className="text-red-500 text-xs mt-1">{errors.level.message}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Candidate Photo</label>
        <div className="flex items-center gap-4">
          {photoPreview ? (
            <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200">
              <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              <button type="button" onClick={handleRemovePhoto} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 hover:bg-primary-50/50 transition">
              <Image className="w-8 h-8 text-gray-400" />
              <span className="text-xs text-gray-500 mt-1">Upload</span>
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
          )}
          <div className="text-xs text-gray-500">
            <p>Supported: JPG, PNG, WEBP.</p>
            <p>Max size: 2MB.</p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Manifesto / Bio</label>
        <textarea {...register('manifesto')} placeholder="Enter candidate manifesto, key goals, or short biography..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" rows="5" />
        {errors.manifesto && <p className="text-red-500 text-xs mt-1">{errors.manifesto.message}</p>}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" loading={loading}>{candidate ? 'Save Changes' : 'Add Candidate'}</Button>
      </div>
    </form>
  );
};
