// src/pages/VoteConfirmation.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Home, FileText } from 'lucide-react';

const VoteConfirmation = () => {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Voting Complete!
        </h1>
        
        <p className="text-gray-600 mb-8">
          Thank you for participating in the departmental election. Your votes have been securely recorded and cannot be changed.
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 text-left">
          <h3 className="font-semibold text-blue-900 mb-2">What happens next?</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Results will be announced after voting closes</li>
            <li>• You will receive a confirmation email</li>
            <li>• Your votes are anonymous and secure</li>
          </ul>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/student"
            className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition"
          >
            <Home className="w-5 h-5 mr-2" />
            Go to Dashboard
          </Link>
          
          <Link
            to="/student"
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
          >
            <FileText className="w-5 h-5 mr-2" />
            View Confirmation
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VoteConfirmation;