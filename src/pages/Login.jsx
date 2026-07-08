import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-26 h-26 sm:w-28 sm:h-28 bg-primary-100 rounded-full mb-4">
              {/* <LogIn className="w-8 h-8 sm:w-10 sm:h-10 text-primary-600" /> */}
              <img src={logo} alt="Logo" />
            </div> 
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {isAdminLogin ? 'Admin Login' : 'Student Login'}
            </h1>
            <p className="text-gray-600 text-sm sm:text-base mt-1">
              {isAdminLogin ? 'Access admin dashboard' : 'Vote for your department representatives'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {isAdminLogin ? 'Email Address' : 'Matric Number or Email'}
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => { setIdentifier(e.target.value); setErrors(prev => ({ ...prev, identifier: undefined })); }}
                placeholder={isAdminLogin ? 'admin@example.com' : 'e.g., 2025/MTBM/HND/317'}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                autoComplete="username"
              />
              {errors.identifier && <p className="text-red-500 text-xs mt-1">{errors.identifier}</p>}
              {!isAdminLogin && (
                <p className="text-xs text-gray-500 mt-1">
                  Login with matric number or email address
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: undefined })); }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg pr-10 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={loading || loginSuccess}
              className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm"
            >
              {(loading || loginSuccess) ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {loginSuccess ? 'Redirecting...' : 'Logging in...'}
                </span>
              ) : (
                'Login'
              )}
            </button>

            <div className="text-center">
              <Link to="/forgot-password" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                Forgot Password?
              </Link>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={toggleMode}
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                {isAdminLogin ? 'Switch to Student Login' : 'Switch to Admin Login'}
              </button>
            </div>

            {!isAdminLogin && (
              <p className="text-center text-sm text-gray-600">
                Not registered?{' '}
                <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
                  Register here
                </Link>
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
