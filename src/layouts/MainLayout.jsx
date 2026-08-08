import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LogOut, User, Vote, Home, Menu, X } from 'lucide-react';
import { useState } from 'react';
import HelpButton from '../components/HelpButton';
import logo from '../assets/IMG_5038.jpeg';

const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-primary-50 to-primary-100">
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="mx-auto px-3 sm:px-4">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <Link to="/student" className="flex items-center gap-2 flex-shrink-0">
        
              <img src={logo} alt="Logo" className='w-20 h-20 rounded-full'/>
              <span className="font-bold text-lg sm:text-xl text-gray-900">MatBussa</span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden sm:flex items-center gap-4">
              <Link to="/student" className="text-gray-600 hover:text-primary-600 transition p-1.5">
                <Home className="w-5 h-5" />
              </Link>
              <Link to="/student/vote" className="text-gray-600 hover:text-primary-600 transition p-1.5">
                <Vote className="w-5 h-5" />
              </Link>
              
              <div className="relative group">
                <button className="flex items-center gap-2 text-gray-700 hover:text-primary-600 text-sm">
                  <User className="w-5 h-5" />
                  <span>{user?.email?.split('@')[0]}</span>
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 border border-gray-100">
                  <button onClick={handleLogout} className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 text-sm">
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile menu button */}
            <button onClick={() => setMenuOpen(true)} className="sm:hidden p-2 text-gray-600">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <div className="fixed right-0 top-0 bottom-0 w-64 bg-white shadow-lg p-4">
            <div className="flex justify-between items-center mb-6">
              <span className="font-bold text-primary-600">Menu</span>
              <button onClick={() => setMenuOpen(false)} className="text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1">
              <Link to="/student" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 text-sm">
                <Home className="w-4 h-4" /> Dashboard
              </Link>
              <Link to="/student/vote" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 text-sm">
                <Vote className="w-4 h-4" /> Vote
              </Link>
              <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 text-sm">
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Outlet />
      </main>
      <HelpButton />
    </div>
  );
};

export default MainLayout;
