'use client';

import { GraduationCap, Heart, UserCog, Users2, Shield, Settings } from 'lucide-react';
import SectionHeading from '@/components/ui/SectionHeading';
import RoleCard from '@/components/ui/RoleCard';

const roles = [
  {
    icon: <GraduationCap className="w-7 h-7" />,
    role: 'Students',
    color: '#00AEEF',
    benefits: ['Access grades and attendance records', 'AI Tutor for homework help', 'Receive assignments and deadlines', 'Track learning progress', 'Digital certificates and badges'],
  },
  {
    icon: <Heart className="w-7 h-7" />,
    role: 'Parents',
    color: '#00C896',
    benefits: ['Real-time attendance notifications', 'View grades and report cards', 'Communicate with teachers', 'Pay fees online', 'Track child progress'],
  },
  {
    icon: <UserCog className="w-7 h-7" />,
    role: 'Teachers',
    color: '#0F4C81',
    benefits: ['Manage classes and subjects', 'Record attendance and grades', 'Create assignments and exams', 'Access AI grading tools', 'Generate report cards'],
  },
  {
    icon: <Users2 className="w-7 h-7" />,
    role: 'Class Teachers',
    color: '#6B21A8',
    benefits: ['Monitor class performance', 'Manage student behavior records', 'Generate class reports', 'Parent communication hub', 'Track overall class progress'],
  },
  {
    icon: <Shield className="w-7 h-7" />,
    role: 'Directors',
    color: '#DC2626',
    benefits: ['School-wide analytics dashboard', 'Staff management and oversight', 'Financial reporting', 'Multi-branch management', 'Strategic decision making'],
  },
  {
    icon: <Settings className="w-7 h-7" />,
    role: 'Super Administrators',
    color: '#0B1220',
    benefits: ['Full system configuration', 'Multi-school management', 'User role management', 'System-wide analytics', 'Integration management'],
  },
];

export default function RoleSection() {
  return (
    <section className="py-20 lg:py-28 bg-surface">
      <div className="container-main">
        <SectionHeading
          title="Designed for Every Role"
          subtitle="Tailored experiences for every member of your school community, from students to administrators."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
          {roles.map((r, i) => (
            <RoleCard key={i} icon={r.icon} role={r.role} benefits={r.benefits} color={r.color} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
