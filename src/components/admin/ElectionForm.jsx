import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useElections } from '../../hooks/useElections';
import Button from '../Button';
import { electionSchema } from '../../utils/schemas';
import { getUserFriendlyError } from '../../utils/errors';
import toast from 'react-hot-toast';

export const ElectionForm = ({ election = null, onSuccess, onCancel }) => {
  const { createElection, updateElection } = useElections();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset, setError, clearErrors, formState: { errors } } = useForm({
    defaultValues: { title: '', description: '', academicSession: '', startDate: '', endDate: '' },
  });

  useEffect(() => {
    if (election) {
      reset({
        title: election.title || '',
        description: election.description || '',
        academicSession: election.academicSession || election.academic_session || '',
        startDate: election.startDate || election.start_date || '',
        endDate: election.endDate || election.end_date || '',
      });
    } else {
      reset({ title: '', description: '', academicSession: '', startDate: '', endDate: '' });
    }
  }, [election, reset]);

  const onSubmit = async (data) => {
    clearErrors();
    const result = electionSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        setError(issue.path[0], { message: issue.message });
      }
      return;
    }

    setLoading(true);
    try {
      if (election) {
        await updateElection(election.id, result.data);
      } else {
        await createElection(result.data);
      }
      onSuccess();
    } catch (error) {
      toast.error(getUserFriendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
        <input {...register('title')} placeholder="e.g., S.U.G. General Elections 2026" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
        {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea {...register('description')} placeholder="Brief overview..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" rows="3" />
        {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Academic Session <span className="text-red-500">*</span></label>
        <input {...register('academicSession')} placeholder="e.g., 2025/2026" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
        {errors.academicSession && <p className="text-red-500 text-xs mt-1">{errors.academicSession.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <input type="date" {...register('startDate')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
          <input type="date" {...register('endDate')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" loading={loading}>{election ? 'Save Changes' : 'Create Election'}</Button>
      </div>
    </form>
  );
};
