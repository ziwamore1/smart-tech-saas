"use client";

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformRoleApi, api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface PlatformRoleUser {
  id: string;
  userId: string;
  role: string;
  startDate: string;
  isActive: boolean;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    schoolId?: string;
  };
}

interface UserSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  schoolId?: string;
  schoolName?: string;
}

const PLATFORM_ROLE_STYLES: Record<string, { color: string; icon: string; desc: string }> = {
  'SuperAdmin': { color: 'bg-red-100 text-red-700 border-red-200', icon: '🔧', desc: 'Full platform access, manages all schools and settings' },
  'Director': { color: 'bg-purple-100 text-purple-700 border-purple-200', icon: '👑', desc: 'School director with full school management access' },
  'Head Teacher': { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: '🎓', desc: 'School head teacher with academic management access' },
  'Teacher': { color: 'bg-green-100 text-green-700 border-green-200', icon: '👨‍🏫', desc: 'Teaching staff with classroom access' },
  'Student': { color: 'bg-sky-100 text-sky-700 border-sky-200', icon: '🎓', desc: 'Student with learning portal access' },
  'Parent': { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: '👨‍👩‍👦', desc: 'Parent/guardian with child monitoring access' },
};

export default function PlatformRolesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedRole, setSelectedRole] = useState<string>('SuperAdmin');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSearchTerm, setAssignSearchTerm] = useState('');
  const [assignSearchResults, setAssignSearchResults] = useState<UserSearchResult[]>([]);
  const [assignSearching, setAssignSearching] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const { data: allRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ['platform-roles'],
    queryFn: async () => {
      try {
        const res = await platformRoleApi.getAll();
        let data = res.data?.data || res.data || [];
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
  });

  const { data: roleUsers, isLoading: usersLoading } = useQuery({
    queryKey: ['platform-role-users', selectedRole],
    queryFn: async () => {
      try {
        const res = await platformRoleApi.getUsersByRole(selectedRole);
        let data = res.data?.data || res.data || [];
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
    enabled: !!selectedRole,
  });

  const assignMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => platformRoleApi.assign(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-role-users'] });
      queryClient.invalidateQueries({ queryKey: ['platform-roles'] });
      setShowAssignModal(false);
      setAssignSearchTerm('');
      setAssignSearchResults([]);
      setMessage({ type: 'success', text: 'Platform role assigned successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (e: any) => {
      setMessage({ type: 'error', text: e.response?.data?.message || 'Failed to assign role' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => platformRoleApi.remove(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-role-users'] });
      queryClient.invalidateQueries({ queryKey: ['platform-roles'] });
      setMessage({ type: 'success', text: 'Platform role removed!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (e: any) => {
      setMessage({ type: 'error', text: e.response?.data?.message || 'Failed to remove role' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  useEffect(() => {
    if (assignSearchTerm.length < 2) {
      setAssignSearchResults([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setAssignSearching(true);
      try {
        const res = await api.get('/teacher', { params: { search: assignSearchTerm } });
        let data = res.data?.data || res.data || [];
        if (!Array.isArray(data)) data = [];
        const results: UserSearchResult[] = data.map((t: any) => ({
          id: t.user?.id || t.userId,
          firstName: t.user?.firstName || t.firstName || '',
          lastName: t.user?.lastName || t.lastName || '',
          email: t.user?.email || t.email || '',
          schoolId: t.user?.schoolId,
          schoolName: t.school?.name,
        })).filter((u: UserSearchResult) => u.id);
        setAssignSearchResults(results);
      } catch {
        setAssignSearchResults([]);
      }
      setAssignSearching(false);
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [assignSearchTerm]);

  const filteredUsers = (roleUsers || []).filter((u: PlatformRoleUser) => {
    if (!searchTerm) return true;
    const name = `${u.user?.firstName || ''} ${u.user?.lastName || ''}`.toLowerCase();
    const email = u.user?.email?.toLowerCase() || '';
    return name.includes(searchTerm.toLowerCase()) || email.includes(searchTerm.toLowerCase());
  });

  const getRoleStyle = (role: string) => PLATFORM_ROLE_STYLES[role] || { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: '👤', desc: 'Platform role' };

  const getInitials = (f: string, l: string) => `${f?.[0] || ''}${l?.[0] || ''}`.toUpperCase();

  const getAvatarColor = (name: string) => {
    const colors = ['bg-gradient-to-br from-blue-400 to-blue-600', 'bg-gradient-to-br from-green-400 to-green-600', 'bg-gradient-to-br from-purple-400 to-purple-600', 'bg-gradient-to-br from-pink-400 to-pink-600', 'bg-gradient-to-br from-indigo-400 to-indigo-600'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  };

  const isAlreadyAssigned = (userId: string) =>
    (roleUsers || []).some((u: PlatformRoleUser) => u.userId === userId && u.role === selectedRole && u.isActive);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Platform Role Management</h1>
          <p className="text-gray-500">Manage platform-wide roles and permissions across all schools</p>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg shadow-md animate-pulse ${
            message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' :
            'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 px-2">Platform Roles</h3>
              {rolesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {(allRoles || []).map((role: string) => {
                    const style = getRoleStyle(role);
                    const isSelected = selectedRole === role;
                    return (
                      <button
                        key={role}
                        onClick={() => { setSelectedRole(role); setSearchTerm(''); }}
                        className={`w-full px-3 py-3 rounded-xl text-left flex items-center gap-3 transition-all ${
                          isSelected
                            ? `${style.color} border-2 shadow-sm`
                            : 'hover:bg-gray-50 border-2 border-transparent'
                        }`}
                      >
                        <span className="text-xl">{style.icon}</span>
                        <div>
                          <div className={`font-medium text-sm ${isSelected ? '' : 'text-gray-700'}`}>{role}</div>
                          <div className="text-xs text-gray-400">{style.desc.slice(0, 40)}...</div>
                        </div>
                      </button>
                    );
                  })}
                  {(!allRoles || allRoles.length === 0) && (
                    <p className="text-gray-400 text-sm text-center py-4">No platform roles found</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="p-4 border-b bg-gradient-to-r from-indigo-50 to-blue-50 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getRoleStyle(selectedRole).icon}</span>
                  <div>
                    <h2 className="font-semibold text-gray-900">{selectedRole}</h2>
                    <p className="text-sm text-gray-500">{getRoleStyle(selectedRole).desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 w-48"
                  />
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-lg hover:from-indigo-600 hover:to-blue-700 transition-all text-sm font-medium"
                  >
                    + Assign Role
                  </button>
                </div>
              </div>

              {usersLoading ? (
                <div className="p-12 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading users...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-6xl mb-4">{getRoleStyle(selectedRole).icon}</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Users with {selectedRole} Role</h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm ? 'No users match your search.' : `No users have been assigned the ${selectedRole} role yet.`}
                  </p>
                  {!searchTerm && (
                    <button
                      onClick={() => setShowAssignModal(true)}
                      className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-xl hover:from-indigo-600 hover:to-blue-700 transition-all font-medium"
                    >
                      + Assign {selectedRole}
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">School</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Assigned</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredUsers.map((u: PlatformRoleUser) => (
                        <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${getAvatarColor(u.user?.firstName || '')}`}>
                                {getInitials(u.user?.firstName || '', u.user?.lastName || '')}
                              </div>
                              <div className="font-medium text-gray-900">{u.user?.firstName} {u.user?.lastName}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{u.user?.email}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{u.user?.schoolId ? u.user.schoolId.slice(0, 8) + '...' : '—'}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{u.startDate ? new Date(u.startDate).toLocaleDateString() : '—'}</td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => {
                                if (confirm(`Remove ${selectedRole} role from ${u.user?.firstName} ${u.user?.lastName}?`)) {
                                  removeMutation.mutate({ userId: u.userId, role: selectedRole });
                                }
                              }}
                              className="px-3 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg transform transition-all">
            <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-blue-50 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Assign {selectedRole}</h3>
                  <p className="text-sm text-gray-500 mt-1">Search for a user to assign this platform role</p>
                </div>
                <button onClick={() => { setShowAssignModal(false); setAssignSearchTerm(''); setAssignSearchResults([]); }} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
              </div>
            </div>
            <div className="p-6">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={assignSearchTerm}
                onChange={(e) => setAssignSearchTerm(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
                autoFocus
              />
              {assignSearching && <p className="text-gray-500 text-sm">Searching...</p>}
              {assignSearchResults.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {assignSearchResults.map((u) => {
                    const alreadyAssigned = isAlreadyAssigned(u.id);
                    return (
                      <div key={u.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${getAvatarColor(u.firstName)}`}>
                            {getInitials(u.firstName, u.lastName)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{u.firstName} {u.lastName}</div>
                            <div className="text-sm text-gray-500">{u.email}</div>
                          </div>
                        </div>
                        {alreadyAssigned ? (
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">✅ Already assigned</span>
                        ) : (
                          <button
                            onClick={() => assignMutation.mutate({ userId: u.id, role: selectedRole })}
                            disabled={assignMutation.isPending}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50"
                          >
                            {assignMutation.isPending ? 'Assigning...' : '+ Assign'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {assignSearchTerm.length >= 2 && !assignSearching && assignSearchResults.length === 0 && (
                <p className="text-gray-500 text-center py-4">No users found matching &quot;{assignSearchTerm}&quot;</p>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end">
              <button
                onClick={() => { setShowAssignModal(false); setAssignSearchTerm(''); setAssignSearchResults([]); }}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
