import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard, Vote, Users, UserPlus, BarChart3,
  FileText, LogOut, Menu, X, Shield,
} from 'lucide-react';

const AdminLayout = () => {
  const { logout, adminRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isSuperAdmin = adminRole === 'super_admin';

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Elections', href: '/admin/elections', icon: Vote },
    { name: 'Candidates', href: '/admin/candidates', icon: Users },
    { name: 'Students', href: '/admin/students', icon: UserPlus },
    { name: 'Vote', href: '/admin/vote', icon: Vote },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { name: 'Audit Logs', href: '/admin/audit-logs', icon: FileText },
    ...(isSuperAdmin ? [{ name: 'Manage Admins', href: '/admin/manage-admins', icon: Shield }] : []),
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'visible' : 'invisible'}`}>
        <div 
          className={`fixed inset-0 bg-gray-900/50 transition-opacity ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setSidebarOpen(false)}
        />
        <div className={`fixed inset-y-0 left-0 w-64 bg-white shadow-lg transform transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-bold text-primary-600">Admin Panel</h2>
            <button onClick={() => setSidebarOpen(false)} className="text-gray-500 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="p-3 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                    isActive ? 'bg-primary-50 text-primary-600 font-medium' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="w-4.5 h-4.5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
          <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-200">
            <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-red-600 hover:bg-red-50 transition-colors text-sm">
              <LogOut className="w-4.5 h-4.5" /> Logout
            </button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col grow bg-white border-r border-gray-200">
          <div className="p-5 border-b border-gray-200">
            <h2 className="text-lg font-bold text-primary-600">Election Admin</h2>
            <p className="text-xs text-gray-500 mt-0.5">Departmental Election System</p>
            {isSuperAdmin && (
              <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800">
                Super Admin
              </span>
            )}
          </div>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                    isActive ? 'bg-primary-50 text-primary-600 font-medium' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="w-4.5 h-4.5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
          <div className="p-3 border-t border-gray-200">
            <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-red-600 hover:bg-red-50 transition-colors text-sm">
              <LogOut className="w-4.5 h-4.5" /> Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200 lg:hidden">
          <div className="flex items-center justify-between p-3">
            <h1 className="text-lg font-bold text-primary-600">Election Admin</h1>
            <button onClick={() => setSidebarOpen(true)} className="text-gray-600 p-1">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
        <main className="p-3 sm:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
