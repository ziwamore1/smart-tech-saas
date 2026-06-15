'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { teacherApi } from '@/lib/api';

const PRIMARY_ROLES = [
  'Head Teacher',
  'Deputy Head',
  'Senior Teacher',
  'Primary Teacher',
  'ECE Teacher',
  'Support Staff',
];

const PRIMARY_SPECIALIZATIONS = [
  'Literacy & Numeracy',
  'Science & Technology',
  'Social Studies',
  'Expressive Arts',
  'Physical Education',
  'Zambian Languages',
  'Special Education',
  'ECE / Early Learning',
];

export default function PrimaryTeachersPage() {
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: teachers, isLoading } = useQuery({
    queryKey: ['primary-teachers', selectedRole],
    queryFn: () => teacherApi.getAll({ role: selectedRole !== 'all' ? selectedRole : undefined }).then(r => r.data?.data || r.data || []),
  });

  const roleCounts: Record<string, number> = {};
  (teachers || []).forEach((t: any) => {
    const role = t.role || 'Primary Teacher';
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Primary School Staff</h1>
          <p className="text-gray-500 text-sm mt-1">Head Teacher, Deputy Head, Teachers, and Support Staff</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2"
        >
          <i className="fas fa-user-plus" />
          Add Staff Member
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {PRIMARY_ROLES.map(role => (
          <button
            key={role}
            onClick={() => setSelectedRole(role === selectedRole ? 'all' : role)}
            className={`bg-white rounded-xl border p-4 text-left transition-all ${
              selectedRole === role ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-gray-100 hover:border-gray-200'
            }`}
          >
            <p className="text-sm font-medium text-gray-900">{role}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: role === 'Head Teacher' ? '#059669' : role === 'Deputy Head' ? '#3b82f6' : '#6b7280' }}>
              {roleCounts[role] || 0}
            </p>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {selectedRole === 'all' ? 'All Staff' : selectedRole}
            <span className="text-sm font-normal text-gray-500 ml-2">({(teachers || []).length} staff)</span>
          </h2>
        </div>
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">Loading staff...</div>
        ) : (teachers || []).length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <div className="text-4xl mb-3 text-gray-300"><i className="fas fa-chalkboard-teacher" /></div>
            <p>No staff found. Add your first staff member to get started.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Specialization</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(teachers || []).map((teacher: any) => (
                <tr key={teacher.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs font-bold">
                        {teacher.firstName?.[0]}{teacher.lastName?.[0]}
                      </div>
                      <span className="font-medium text-gray-900">{teacher.firstName} {teacher.lastName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded text-xs font-medium ${
                      teacher.role === 'Head Teacher' ? 'bg-emerald-100 text-emerald-700' :
                      teacher.role === 'Deputy Head' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {teacher.role || 'Primary Teacher'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{teacher.specialization || '—'}</td>
                  <td className="px-6 py-4 text-gray-500 text-sm">{teacher.phone || '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">Profile</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Staff Positions</h3>
          <div className="space-y-2">
            {[
              { role: 'Head Teacher', icon: 'fa-crown', color: '#059669', desc: 'School leader and administrator' },
              { role: 'Deputy Head', icon: 'fa-star', color: '#3b82f6', desc: 'Deputy school administrator' },
              { role: 'Senior Teacher', icon: 'fa-user-tie', color: '#8b5cf6', desc: 'Senior teaching staff' },
              { role: 'Primary Teacher', icon: 'fa-chalkboard-teacher', color: '#10b981', desc: 'Class or subject teacher' },
              { role: 'ECE Teacher', icon: 'fa-baby', color: '#ec4899', desc: 'Early childhood educator' },
              { role: 'Support Staff', icon: 'fa-hands', color: '#f59e0b', desc: 'Non-teaching support' },
            ].map(pos => (
              <div key={pos.role} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs" style={{ backgroundColor: pos.color }}>
                  <i className={`fas ${pos.icon}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{pos.role}</p>
                  <p className="text-xs text-gray-500">{pos.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Subject Specializations</h3>
          <div className="space-y-2">
            {PRIMARY_SPECIALIZATIONS.map(spec => (
              <div key={spec} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 text-xs">
                  <i className="fas fa-book" />
                </div>
                <span className="text-sm text-gray-700">{spec}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
