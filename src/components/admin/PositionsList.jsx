// src/components/admin/PositionsList.jsx
import React, { useState } from 'react';
import { usePositions } from '../../hooks/usePositions';
import { PositionForm } from './PositionForm';
import Modal from '../Modal';
import Button from '../Button';
import { Plus, Edit2, Trash2, GripVertical } from 'lucide-react';

export const PositionsList = ({ electionId, positions, onUpdate }) => {
  const { deletePosition } = usePositions(electionId);
  const [showForm, setShowForm] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);

  const handleDelete = async (id, title) => {
    if (window.confirm(`Delete position "${title}"? This will also delete all candidates.`)) {
      await deletePosition(id);
      onUpdate();
    }
  };

  const handleEdit = (position) => {
    setEditingPosition(position);
    setShowForm(true);
  };

  const handleSuccess = () => {
    setShowForm(false);
    setEditingPosition(null);
    onUpdate();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Positions</h2>
        <Button onClick={() => setShowForm(true)} size="sm" icon={<Plus className="w-4 h-4" />}>
          Add Position
        </Button>
      </div>

      <div className="space-y-2">
        {positions.map((position, index) => (
          <div key={position.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{position.title}</h3>
              {position.description && (
                <p className="text-sm text-gray-500">{position.description}</p>
              )}
            </div>
            <div className="text-sm text-gray-500 mr-2">
              Order: {position.displayOrder || index + 1}
            </div>
            <button
              onClick={() => handleEdit(position)}
              className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(position.id, position.title)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingPosition(null);
        }}
        title={editingPosition ? 'Edit Position' : 'Add Position'}
      >
        <PositionForm
          electionId={electionId}
          position={editingPosition}
          onSuccess={handleSuccess}
          onCancel={() => {
            setShowForm(false);
            setEditingPosition(null);
          }}
        />
      </Modal>
    </div>
  );
};