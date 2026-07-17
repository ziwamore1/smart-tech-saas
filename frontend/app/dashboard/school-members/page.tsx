"use client";

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { schoolMembershipApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { usePermissions } from '@/lib/permission-context';
import { ReadOnlyBanner } from '@/components/permissions/ReadOnlyBanner';

interface SchoolMember {
  id: string;
  userId: string;
  schoolId: string;
  isPrimary: boolean;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    isActive: boolean;
    accountStatus?: string;
  };
  schoolRoleAssignments: {
    role: string;
    startDate?: string;
    isActive: boolean;
  }[];
}

interface UserSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  isActive: boolean;
  isMember?: boolean;
}

const ROLE_STYLES: Record<string, { color: string; icon: string }> = {
  'Director': { color: 'bg-red-100 text-red-700', icon: '👑' },
  'Deputy Director': { color: 'bg-rose-100 text-rose-700', icon: '🏅' },
  'Head Teacher': { color: 'bg-purple-100 text-purple-700', icon: '🎓' },
  'Deputy Head': { color: 'bg-violet-100 text-violet-700', icon: '🎖️' },
  'Lower Primary Senior Teacher': { color: 'bg-orange-100 text-orange-700', icon: '📗' },
  'Upper Primary Senior Teacher': { color: 'bg-blue-100 text-blue-700', icon: '📘' },
  'Senior Teacher': { color: 'bg-cyan-100 text-cyan-700', icon: '🌟' },
  'Class Teacher': { color: 'bg-amber-100 text-amber-700', icon: '🏫' },
  'Teacher': { color: 'bg-blue-100 text-blue-700', icon: '👨‍🏫' },
  'Primary Teacher': { color: 'bg-sky-100 text-sky-700', icon: '👨‍🏫' },
  'HOD': { color: 'bg-teal-100 text-teal-700', icon: '📚' },
  'Deputy': { color: 'bg-indigo-100 text-indigo-700', icon: '⭐' },
  'Accountant': { color: 'bg-green-100 text-green-700', icon: '💰' },
  'Secretary': { color: 'bg-pink-100 text-pink-700', icon: '📋' },
  'Student': { color: 'bg-sky-100 text-sky-700', icon: '🎓' },
  'Learner': { color: 'bg-sky-100 text-sky-700', icon: '🎓' },
  'Parent': { color: 'bg-amber-100 text-amber-700', icon: '👨‍👩‍👦' },
  'SuperAdmin': { color: 'bg-red-100 text-red-700', icon: '🔧' },
};

const AVAILABLE_ROLES_PRIMARY = [
  { name: 'Director', icon: '👑' },
  { name: 'Deputy Director', icon: '🏅' },
  { name: 'Head Teacher', icon: '🎓' },
  { name: 'Deputy Head', icon: '🎖️' },
  { name: 'Lower Primary Senior Teacher', icon: '📗' },
  { name: 'Upper Primary Senior Teacher', icon: '📘' },
  { name: 'Class Teacher', icon: '🏫' },
  { name: 'Teacher', icon: '👨‍🏫' },
  { name: 'Deputy', icon: '⭐' },
  { name: 'Accountant', icon: '💰' },
  { name: 'Secretary', icon: '📋' },
];

const AVAILABLE_ROLES_SECONDARY = [
  { name: 'Director', icon: '👑' },
  { name: 'Deputy Director', icon: '🏅' },
  { name: 'Head Teacher', icon: '🎓' },
  { name: 'Deputy', icon: '⭐' },
  { name: 'HOD', icon: '📚' },
  { name: 'Teacher', icon: '👨‍🏫' },
  { name: 'Class Teacher', icon: '🏫' },
  { name: 'Accountant', icon: '💰' },
  { name: 'Secretary', icon: '📋' },
];

const AVAILABLE_ROLES_COLLEGE = [
  { name: 'Principal', icon: '🎓' },
  { name: 'Registrar', icon: '📋' },
  { name: 'Lecturer', icon: '👨‍🏫' },
];

const AVAILABLE_ROLES_UNIVERSITY = [
  { name: 'Vice Chancellor', icon: '🎓' },
  { name: 'Dean', icon: '📚' },
  { name: 'Lecturer', icon: '👨‍🏫' },
  { name: 'Research Supervisor', icon: '🔬' },
];

export default function SchoolMembersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canManage = can('users.manage');

  const isPrimary = user?.institutionType === 'PRIMARY_SCHOOL';
  const isSecondary = user?.institutionType === 'SECONDARY_SCHOOL' || user?.institutionType === 'ADVANCED_SECONDARY';
  const isCollege = user?.institutionType === 'COLLEGE';
  const isUniversity = user?.institutionType === 'UNIVERSITY';

  const availableRoles = isPrimary ? AVAILABLE_ROLES_PRIMARY
    : isSecondary ? AVAILABLE_ROLES_SECONDARY
    : isCollege ? AVAILABLE_ROLES_COLLEGE
    : isUniversity ? AVAILABLE_ROLES_UNIVERSITY
    : AVAILABLE_ROLES_SECONDARY;

  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearchTerm, setAddSearchTerm] = useState('');
  const [addSearchResults, setAddSearchResults] = useState<UserSearchResult[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const addSearchTimeout = useRef<NodeJS.Timeout | null>(null);

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<{ userId: string; name: string } | null>(null);
  const [roleRemoveConfirm, setRoleRemoveConfirm] = useState<{ userId: string; role: string; name: string } | null>(null);

  const { data: members, isLoading } = useQuery({
    queryKey: ['school-members'],
    queryFn: async () => {
      try {
        const res = await schoolMembershipApi.getMembers();
        let data = res.data;
        if (data && !Array.isArray(data)) {
          data = data.data || data.result || [];
        }
        return Array.isArray(data) ? data : [];
      } catch (e) {
        return [];
      }
    },
  });

  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return schoolMembershipApi.assignRole(userId, role);
    },
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Role assigned successfully!' });
      queryClient.invalidateQueries({ queryKey: ['school-members'] });
      setActiveDropdown(null);
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (e: any) => {
      const msg = e.response?.data?.message || e.message;
      setMessage({ type: 'error', text: msg || 'Failed to assign role' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return schoolMembershipApi.removeRole(userId, role);
    },
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Role removed successfully!' });
      queryClient.invalidateQueries({ queryKey: ['school-members'] });
      setRoleRemoveConfirm(null);
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (e: any) => {
      setMessage({ type: 'error', text: e.response?.data?.message || 'Failed to remove role' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      return schoolMembershipApi.addMember(userId);
    },
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Member added to school!' });
      queryClient.invalidateQueries({ queryKey: ['school-members'] });
      setShowAddModal(false);
      setAddSearchTerm('');
      setAddSearchResults([]);
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (e: any) => {
      setMessage({ type: 'error', text: e.response?.data?.message || 'Failed to add member' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      return schoolMembershipApi.removeMember(userId);
    },
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Member removed from school!' });
      queryClient.invalidateQueries({ queryKey: ['school-members'] });
      setRemoveConfirm(null);
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (e: any) => {
      setMessage({ type: 'error', text: e.response?.data?.message || 'Failed to remove member' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  useEffect(() => {
    if (addSearchTerm.length < 2) {
      setAddSearchResults([]);
      return;
    }
    if (addSearchTimeout.current) clearTimeout(addSearchTimeout.current);
    addSearchTimeout.current = setTimeout(async () => {
      setAddSearching(true);
      try {
        const res = await schoolMembershipApi.searchUsers(addSearchTerm);
        let data = res.data || [];
        if (!Array.isArray(data)) data = [];
        const results: UserSearchResult[] = data.map((u: any) => ({
          id: u.id,
          firstName: u.firstName || '',
          lastName: u.lastName || '',
          email: u.email || '',
          phone: u.phone,
          isActive: u.isActive ?? true,
          isMember: u.isMember ?? false,
        })).filter((u: UserSearchResult) => u.id);
        setAddSearchResults(results);
      } catch {
        setAddSearchResults([]);
      }
      setAddSearching(false);
    }, 300);
    return () => { if (addSearchTimeout.current) clearTimeout(addSearchTimeout.current); };
  }, [addSearchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.role-dropdown')) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const filteredMembers = (members || []).filter((m: SchoolMember) => {
    const name = `${m.user?.firstName || ''} ${m.user?.lastName || ''}`.toLowerCase();
    const email = m.user?.email?.toLowerCase() || '';
    const matchesSearch = !searchTerm || name.includes(searchTerm.toLowerCase()) || email.includes(searchTerm.toLowerCase());
    const matchesRole = !filterRole || m.schoolRoleAssignments?.some((r: any) => r.role === filterRole && r.isActive);
    return matchesSearch && matchesRole;
  });

  const getRoleStyle = (role: string) => ROLE_STYLES[role] || { color: 'bg-gray-100 text-gray-700', icon: '👤' };

  const getInitials = (f: string, l: string) => `${f?.[0] || ''}${l?.[0] || ''}`.toUpperCase();

  const getAvatarColor = (name: string) => {
    const colors = ['bg-gradient-to-br from-blue-400 to-blue-600', 'bg-gradient-to-br from-green-400 to-green-600', 'bg-gradient-to-br from-purple-400 to-purple-600', 'bg-gradient-to-br from-pink-400 to-pink-600', 'bg-gradient-to-br from-indigo-400 to-indigo-600', 'bg-gradient-to-br from-amber-400 to-amber-600'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  };

  const getActiveRoles = (m: SchoolMember) =>
    (m.schoolRoleAssignments || []).filter((r: any) => r.isActive).map((r: any) => r.role);

  const getAvailableRolesForMember = (m: SchoolMember) => {
    const active = getActiveRoles(m);
    return availableRoles.filter(r => !active.includes(r.name));
  };

  const memberCount = members?.length || 0;
  const roleCounts: Record<string, number> = {};
  (members || []).forEach((m: SchoolMember) => {
    getActiveRoles(m).forEach(role => {
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    });
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <ReadOnlyBanner managePermission="users.manage" />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">School Members</h1>
            <p className="text-gray-500">Manage school membership, roles, and access</p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-lg hover:from-indigo-600 hover:to-blue-700 transition-all shadow-sm text-sm font-medium flex items-center gap-2"
            >
              <span>+</span> Add Member
            </button>
          )}
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg shadow-md animate-pulse ${
            message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' :
            message.type === 'warning' ? 'bg-yellow-50 border border-yellow-200 text-yellow-700' :
            'bg-red-50 border border-red-200 text-red-700'
          }`}>
            <span>{message.text}</span>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-4 border-b bg-gradient-to-r from-indigo-50 to-blue-50 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search members..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-64"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              </div>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="py-2 px-4 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Roles</option>
                {availableRoles.map(r => (
                  <option key={r.name} value={r.name}>{r.icon} {r.name}</option>
                ))}
              </select>
            </div>
            <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm">
              {memberCount} Members
            </span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading members...</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Members Found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || filterRole ? 'Try adjusting your search filters.' : 'Add members to get started.'}
              </p>
              {canManage && !searchTerm && !filterRole && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-xl hover:from-indigo-600 hover:to-blue-700 transition-all font-medium"
                >
                  + Add First Member
                </button>
              )}
            </div>
          ) : (
            <>
            {/* Mobile Card View */}
            <div className="sm:hidden divide-y divide-gray-100">
              {filteredMembers.map((member: SchoolMember) => {
                const activeRoles = getActiveRoles(member);
                return (
                  <div key={member.id} className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${getAvatarColor(member.user?.firstName || '')}`}>
                        {getInitials(member.user?.firstName, member.user?.lastName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{member.user?.firstName} {member.user?.lastName}</div>
                        <div className="text-sm text-gray-500 truncate">{member.user?.email}</div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                        member.user?.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {member.user?.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {activeRoles.length > 0 ? activeRoles.map((role: string) => {
                        const style = getRoleStyle(role);
                        return (
                          <span key={role} className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.color}`}>
                            {style.icon} {role}
                          </span>
                        );
                      }) : <span className="text-gray-400 text-xs italic">No roles</span>}
                    </div>
                    {canManage && getAvailableRolesForMember(member).length > 0 && (
                      <div className="flex gap-2">
                        <div className="relative role-dropdown">
                          <button
                            onClick={() => setActiveDropdown(activeDropdown === member.user.id ? null : member.user.id)}
                            className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium"
                          >
                            + Role
                          </button>
                          {activeDropdown === member.user.id && (
                            <div className="absolute left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-2 max-h-64 overflow-y-auto">
                              <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b">Add Role</div>
                              {getAvailableRolesForMember(member).map(r => (
                                <button
                                  key={r.name}
                                  onClick={() => assignRoleMutation.mutate({ userId: member.user.id, role: r.name })}
                                  className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 transition-colors flex items-center gap-3 text-sm"
                                >
                                  <span>{r.icon}</span>
                                  <span className="font-medium text-gray-700">{r.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => setRemoveConfirm({ userId: member.user.id, name: `${member.user.firstName} ${member.user.lastName}` })}
                          className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Member</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Roles</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredMembers.map((member: SchoolMember) => {
                    const activeRoles = getActiveRoles(member);
                    return (
                      <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${getAvatarColor(member.user?.firstName || '')}`}>
                              {getInitials(member.user?.firstName, member.user?.lastName)}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{member.user?.firstName} {member.user?.lastName}</div>
                              <div className="text-sm text-gray-500">{member.user?.phone || ''}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{member.user?.email}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            member.user?.isActive
                              ? 'bg-green-100 text-green-700 border border-green-200'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}>
                            {member.user?.isActive ? '✅ Active' : '⏸ Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2 items-center">
                            {activeRoles.length > 0 ? activeRoles.map((role: string) => {
                              const style = getRoleStyle(role);
                              return (
                                <div key={role} className="relative group inline-flex items-center gap-1">
                                  <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${style.color}`}>
                                    {style.icon} {role}
                                  </span>
                                  {canManage && (
                                    <button
                                      onClick={() => setRoleRemoveConfirm({ userId: member.user.id, role, name: `${member.user.firstName} ${member.user.lastName}` })}
                                      className="w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                      title={`Remove ${role}`}
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              );
                            }) : (
                              <span className="text-gray-400 text-sm italic">No roles</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {canManage && getAvailableRolesForMember(member).length > 0 && (
                              <div className="relative role-dropdown">
                                <button
                                  onClick={() => setActiveDropdown(activeDropdown === member.user.id ? null : member.user.id)}
                                  className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm font-medium flex items-center gap-1"
                                >
                                  + Role
                                  <svg className={`w-3 h-3 transition-transform ${activeDropdown === member.user.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                {activeDropdown === member.user.id && (
                                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-2 max-h-64 overflow-y-auto">
                                    <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b">Add Role</div>
                                    {getAvailableRolesForMember(member).map(r => (
                                      <button
                                        key={r.name}
                                        onClick={() => assignRoleMutation.mutate({ userId: member.user.id, role: r.name })}
                                        className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 transition-colors flex items-center gap-3 text-sm"
                                      >
                                        <span>{r.icon}</span>
                                        <span className="font-medium text-gray-700">{r.name}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {canManage && (
                              <button
                                onClick={() => setRemoveConfirm({ userId: member.user.id, name: `${member.user.firstName} ${member.user.lastName}` })}
                                className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                                title="Remove from school"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>

        <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-4">📊 Role Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {availableRoles.map(r => {
              const count = roleCounts[r.name] || 0;
              const style = getRoleStyle(r.name);
              return (
                <div
                  key={r.name}
                  className={`${style.color.split(' ')[0]} rounded-2xl p-4 text-center border-2 hover:scale-105 transition-all cursor-pointer`}
                  onClick={() => setFilterRole(filterRole === r.name ? '' : r.name)}
                >
                  <div className="text-3xl mb-2">{r.icon}</div>
                  <div className={`text-sm font-semibold ${style.color.split(' ')[1]}`}>{r.name}</div>
                  <div className="text-xs opacity-60 mt-1">{count} member{count !== 1 ? 's' : ''}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg transform transition-all">
            <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-blue-50 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Add School Member</h3>
                  <p className="text-sm text-gray-500 mt-1">Search for a user to add to this school</p>
                </div>
                <button onClick={() => { setShowAddModal(false); setAddSearchTerm(''); setAddSearchResults([]); }} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
              </div>
            </div>
            <div className="p-6">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={addSearchTerm}
                onChange={(e) => setAddSearchTerm(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
                autoFocus
              />
              {addSearching && <p className="text-gray-500 text-sm">Searching...</p>}
              {addSearchResults.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {addSearchResults.map((u) => {
                    const isExistingMember = u.isMember || (members || []).some((m: SchoolMember) => m.user?.id === u.id);
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
                        {isExistingMember ? (
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">✅ Already a member</span>
                        ) : (
                          <button
                            onClick={() => addMemberMutation.mutate(u.id)}
                            disabled={addMemberMutation.isPending}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50"
                          >
                            {addMemberMutation.isPending ? 'Adding...' : '+ Add'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {addSearchTerm.length >= 2 && !addSearching && addSearchResults.length === 0 && (
                <p className="text-gray-500 text-center py-4">No users found matching &quot;{addSearchTerm}&quot;</p>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end">
              <button
                onClick={() => { setShowAddModal(false); setAddSearchTerm(''); setAddSearchResults([]); }}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {removeConfirm && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Remove Member</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to remove <strong>{removeConfirm.name}</strong> from this school? This will also remove all their school roles.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setRemoveConfirm(null)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
              <button
                onClick={() => removeMemberMutation.mutate(removeConfirm.userId)}
                disabled={removeMemberMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {removeMemberMutation.isPending ? 'Removing...' : 'Remove Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {roleRemoveConfirm && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Remove Role</h3>
            <p className="text-gray-600 mb-6">
              Remove <strong>{roleRemoveConfirm.role}</strong> from <strong>{roleRemoveConfirm.name}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setRoleRemoveConfirm(null)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
              <button
                onClick={() => removeRoleMutation.mutate({ userId: roleRemoveConfirm.userId, role: roleRemoveConfirm.role })}
                disabled={removeRoleMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {removeRoleMutation.isPending ? 'Removing...' : 'Remove Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
