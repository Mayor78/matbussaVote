import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { ArrowLeft, Mail, Send, CheckCircle } from 'lucide-react';
import swal from '../utils/swal';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const sendResetEmail = async () => {
    if (!email.trim()) {
      swal.error('Email Required', 'Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setSent(true);
      swal.success('Email Sent', 'Password reset email has been sent. Please check your inbox.');
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        const allStudents = await getDocs(collection(db, 'students'));
        let found = false;
        allStudents.forEach(d => {
          if ((d.data().email || '').toLowerCase() === email.trim().toLowerCase()) found = true;
        });

        if (found) {
          try {
            await sendPasswordResetEmail(auth, email.trim().toLowerCase());
            setSent(true);
            swal.success('Email Sent', 'Password reset email has been sent. Please check your inbox.');
            return;
          } catch {}
        }

        swal.error('Account Not Found', 'No account found with this email address.');
      } else if (error.code === 'auth/too-many-requests') {
        swal.error('Too Many Requests', 'Please wait a moment and try again.');
      } else if (error.code === 'auth/invalid-email') {
        swal.error('Invalid Email', 'Please enter a valid email address.');
      } else {
        swal.error('Error', 'Failed to send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendResetEmail();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-primary-100 rounded-full mb-4">
              {sent ? (
                <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-green-600" />
              ) : (
                <Mail className="w-8 h-8 sm:w-10 sm:h-10 text-primary-600" />
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {sent ? 'Check Your Email' : 'Forgot Password'}
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              {sent
                ? 'A password reset link has been sent to your email.'
                : 'Enter your email and we will send you a reset link.'}
            </p>
          </div>

          {sent ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-2" />
                <p className="text-green-800 font-medium text-sm">
                  Reset link sent to <strong>{email}</strong>
                </p>
                <p className="text-green-600 text-xs mt-1">
                  Check your inbox and spam folder. The link expires in 1 hour.
                </p>
              </div>

              <div className="text-center space-y-2">
                <p className="text-sm text-gray-500">Didn't receive the email?</p>
                <button
                  onClick={() => {
                    setSent(false);
                    sendResetEmail();
                  }}
                  disabled={loading}
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium disabled:opacity-50"
                >
                  Resend
                </button>
              </div>

              <Link
                to="/login"
                className="flex items-center justify-center gap-1.5 w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="youremail@example.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Reset Link
                  </>
                )}
              </button>

              <Link
                to="/login"
                className="flex items-center justify-center gap-1.5 w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
