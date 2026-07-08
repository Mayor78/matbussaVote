import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';
import logo from '../assets/IMG_5038.jpeg'; 
import { Eye, EyeOff, UserCheck, ArrowLeft, ArrowRight, Mail } from 'lucide-react';
import { studentRegistrationStep1Schema, studentRegistrationStep2Schema } from '../utils/schemas';
import { getUserFriendlyError } from '../utils/errors';

const StudentRegistration = () => {
  const { register: authRegister } = useAuth();
  const [step, setStep] = useState(1);
  const [studentData, setStudentData] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
        toast.error('Student record not found. Please check your details.');
        return;
      }

      const registered = foundStudent.registeredStatus ?? foundStudent.registered_status;
      if (registered) {
        toast.error('This matric number is already registered. Please login instead.');
        return;
      }

      setStudentData(foundStudent);
      setStep(2);
      toast.success('Student verified! Please complete your registration.');
    } catch (error) {
      toast.error(getUserFriendlyError(error));
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
      toast.error('Name verification failed. Please try again.');
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
      toast.error(getUserFriendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  const { register: reg1, formState: { errors: err1 } } = step1Form;
  const { register: reg2, formState: { errors: err2 } } = step2Form;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-primary-100 rounded-full mb-3">
              <img src={logo} alt="Logo" className='w-12 h-12 sm:w-18 sm:h-18 rounded-full'/>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Student Registration</h1>
            <p className="text-gray-600 text-sm mt-1">Register for departmental elections</p>
          </div>

          <div className="flex justify-between mb-6">
            <div className={`flex-1 text-center ${step >= 1 ? 'text-primary-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full mx-auto flex items-center justify-center font-semibold text-sm ${step >= 1 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'}`}>1</div>
              <p className="text-xs mt-1.5">Verify</p>
            </div>
            <div className={`flex-1 text-center ${step >= 2 ? 'text-primary-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full mx-auto flex items-center justify-center font-semibold text-sm ${step >= 2 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'}`}>2</div>
              <p className="text-xs mt-1.5">Register</p>
            </div>
          </div>

          {step === 1 && (
            <form onSubmit={(e) => { e.preventDefault(); validateStudent(); }} className="space-y-4">
              <div>
                <select {...reg1('level')} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
                  <option value="">Select your level</option>
                  <option value="ND1">ND1</option><option value="ND2">ND2</option><option value="HND1">HND1</option><option value="HND2">HND2</option>
                </select>
                {err1.level && <p className="text-red-500 text-xs mt-1">{err1.level.message}</p>}
              </div>
              <div>
                <input {...reg1('matricNumber')} placeholder="e.g., 2025/MTBM/HND/317" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                {err1.matricNumber && <p className="text-red-500 text-xs mt-1">{err1.matricNumber.message}</p>}
              </div>
              <button type="submit" disabled={loading} className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 text-sm disabled:opacity-50">
                {loading ? 'Verifying...' : 'Verify Student'}
              </button>
            </form>
          )}

          {step === 2 && studentData && (
            <form onSubmit={(e) => { e.preventDefault(); completeRegistration(); }} className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg border text-sm">
                <p><strong>Matric:</strong> {studentData.matricNumber || studentData.matric_number}</p>
                <p className="mt-1"><strong>Name:</strong> {(studentData.fullName || studentData.full_name || '').substring(0, Math.ceil((studentData.fullName || studentData.full_name || '').length / 2))}...</p>
              </div>
              <div>
                <input {...reg2('nameCompletion')} placeholder="Enter the hidden part of your name" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                {err2.nameCompletion && <p className="text-red-500 text-xs mt-1">{err2.nameCompletion.message}</p>}
              </div>
              <div>
                <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" /><input {...reg2('email')} placeholder="youremail@example.com" className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div>
                {err2.email && <p className="text-red-500 text-xs mt-1">{err2.email.message}</p>}
              </div>
              <div>
                <div className="relative"><input {...reg2('password')} type={showPassword ? 'text' : 'password'} placeholder="Password (min 6 chars)" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg pr-10 text-sm" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                {err2.password && <p className="text-red-500 text-xs mt-1">{err2.password.message}</p>}
              </div>
              <div>
                <input {...reg2('confirmPassword')} type={showPassword ? 'text' : 'password'} placeholder="Confirm password" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                {err2.confirmPassword && <p className="text-red-500 text-xs mt-1">{err2.confirmPassword.message}</p>}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-semibold hover:bg-gray-300 text-sm"><ArrowLeft className="w-4 h-4 inline mr-1" /> Back</button>
                <button type="submit" disabled={loading} className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg font-semibold hover:bg-primary-700 text-sm disabled:opacity-50">{loading ? 'Registering...' : 'Complete'}<ArrowRight className="w-4 h-4 inline ml-1" /></button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentRegistration;
