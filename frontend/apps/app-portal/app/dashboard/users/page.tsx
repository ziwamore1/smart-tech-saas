"use client";

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, roleApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { usePermissions } from '@/lib/permission-context';
import { ReadOnlyBanner } from '@/components/permissions/ReadOnlyBanner';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  roles: string[];
}

export default function UserManagementPage() {
  const { user, allRoles } = useAuth();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canManageUsers = can('users.manage');

  const isPrimary = user?.institutionType === 'PRIMARY_SCHOOL';

  const AVAILABLE_ROLES = isPrimary ? [
    { name: 'Director', color: 'bg-red-100 text-red-700', icon: '👑' },
    { name: 'Deputy Director', color: 'bg-rose-100 text-rose-700', icon: '🏅' },
    { name: 'Head Teacher', color: 'bg-purple-100 text-purple-700', icon: '🎓' },
    { name: 'Senior Teacher', color: 'bg-cyan-100 text-cyan-700', icon: '🌟' },
    { name: 'Lower Primary Senior Teacher', color: 'bg-orange-100 text-orange-700', icon: '📗' },
    { name: 'Upper Primary Senior Teacher', color: 'bg-blue-100 text-blue-700', icon: '📘' },
    { name: 'Class Teacher', color: 'bg-amber-100 text-amber-700', icon: '🏫' },
    { name: 'Deputy', color: 'bg-indigo-100 text-indigo-700', icon: '⭐' },
    { name: 'Accountant', color: 'bg-green-100 text-green-700', icon: '💰' },
    { name: 'Secretary', color: 'bg-pink-100 text-pink-700', icon: '📋' },
    { name: 'Teacher', color: 'bg-blue-100 text-blue-700', icon: '👨‍🏫' },
  ] : [
    { name: 'Director', color: 'bg-red-100 text-red-700', icon: '👑' },
    { name: 'Deputy Director', color: 'bg-rose-100 text-rose-700', icon: '🏅' },
    { name: 'Head Teacher', color: 'bg-purple-100 text-purple-700', icon: '🎓' },
    { name: 'Deputy', color: 'bg-indigo-100 text-indigo-700', icon: '⭐' },
    { name: 'Accountant', color: 'bg-green-100 text-green-700', icon: '💰' },
    { name: 'Secretary', color: 'bg-pink-100 text-pink-700', icon: '📋' },
    { name: 'Teacher', color: 'bg-blue-100 text-blue-700', icon: '👨‍🏫' },
    { name: 'Class Teacher', color: 'bg-amber-100 text-amber-700', icon: '🏫' },
    { name: 'HOD', color: 'bg-teal-100 text-teal-700', icon: '📚' },
  ];
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [filterRole, setFilterRole] = useState('');
const [searchTerm, setSearchTerm] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [changeRoleUser, setChangeRoleUser] = useState<{userId: string; currentRole: string} | null>(null);

const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['school-users'],
    queryFn: async () => {
      try {
        const res = await roleApi.getSchoolUsers();
        let data = res.data;
        if (data && !Array.isArray(data)) {
          data = data.data || data.result || [];
        }
        if (!Array.isArray(data)) {
          data = [];
        }
        return data;
      } catch (e) {
        return [];
      }
    },
  });

  const { data: allTeachers } = useQuery({
    queryKey: ['all-teachers'],
    queryFn: async () => {
      try {
        const res = await api.get('/teacher');
        let data = res.data?.data || res.data || [];
        if (!Array.isArray(data)) {
          data = data.data || data.result || [];
        }
        return Array.isArray(data) ? data : [];
      } catch (e) {
        console.error('Failed to fetch teachers:', e);
        return [];
      }
    },
  });

const mergedUsers = (() => {
    const usersMap = new Map<string, User>();
    
    (allTeachers || []).forEach((teacher: any) => {
      const teacherUser = teacher.user || {};
      const userId = teacherUser.id || teacher.userId;
      if (userId) {
        const userRoles = teacherUser.userRoles?.map((ur: any) => ur.role?.name).filter(Boolean) || [];
        if (!usersMap.has(userId)) {
          usersMap.set(userId, {
            id: userId,
            firstName: teacherUser.firstName || teacher.firstName || 'Unknown',
            lastName: teacherUser.lastName || teacher.lastName || '',
            email: teacherUser.email || teacher.email || '',
            isActive: teacherUser.isActive ?? true,
            roles: userRoles,
          });
        }
      }
    });
    
    (usersData || []).forEach((user: User) => {
      if (usersMap.has(user.id)) {
        const existing = usersMap.get(user.id)!;
        usersMap.set(user.id, { ...existing, roles: user.roles || existing.roles });
      } else {
        usersMap.set(user.id, user);
      }
    });
    
    return Array.from(usersMap.values());
  })();

  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, roleName }: { userId: string; roleName: string }) => {
      const response = await roleApi.assignRole(userId, roleName);
      return response;
    },
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Role assigned successfully!' });
      queryClient.invalidateQueries({ queryKey: ['school-users'] });
      queryClient.invalidateQueries({ queryKey: ['all-teachers'] });
      setActiveDropdown(null);
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (e: any) => {
      const errorMsg = e.response?.data?.message || e.message;
      if (errorMsg === 'Role already assigned') {
        setMessage({ type: 'warning', text: 'This role is already assigned to this user' });
      } else {
        setMessage({ type: 'error', text: errorMsg || 'Failed to assign role' });
      }
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, roleName }: { userId: string; roleName: string }) => {
      const response = await roleApi.removeRole(userId, roleName);
      return response;
    },
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Role removed successfully!' });
      queryClient.invalidateQueries({ queryKey: ['school-users'] });
      queryClient.invalidateQueries({ queryKey: ['all-teachers'] });
      setActiveDropdown(null);
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (e: any) => {
      setMessage({ type: 'error', text: e.response?.data?.message || 'Failed to remove role' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const handleAssignRole = (userId: string, roleName: string) => {
    assignRoleMutation.mutate({ userId, roleName });
  };

  const handleRemoveRole = (userId: string, roleName: string) => {
    if (confirm(`Remove ${roleName} role from this user?`)) {
      removeRoleMutation.mutate({ userId, roleName });
    }
};
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.role-dropdown')) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const filteredUsers = mergedUsers.filter((user: User) => {
    const matchesSearch = !searchTerm || 
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !filterRole || user.roles?.includes(filterRole);
    return matchesSearch && matchesRole;
  });

const getRoleStyle = (roleName: string) => {
    return AVAILABLE_ROLES.find(r => r.name === roleName) || { color: 'bg-gray-100 text-gray-700', icon: '👤' };
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = ['bg-gradient-to-br from-blue-400 to-blue-600', 'bg-gradient-to-br from-green-400 to-green-600', 'bg-gradient-to-br from-purple-400 to-purple-600', 'bg-gradient-to-br from-pink-400 to-pink-600', 'bg-gradient-to-br from-indigo-400 to-indigo-600', 'bg-gradient-to-br from-amber-400 to-amber-600'];
    const index = name?.charCodeAt(0) || 0;
    return colors[index % colors.length];
  };

const getAvailableRolesForUser = (user: User) => {
    return AVAILABLE_ROLES.filter(role => !user.roles?.includes(role.name));
  };

const handleAssignRoleInline = (userId: string, roleName: string) => {
    assignRoleMutation.mutate({ userId, roleName });
    setActiveDropdown(null);
  };

return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <ReadOnlyBanner managePermission="users.manage" />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Role Management</h1>
            <p className="text-gray-500">Assign and manage staff roles and permissions</p>
          </div>
          <a href="/dashboard/teachers" className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm font-medium">
            Go to Staff Register
          </a>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg shadow-md animate-pulse ${
            message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 
            message.type === 'warning' ? 'bg-yellow-50 border border-yellow-200 text-yellow-700' :
            'bg-red-50 border border-red-200 text-red-700'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-xl">{message.type === 'success' ? '' : message.type === 'warning' ? '' : ''}</span>
              <span>{message.text}</span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-4 border-b bg-gradient-to-r from-indigo-50 to-blue-50 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search staff..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-64"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></span>
              </div>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="py-2 px-4 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Roles</option>
                {AVAILABLE_ROLES.map(role => (
                  <option key={role.name} value={role.name}>{role.icon} {role.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">
                {mergedUsers.length} Staff Members
              </span>
            </div>
          </div>
          
          {usersLoading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading staff...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4"></div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Staff Found</h3>
              <p className="text-gray-500 mb-4">Add staff members to assign roles.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Staff Member</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Roles</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.map((user: User) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${getAvatarColor(user.firstName)}`}>
                            {getInitials(user.firstName, user.lastName)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{user.firstName} {user.lastName}</div>
                            <div className="text-sm text-gray-500">ID: {user.id.slice(0, 8)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          user.isActive 
                            ? 'bg-green-100 text-green-700 border border-green-200' 
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          {user.isActive ? ' Active' : ' Inactive'}
                        </span>
                      </td>
<td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2 items-center">
                          {user.roles && user.roles.length > 0 ? (
                            <>
                              {user.roles.map((role: string) => {
                                const style = getRoleStyle(role);
                                return (
                                  <div key={role} className="relative group inline-flex items-center gap-1">
                                    <span
                                      className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${style.color}`}
                                    >
                                      {style.icon} {role}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setChangeRoleUser({ userId: user.id, currentRole: role });
                                      }}
                                      className="w-5 h-5 bg-gray-800 text-white rounded-full text-xs flex items-center justify-center hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Change role"
                                      style={{ display: canManageUsers ? undefined : 'none' }}
                                    >
                                      &#9998;
                                    </button>
                                  </div>
                                );
                              })}
                            </>
                          ) : (
                            <span className="text-gray-400 text-sm italic">No roles assigned</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative role-dropdown">
                          {canManageUsers && getAvailableRolesForUser(user).length > 0 ? (
                            <>
                              <button
                                onClick={() => setActiveDropdown(activeDropdown === user.id ? null : user.id)}
                                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-lg hover:from-indigo-600 hover:to-blue-700 transition-all shadow-sm text-sm font-medium flex items-center gap-2"
                              >
                                <span>+</span> Add Role
                                <svg className={`w-4 h-4 transition-transform ${activeDropdown === user.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              {activeDropdown === user.id && (
                                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                  <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b">
                                    Select Role
                                  </div>
{getAvailableRolesForUser(user).map(role => (
                                    <button
                                      key={role.name}
                                      onClick={() => handleAssignRoleInline(user.id, role.name)}
                                      className="w-full px-4 py-3 text-left hover:bg-indigo-50 transition-colors flex items-center gap-3"
                                    >
                                      <span className="text-xl">{role.icon}</span>
                                      <span className="font-medium text-gray-700">{role.name}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm font-medium">
                              All roles assigned
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span></span> Role Overview
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {AVAILABLE_ROLES.map(role => {
              const roleCount = mergedUsers.filter((u: User) => u.roles?.includes(role.name)).length;
              const bgClass = role.color.split(' ')[0];
              const textClass = role.color.split(' ')[1];
              return (
                <div 
                  key={role.name} 
                  className={`${bgClass} rounded-2xl p-4 text-center border-2 hover:scale-105 transition-all cursor-pointer group relative overflow-hidden`}
                >
                  <div className={`absolute -top-2 -right-2 w-8 h-8 ${bgClass.replace('bg-', 'bg-')} rounded-full flex items-center justify-center shadow-md`}>
                    <span className="text-xs font-bold text-white">{roleCount}</span>
                  </div>
                  <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">{role.icon}</div>
                  <div className={`text-sm font-semibold ${textClass}`}>{role.name}</div>
                  <div className="text-xs opacity-60 mt-1">{roleCount} staff</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform transition-all">
            <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-blue-50 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Assign Role</h3>
                  <p className="text-sm text-gray-500 mt-1">Add a new role to this staff member</p>
                </div>
                <button
                  onClick={() => { setShowRoleModal(false); setSelectedUser(null); }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${getAvatarColor(selectedUser.firstName)}`}>
                  {getInitials(selectedUser.firstName, selectedUser.lastName)}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{selectedUser.firstName} {selectedUser.lastName}</div>
                  <div className="text-sm text-gray-500">{selectedUser.email}</div>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-3">Select a role to assign:</p>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {AVAILABLE_ROLES.map(role => {
                  const hasRole = selectedUser.roles?.includes(role.name);
                  return (
                    <button
                      key={role.name}
                      onClick={() => !hasRole && handleAssignRole(selectedUser.id, role.name)}
                      disabled={hasRole}
                      className={`w-full p-4 rounded-xl text-left flex items-center justify-between transition-all ${
                        hasRole
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-white border-2 border-gray-100 hover:border-indigo-300 hover:shadow-md text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{role.icon}</span>
                        <span className="font-medium">{role.name}</span>
                      </div>
                      {hasRole ? (
                        <span className="text-green-600 font-medium"> Assigned</span>
                      ) : (
                        <span className="text-indigo-600 text-sm">Click to assign</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end">
              <button
                onClick={() => { setShowRoleModal(false); setSelectedUser(null); }}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
</div>
        </div>
      )}

      {changeRoleUser && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform transition-all">
            <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-blue-50 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Change Role</h3>
                  <p className="text-sm text-gray-500 mt-1">Select a new role to assign</p>
                </div>
                <button
                  onClick={() => setChangeRoleUser(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">Current role: <span className="font-semibold">{changeRoleUser.currentRole}</span></p>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {AVAILABLE_ROLES.filter(r => r.name !== changeRoleUser.currentRole).map(role => (
                  <button
                    key={role.name}
                    onClick={() => {
                      removeRoleMutation.mutate({ userId: changeRoleUser.userId, roleName: changeRoleUser.currentRole });
                      assignRoleMutation.mutate({ userId: changeRoleUser.userId, roleName: role.name });
                      setChangeRoleUser(null);
                    }}
                    disabled={removeRoleMutation.isPending || assignRoleMutation.isPending}
                    className="w-full p-4 rounded-xl text-left flex items-center justify-between transition-all bg-white border-2 border-gray-100 hover:border-indigo-300 hover:shadow-md text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{role.icon}</span>
                      <span className="font-medium">{removeRoleMutation.isPending || assignRoleMutation.isPending ? (
                        <><svg className="animate-spin h-4 w-4 mr-2 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Assigning...</>
                      ) : role.name}</span>
                    </div>
                    <span className="text-indigo-600 text-sm">{removeRoleMutation.isPending || assignRoleMutation.isPending ? '' : 'Click to change'}</span>
                  </button>
                ))}
                {AVAILABLE_ROLES.filter(r => r.name !== changeRoleUser.currentRole).length === 0 && (
                  <p className="text-gray-500 text-center py-4">No other roles available</p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end">
              <button
                onClick={() => setChangeRoleUser(null)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
