import { auth } from './firebase';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function getToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

async function fetchPublic(path, options = {}) {
  const res = await fetch(`${API_BASE}/public${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

async function request(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

// ── Elections ──

export async function fetchElections(status) {
  if (typeof status !== 'string') status = undefined;
  const params = status ? `?status=${status}` : '';
  return request(`/elections${params}`);
}

export async function fetchElection(id) {
  return request(`/elections/${id}`);
}

export async function createElection(data) {
  return request('/elections', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateElection(id, data) {
  return request(`/elections/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteElection(id) {
  return request(`/elections/${id}`, { method: 'DELETE' });
}

export async function updateElectionStatus(id, status) {
  return request(`/elections/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

// ── Positions ──

export async function fetchPositions(electionId) {
  return request(`/positions?electionId=${electionId}`);
}

export async function createPosition(data) {
  return request('/positions', { method: 'POST', body: JSON.stringify(data) });
}

export async function updatePosition(id, data) {
  return request(`/positions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deletePosition(id) {
  return request(`/positions/${id}`, { method: 'DELETE' });
}

// ── Candidates ──

export async function fetchCandidates({ electionId, positionId } = {}) {
  const params = new URLSearchParams();
  if (electionId) params.set('electionId', electionId);
  if (positionId) params.set('positionId', positionId);
  return request(`/candidates?${params.toString()}`);
}

export async function createCandidate(data) {
  return request('/candidates', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCandidate(id, data) {
  return request(`/candidates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteCandidate(id) {
  return request(`/candidates/${id}`, { method: 'DELETE' });
}

export async function fetchCandidatePool() {
  return request('/candidates/pool');
}

// ── Votes ──

export async function castVote(data) {
  return request('/votes', { method: 'POST', body: JSON.stringify(data) });
}

export async function checkVoteStatus(studentId, electionId) {
  return request(`/votes/check?studentId=${studentId}&electionId=${electionId}`);
}

// ── Students ──

export async function fetchStudents() {
  return request('/students');
}

export async function createStudent(data) {
  return request('/students', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateStudent(id, data) {
  return request(`/students/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteStudent(id) {
  return request(`/students/${id}`, { method: 'DELETE' });
}

export async function banStudent(id) {
  return request(`/students/${id}/ban`, { method: 'PATCH' });
}

export async function unbanStudent(id) {
  return request(`/students/${id}/unban`, { method: 'PATCH' });
}

// ── Device Binding ──

export async function checkDevice(deviceSignature, studentEmail) {
  return request('/device/check', { method: 'POST', body: JSON.stringify({ deviceSignature, studentEmail }) });
}

export async function bindDevice(deviceSignature, studentId, studentEmail) {
  return request('/device/bind', { method: 'POST', body: JSON.stringify({ deviceSignature, studentId, studentEmail }) });
}

// ── Stats ──

export async function fetchStats(electionId) {
  const params = electionId ? `?electionId=${electionId}` : '';
  return request(`/stats${params}`);
}

// ── Bundles ──

export async function fetchBundle(electionId) {
  return request(`/bundle/${electionId}`);
}

export async function buildBundle(electionId) {
  return request(`/bundle/${electionId}/build`, { method: 'POST' });
}

// ── Public endpoints (no auth required, for login flow) ──

export async function lookupStudentByMatric(matricNumber) {
  return fetchPublic('/students/lookup-by-matric', {
    method: 'POST',
    body: JSON.stringify({ matricNumber }),
  });
}

export async function lookupStudentByEmail(email) {
  return fetchPublic(`/students/lookup?email=${encodeURIComponent(email)}`);
}

export async function lookupAdminByEmail(email) {
  return fetchPublic(`/admin/lookup?email=${encodeURIComponent(email)}`);
}
