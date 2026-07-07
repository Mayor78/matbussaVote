// src/components/admin/ElectionValidation.jsx
import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

export const ElectionValidation = ({ canPublish, errors }) => {
  if (canPublish) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-green-800 font-medium">Ready to publish!</p>
          <p className="text-green-700 text-sm">This election meets all requirements.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-yellow-800 font-medium">Cannot publish election</p>
        <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
          {errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};