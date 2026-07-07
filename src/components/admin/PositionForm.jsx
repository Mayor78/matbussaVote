import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { usePositions } from '../../hooks/usePositions';
import Button from '../Button';
import { positionSchema } from '../../utils/schemas';
import { getUserFriendlyError } from '../../utils/errors';
import toast from 'react-hot-toast';

export const PositionForm = ({ electionId, position = null, onSuccess, onCancel }) => {
  const { createPosition, updatePosition } = usePositions(electionId);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset, setError, clearErrors, formState: { errors } } = useForm({
    defaultValues: { title: '', description: '', displayOrder: 1 },
  });

  useEffect(() => {
    if (position) {
      reset({
        title: position.title || '',
        description: position.description || '',
        displayOrder: position.displayOrder || 1,
      });
    } else {
      reset({ title: '', description: '', displayOrder: 1 });
    }
  }, [position, reset]);

  const onSubmit = async (data) => {
    clearErrors();
    const result = positionSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        setError(issue.path[0], { message: issue.message });
      }
      return;
    }

    setLoading(true);
    try {
      if (position) {
        await updatePosition(position.id, result.data);
      } else {
        await createPosition(result.data);
      }
      onSuccess();
    } catch (error) {
      toast.error(getUserFriendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Position Title <span className="text-red-500">*</span>
        </label>
        <input
          {...register('title')}
          placeholder="e.g., President, Treasurer"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          {...register('description')}
          placeholder="Describe the duties of this position..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          rows="3"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Display Order <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          {...register('displayOrder', { valueAsNumber: true })}
          min="1"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">
          Determines the order this position appears during voting.
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" loading={loading}>{position ? 'Save Changes' : 'Add Position'}</Button>
      </div>
    </form>
  );
};
