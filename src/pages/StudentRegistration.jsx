import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import swal from '../utils/swal';
import logo from '../assets/IMG_5038.jpeg'; 
import { Eye, EyeOff, UserCheck, ArrowLeft, ArrowRight, Mail, Lock, User, GraduationCap, LogIn } from 'lucide-react';
import { studentRegistrationStep1Schema, studentRegistrationStep2Schema } from '../utils/schemas';
import { getUserFriendlyError } from '../utils/errors';

const StudentRegistration = () => {
  const { register: authRegister } = useAuth();
  const [step, setStep] = useState(1);
  const [studentData, setStudentData] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const step1Form = useForm({
    defaultValues: { level: '', matricNumber: '' },
  });

  const step2Form = useForm({
    defaultValues: { email: '', nameCompletion: '', password: '', confirmPassword: '' },
  });

  const validateStudent = async () => {
    const values = step1Form.getValues();
    const result = studentRegistrationStep1Schema.safeParse(values);
    if (!result.success) {
      for (const issue of result.error.issues) {
        step1Form.setError(issue.path[0], { message: issue.message });
      }
      return;
    }

    const { level, matricNumber } = result.data;
    setLoading(true);
    try {
      const allStudents = await getDocs(collection(db, 'students'));
      let foundStudent = null;

      allStudents.forEach(doc => {
        const data = doc.data();
        const matric = data.matricNumber || data.matric_number || '';
        const lvl = data.level || '';
        if (matric.toLowerCase() === matricNumber.toLowerCase() && lvl === level) {
          foundStudent = { id: doc.id, ...data };
        }
      });

      if (!foundStudent) {
        swal.error('Student Not Found', 'Student record not found. Please check your details.');
        return;
      }

      const registered = foundStudent.registeredStatus ?? foundStudent.registered_status;
      if (registered) {
        swal.error('Already Registered', 'This matric number is already registered. Please login instead.');
        return;
      }

      setStudentData(foundStudent);
      setStep(2);
      swal.success('Student Verified', 'Student verified! Please complete your registration.');
    } catch (error) {
      swal.error('Error', getUserFriendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  const completeRegistration = async () => {
    const values = step2Form.getValues();
    const result = studentRegistrationStep2Schema.safeParse(values);
    if (!result.success) {
      for (const issue of result.error.issues) {
        step2Form.setError(issue.path[0], { message: issue.message });
      }
      return;
    }

    const formData = result.data;

    const fullName = studentData.fullName || studentData.full_name || '';
    const nameParts = fullName.split(' ');
    const lastName = nameParts[nameParts.length - 1]?.toLowerCase() || '';
    const enteredName = formData.nameCompletion.toLowerCase();

    if (!enteredName.includes(lastName) && !fullName.toLowerCase().includes(enteredName)) {
      swal.error('Verification Failed', 'Name verification failed. Please try again.');
      return;
    }

    setLoading(true);
    try {
      await authRegister(formData.email, formData.password, {
        matricNumber: studentData.matricNumber || studentData.matric_number,
        fullName: fullName,
        level: studentData.level
      });
    } catch (error) {
      swal.error('Error', getUserFriendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  const { register: reg1, formState: { errors: err1 } } = step1Form;
  const { register: reg2, formState: { errors: err2 } } = step2Form;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4 sm:p-6 lg:p-8 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-100 border border-slate-100 p-8 sm:p-10">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-50 rounded-2xl mb-4 p-2 shadow-inner border border-indigo-100/50">
              <img src={logo} alt="Logo" className="w-16 h-16 rounded-xl object-cover shadow-sm" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Student Registration</h1>
            <p className="text-slate-500 text-sm mt-1">Register securely for departmental elections</p>
          </div>

          {/* Steps Indicator */}
          <div className="flex items-center justify-between mb-8 px-2">
            <div className={`flex items-center gap-3 ${step >= 1 ? 'text-indigo-600' : 'text-slate-300'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm transition-all ${step >= 1 ? 'bg-indigo-600 text-white shadow-indigo-600/20' : 'bg-slate-100 text-slate-400'}`}>
                1
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Step 1</p>
                <p className="text-sm font-extrabold text-slate-900">Verify Record</p>
              </div>
            </div>
            <div className="flex-1 h-0.5 bg-slate-100 mx-4">
              <div className={`h-full bg-indigo-600 transition-all duration-500 ${step >= 2 ? 'w-full' : 'w-0'}`}></div>
            </div>
            <div className={`flex items-center gap-3 ${step >= 2 ? 'text-indigo-600' : 'text-slate-300'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm transition-all ${step >= 2 ? 'bg-indigo-600 text-white shadow-indigo-600/20' : 'bg-slate-100 text-slate-400'}`}>
                2
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Step 2</p>
                <p className="text-sm font-extrabold text-slate-900">Account Setup</p>
              </div>
            </div>
          </div>

          {/* Step 1 Form */}
          {step === 1 && (
            <form onSubmit={(e) => { e.preventDefault(); validateStudent(); }} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Select Level</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <select 
                    {...reg1('level')} 
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl text-slate-900 text-sm font-medium focus:outline-none focus:border-indigo-600 focus:bg-white transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Select your level</option>
                    <option value="ND1">ND1</option>
                    <option value="ND2">ND2</option>
                    <option value="HND1">HND1</option>
                    <option value="HND2">HND2</option>
                  </select>
                </div>
                {err1.level && <p className="text-rose-500 text-xs mt-1.5 font-medium">{err1.level.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Matriculation Number</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <input 
                    {...reg1('matricNumber')} 
                    placeholder="e.g., 2025/MTBM/HND/317" 
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl text-slate-900 text-sm font-medium focus:outline-none focus:border-indigo-600 focus:bg-white transition-all placeholder:text-slate-400 font-mono" 
                  />
                </div>
                {err1.matricNumber && <p className="text-rose-500 text-xs mt-1.5 font-medium">{err1.matricNumber.message}</p>}
              </div>

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-base shadow-xl shadow-indigo-600/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Verifying student...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Student</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Step 2 Form */}
          {step === 2 && studentData && (
            <form onSubmit={(e) => { e.preventDefault(); completeRegistration(); }} className="space-y-4">
              <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100 text-sm space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Verified Profile</p>
                <p className="text-slate-900 font-bold"><span className="text-slate-500 font-normal">Matric:</span> {studentData.matricNumber || studentData.matric_number}</p>
                <p className="text-slate-900 font-bold"><span className="text-slate-500 font-normal">Name:</span> {(studentData.fullName || studentData.full_name || '').substring(0, Math.ceil((studentData.fullName || studentData.full_name || '').length / 2))}...</p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Name Verification</label>
                <input 
                  {...reg2('nameCompletion')} 
                  placeholder="Enter the hidden part of your name" 
                  className="w-full px-4 py-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl text-slate-900 text-sm font-medium focus:outline-none focus:border-indigo-600 focus:bg-white transition-all placeholder:text-slate-400" 
                />
                {err2.nameCompletion && <p className="text-rose-500 text-xs mt-1 font-medium">{err2.nameCompletion.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
                  <input 
                    {...reg2('email')} 
                    placeholder="youremail@example.com" 
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl text-slate-900 text-sm font-medium focus:outline-none focus:border-indigo-600 focus:bg-white transition-all placeholder:text-slate-400" 
                  />
                </div>
                {err2.email && <p className="text-rose-500 text-xs mt-1 font-medium">{err2.email.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
                  <input 
                    {...reg2('password')} 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="Password (min 6 chars)" 
                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl text-slate-900 text-sm font-medium focus:outline-none focus:border-indigo-600 focus:bg-white transition-all placeholder:text-slate-400" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {err2.password && <p className="text-rose-500 text-xs mt-1 font-medium">{err2.password.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
                  <input 
                    {...reg2('confirmPassword')} 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="Confirm your password" 
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl text-slate-900 text-sm font-medium focus:outline-none focus:border-indigo-600 focus:bg-white transition-all placeholder:text-slate-400" 
                  />
                </div>
                {err2.confirmPassword && <p className="text-rose-500 text-xs mt-1 font-medium">{err2.confirmPassword.message}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setStep(1)} 
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {loading ? 'Registering...' : 'Complete Registration'} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* Already have an account? Login button */}
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500 mb-3">Already have an account?</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <LogIn className="w-4 h-4 text-indigo-600" />
              <span>Sign in to your account</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default StudentRegistration;