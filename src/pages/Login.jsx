import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, LogIn, UserCheck, Lock, Mail, ShieldAlert } from 'lucide-react';
import logo from '../assets/IMG_5038.jpeg'; // Adjust the path to your logo image

const Login = () => {
  const { login } = useAuth();
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const uiRecoveryRef = useRef(null);

  useEffect(() => {
    return () => {
      if (uiRecoveryRef.current) clearTimeout(uiRecoveryRef.current);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};
    if (!identifier.trim()) newErrors.identifier = 'Required';
    if (!password || password.length < 6) newErrors.password = 'Password must be at least 6 characters';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      await login(identifier.trim(), password, isAdminLogin);
      setLoginSuccess(true);
      if (uiRecoveryRef.current) clearTimeout(uiRecoveryRef.current);
      uiRecoveryRef.current = setTimeout(() => {
        setLoginSuccess(false);
        setLoading(false);
        uiRecoveryRef.current = null;
      }, 5000);
    } catch (err) {
      setLoading(false);
      if (err.message !== 'Rate limited' && err.message !== 'Student not found' && err.message !== 'Not registered') {
        console.error('Login error:', err);
      }
    }
  };

  const toggleMode = () => {
    setIsAdminLogin(!isAdminLogin);
    setIdentifier('');
    setPassword('');
    setErrors({});
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4 sm:p-6 lg:p-8 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-100 border border-slate-100 p-8 sm:p-10">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-50 rounded-2xl mb-4 p-2 shadow-inner border border-indigo-100/50">
              <img src={logo} alt="Logo" className="w-16 h-16 rounded-xl object-cover shadow-sm" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {isAdminLogin ? 'Admin Portal Login' : 'Student Voting Login'}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {isAdminLogin ? 'Access the administrator dashboard' : 'Vote securely for your department representatives'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                {isAdminLogin ? 'Admin Email Address' : 'Matric Number or Email'}
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  {isAdminLogin ? <Mail className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); setErrors(prev => ({ ...prev, identifier: undefined })); }}
                  placeholder={isAdminLogin ? 'admin@example.com' : 'e.g., 2025/MTBM/HND/317'}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl text-slate-900 text-sm font-medium focus:outline-none focus:border-indigo-600 focus:bg-white transition-all placeholder:text-slate-400 font-mono"
                  autoComplete="username"
                />
              </div>
              {errors.identifier && <p className="text-rose-500 text-xs mt-1.5 font-medium">{errors.identifier}</p>}
              {!isAdminLogin && (
                <p className="text-xs text-slate-400 mt-1.5 font-medium">
                  You can log in using either your matric number or registered email address.
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Password</label>
                <Link to="/forgot-password" className="text-xs font-bold text-indigo-600 hover:text-indigo-500 transition-colors">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: undefined })); }}
                  placeholder="Enter your password"
                  className="w-full pl-12 pr-12 py-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl text-slate-900 text-sm font-medium focus:outline-none focus:border-indigo-600 focus:bg-white transition-all placeholder:text-slate-400"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && <p className="text-rose-500 text-xs mt-1.5 font-medium">{errors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={loading || loginSuccess}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-base shadow-xl shadow-indigo-600/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {(loading || loginSuccess) ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{loginSuccess ? 'Redirecting...' : 'Logging in...'}</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Sign In</span>
                </>
              )}
            </button>

            {/* <div className="pt-2">
              <button
                type="button"
                onClick={toggleMode}
                className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2"
              >
                <ShieldAlert className="w-4 h-4 text-indigo-600" />
                <span>{isAdminLogin ? 'Switch to Student Login' : 'Switch to Admin Login'}</span>
              </button>
            </div> */}

            {!isAdminLogin && (
              <div className="pt-2 border-t border-slate-100 text-center">
                <p className="text-sm text-slate-500 mb-3">Don't have a voting account yet?</p>
                <Link
                  to="/register"
                  className="w-full py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm block text-center"
                >
                  <span>Register for elections</span>
                </Link>
              </div>
            )}
          </form>

        </div>
      </div>
    </div>
  );
};

export default Login;