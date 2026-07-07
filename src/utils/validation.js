// src/utils/validation.js
export const validateElection = (electionData) => {
  const errors = {};

  if (!electionData.title?.trim()) {
    errors.title = 'Title is required';
  } else if (electionData.title.length < 3) {
    errors.title = 'Title must be at least 3 characters';
  }

  if (!electionData.academic_session?.trim()) {
    errors.academic_session = 'Academic session is required';
  }

  if (electionData.startDate && electionData.endDate) {
    if (new Date(electionData.startDate) >= new Date(electionData.endDate)) {
      errors.endDate = 'End date must be after start date';
    }
  }

  return errors;
};

export const validatePosition = (positionData) => {
  const errors = {};

  if (!positionData.title?.trim()) {
    errors.title = 'Position title is required';
  } else if (positionData.title.length < 2) {
    errors.title = 'Title must be at least 2 characters';
  }

  return errors;
};

export const validateCandidate = (candidateData) => {
  const errors = {};

  if (!candidateData.fullName?.trim()) {
    errors.fullName = 'Candidate name is required';
  }

  if (!candidateData.level) {
    errors.level = 'Level is required';
  }

  if (!candidateData.manifesto?.trim()) {
    errors.manifesto = 'Manifesto is required';
  } else if (candidateData.manifesto.length < 20) {
    errors.manifesto = 'Manifesto must be at least 20 characters';
  }

  return errors;
};

export const canPublishElection = (election, positions, candidatesByPosition) => {
  const errors = [];

  if (!positions || positions.length === 0) {
    errors.push('Election must have at least one position');
  }

  for (const position of positions) {
    const candidates = candidatesByPosition[position.id] || [];
    if (candidates.length === 0) {
      errors.push(`Position "${position.title}" must have at least one candidate`);
    }
  }

  return {
    canPublish: errors.length === 0,
    errors
  };
};