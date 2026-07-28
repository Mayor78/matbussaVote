import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, where, doc, updateDoc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import swal from '../utils/swal';
import { rateLimitService } from '../services/rateLimitService';
import { getUserFriendlyError } from '../utils/errors';
import { generateDeviceSignature } from '../utils/deviceFingerprint';
import { deviceBindingService } from '../services/deviceBindingService';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [adminRole, setAdminRole] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const freshLogin = useRef(false);
  const loginFallbackRef = useRef(null);
  const sessionTimer = useRef(null);
  const lastActivityRef = useRef(0);
  const navigate = useNavigate();

  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  const TIMER_CHECK_INTERVAL = 30000;

  useEffect(() => {
    if (!user) return;

    const checkAndSchedule = () => {
      if (sessionTimer.current) clearTimeout(sessionTimer.current);

      sessionTimer.current = setTimeout(async () => {
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= SESSION_TIMEOUT_MS) {
          swal.error('Session Expired', 'Your session has expired due to inactivity. Please log in again.');
          try { await auth.signOut(); } catch { /* ignore signout errors */ }
          setUser(null);
          setIsAdminUser(false);
          setAdminRole(null);
          setStudentData(null);
          navigate('/login');
        } else {
          checkAndSchedule();
        }
      }, TIMER_CHECK_INTERVAL);
    };

    lastActivityRef.current = Date.now();
    checkAndSchedule();

    const activityHandler = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    events.forEach(e => window.addEventListener(e, activityHandler, { passive: true }));

    return () => {
      if (sessionTimer.current) clearTimeout(sessionTimer.current);
      events.forEach(e => window.removeEventListener(e, activityHandler));
    };
  }, [user, navigate]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          if (loginFallbackRef.current) { clearTimeout(loginFallbackRef.current); loginFallbackRef.current = null; }
          setUser(null);
          setIsAdminUser(false);
          setAdminRole(null);
          setStudentData(null);
          setLoading(false);
          return;
        }

        setUser(firebaseUser);
        const userEmail = firebaseUser.email?.toLowerCase() || '';

        let foundAdmin = null;
        try {
          const adminQuery = query(
            collection(db, 'admin_users'),
            where('email', '==', userEmail)
          );
          const adminSnap = await getDocs(adminQuery);
          if (!adminSnap.empty) {
            const d = adminSnap.docs[0];
            foundAdmin = { id: d.id, ...d.data() };
          }
        } catch (e) {
          if (import.meta.env.DEV) console.error('[Auth] Failed to read admin_users:', e);
        }

        if (foundAdmin) {
          setIsAdminUser(true);
          setAdminRole(foundAdmin.role);
          setStudentData(null);

          setDoc(doc(db, 'adminAccess', firebaseUser.uid), {
            email: userEmail,
            role: foundAdmin.role,
            updatedAt: new Date().toISOString(),
          }, { merge: true }).catch(e => {
            if (import.meta.env.DEV) console.error('[Auth] Failed to sync admin access marker:', e);
          });
          setLoading(false);

          if (freshLogin.current) {
            if (loginFallbackRef.current) { clearTimeout(loginFallbackRef.current); loginFallbackRef.current = null; }
            freshLogin.current = false;
            setTimeout(() => navigate('/admin', { replace: true }), 0);
          }
          return;
        }

        setIsAdminUser(false);
        setAdminRole(null);

        try {
          const studentQuery = query(
            collection(db, 'students'),
            where('email', '==', userEmail)
          );
          const studentSnap = await getDocs(studentQuery);
          let foundStudent = null;

          if (!studentSnap.empty) {
            const data = studentSnap.docs[0];
            foundStudent = { id: data.id, ...data.data() };
          }

          if (foundStudent) {
            setStudentData({
              id: foundStudent.id,
              ...foundStudent,
              fullName: foundStudent.fullName || foundStudent.full_name || '',
              matricNumber: foundStudent.matricNumber || foundStudent.matric_number || '',
              registeredStatus: foundStudent.registeredStatus ?? foundStudent.registered_status ?? false,
              votingStatus: foundStudent.votingStatus ?? foundStudent.voting_status ?? false,
            });
          } else {
            setStudentData(null);
          }

          setLoading(false);

          if (freshLogin.current) {
            if (loginFallbackRef.current) { clearTimeout(loginFallbackRef.current); loginFallbackRef.current = null; }
            freshLogin.current = false;
            setTimeout(() => navigate('/student', { replace: true }), 0);
          }
        } catch {
          if (import.meta.env.DEV) console.error('[Auth] Failed to load student data');
          if (loginFallbackRef.current) { clearTimeout(loginFallbackRef.current); loginFallbackRef.current = null; }
          setLoading(false);
        }
      } catch (error) {
        if (import.meta.env.DEV) console.error('[Auth] Unexpected error:', error);
        if (loginFallbackRef.current) { clearTimeout(loginFallbackRef.current); loginFallbackRef.current = null; }
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const login = async (identifier, password, isAdminLogin = false) => {
    try {
      const rateResult = await rateLimitService.checkRateLimit(identifier);
      if (!rateResult.allowed) {
        const min = rateResult.remainingMinutes || 5;
        swal.error('Too Many Attempts', `Too many login attempts. Try again in ${min} minute${min > 1 ? 's' : ''}.`);
        throw new Error('Rate limited');
      }
    } catch (e) {
      if (e.message === 'Rate limited') throw e;
    }

    try {
      let email = identifier;

      if (!isAdminLogin && !identifier.includes('@')) {
        const allStudents = await getDocs(collection(db, 'students'));
        let foundStudent = null;
        allStudents.forEach(doc => {
          const data = doc.data();
          const matric = data.matricNumber || data.matric_number || '';
          if (matric.toLowerCase() === identifier.toLowerCase()) foundStudent = data;
        });

        if (!foundStudent && import.meta.env.DEV) {
          console.log('[Login] Matric lookup failed. Input:', identifier.toLowerCase());
          console.log('[Login] Available matrics:', allStudents.docs.map(d => (d.data().matricNumber || d.data().matric_number || '').toLowerCase()));
        }

        if (!foundStudent) {
          swal.error('Student Not Found', 'No student record matches this matric number. Please check and try again.');
          throw new Error('Student not found');
        }
        if (!foundStudent.email) {
          swal.error('Registration Required', 'Please complete your registration before logging in.');
          throw new Error('Not registered');
        }
        email = foundStudent.email;
      }

      freshLogin.current = true;

      await signInWithEmailAndPassword(auth, email, password);

      if (!isAdminLogin) {
        try {
          const deviceSig = await generateDeviceSignature();
          const check = await deviceBindingService.checkBinding(deviceSig, email);

          if (!check.allowed) {
            await auth.signOut();
            swal.error('Device Binding', check.reason);
            throw new Error('Device already bound');
          }

          await deviceBindingService.bindDevice(deviceSig, '', email);
        } catch (e) {
          if (e.message === 'Device already bound') throw e;
        }
      }

      try { await rateLimitService.resetRateLimit(identifier); } catch { /* best-effort */ }
      swal.success('Login Successful', 'Welcome back!');

      if (loginFallbackRef.current) { clearTimeout(loginFallbackRef.current); loginFallbackRef.current = null; }
      loginFallbackRef.current = setTimeout(() => {
        if (freshLogin.current) {
          freshLogin.current = false;
          navigate(isAdminLogin ? '/admin' : '/student', { replace: true });
        }
        loginFallbackRef.current = null;
      }, 4000);
    } catch (error) {
      if (error.message === 'Student not found' || error.message === 'Not registered' || error.message === 'Device already bound') {
        throw error;
      }

      const msg = getUserFriendlyError(error);
      swal.error('Login Failed', msg);

      try {
        await rateLimitService.recordFailedAttempt(identifier);
      } catch { /* rate limit tracking is best-effort */ }

      throw error;
    }
  };

  const logout = async () => {
    try {
      await auth.signOut();
      setUser(null);
      setIsAdminUser(false);
      setAdminRole(null);
      setStudentData(null);
      navigate('/login');
      swal.success('Logged Out', 'You have been logged out successfully.');
    } catch {
      swal.error('Error', 'Failed to log out. Please try again.');
    }
  };

  const register = async (email, password, studentInfo) => {
    try {
      freshLogin.current = true;
      await createUserWithEmailAndPassword(auth, email, password);

      const allStudents = await getDocs(collection(db, 'students'));
      let studentDocId = null;
      allStudents.forEach(doc => {
        const data = doc.data();
        const matric = data.matricNumber || data.matric_number || '';
        if (matric.toLowerCase() === studentInfo.matricNumber.toLowerCase()) studentDocId = doc.id;
      });

      if (studentDocId) {
        await updateDoc(doc(db, 'students', studentDocId), {
          email: email.toLowerCase(),
          registeredStatus: true,
          updatedAt: new Date().toISOString(),
        });
      }

      swal.success('Registration Successful', 'Your account has been created successfully!');
    } catch (error) {
      swal.error('Registration Failed', getUserFriendlyError(error));
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      user, loading, isAdminUser, adminRole, studentData,
      login, logout, register,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { AuthContext };
