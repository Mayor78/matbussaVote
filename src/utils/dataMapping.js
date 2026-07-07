export const normalizeStudent = (doc) => ({
  id: doc.id,
  ...doc.data(),
  fullName: doc.data().fullName || doc.data().full_name || '',
  matricNumber: doc.data().matricNumber || doc.data().matric_number || '',
  level: doc.data().level || '',
  email: doc.data().email || '',
  registeredStatus: doc.data().registeredStatus ?? doc.data().registered_status ?? false,
  votingStatus: doc.data().votingStatus ?? doc.data().voting_status ?? false,
  createdAt: doc.data().createdAt || doc.data().created_at || null,
  updatedAt: doc.data().updatedAt || doc.data().updated_at || null,
});

export const normalizeElection = (doc) => ({
  id: doc.id,
  ...doc.data(),
  title: doc.data().title || '',
  description: doc.data().description || '',
  academicSession: doc.data().academicSession || doc.data().academic_session || '',
  electionYear: doc.data().electionYear || doc.data().election_year || '',
  startDate: doc.data().startDate || doc.data().start_date || '',
  endDate: doc.data().endDate || doc.data().end_date || '',
  status: doc.data().status || 'draft',
  createdAt: doc.data().createdAt || doc.data().created_at || null,
  updatedAt: doc.data().updatedAt || doc.data().updated_at || null,
});

export const normalizePosition = (doc) => ({
  id: doc.id,
  ...doc.data(),
  electionId: doc.data().electionId || '',
  title: doc.data().title || '',
  description: doc.data().description || '',
  displayOrder: doc.data().displayOrder ?? doc.data().displayOrder ?? 0,
  createdAt: doc.data().createdAt || null,
  updatedAt: doc.data().updatedAt || null,
});

export const normalizeCandidate = (doc) => ({
  id: doc.id,
  ...doc.data(),
  electionId: doc.data().electionId || '',
  positionId: doc.data().positionId || '',
  fullName: doc.data().fullName || '',
  level: doc.data().level || '',
  manifesto: doc.data().manifesto || '',
  photoUrl: doc.data().photoUrl || null,
  cloudinaryPublicId: doc.data().cloudinaryPublicId || null,
  createdAt: doc.data().createdAt || null,
  updatedAt: doc.data().updatedAt || null,
});

export const normalizeVote = (doc) => ({
  id: doc.id,
  ...doc.data(),
  electionId: doc.data().electionId || '',
  positionId: doc.data().positionId || '',
  candidateId: doc.data().candidateId || '',
  studentId: doc.data().studentId || '',
  createdAt: doc.data().createdAt || null,
});

export const normalizeAuditLog = (doc) => ({
  id: doc.id,
  ...doc.data(),
  action: doc.data().action || '',
  userId: doc.data().userId || '',
  userEmail: doc.data().userEmail || '',
  details: doc.data().details || '',
  timestamp: doc.data().timestamp || null,
  ipAddress: doc.data().ipAddress || '',
});
