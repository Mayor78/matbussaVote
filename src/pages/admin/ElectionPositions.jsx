// src/pages/admin/ElectionPositions.jsx
import React from 'react';
import { PositionsList } from '../../components/admin/PositionsList';
import Card from '../../components/Card';

export const ElectionPositions = ({ electionId, positions, onUpdate }) => {
  return (
    <Card className="p-6">
      <PositionsList 
        electionId={electionId} 
        positions={positions} 
        onUpdate={onUpdate} 
      />
    </Card>
  );
};
