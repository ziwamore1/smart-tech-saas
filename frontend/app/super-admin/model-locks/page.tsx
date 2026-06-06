'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { featureLockApi } from '@/lib/api';

interface Feature {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  isLocked: boolean;
  tier: string;
}

const DEFAULT_FEATURES: Feature[] = [
  // Students
  { id: 's1', key: 'students.view', name: 'View Students', description: 'View student list and details', category: 'students', isLocked: false, tier: 'BASIC' },
  { id: 's2', key: 'students.add', name: 'Add Students', description: 'Add new students to the system', category: 'students', isLocked: false, tier: 'BASIC' },
  { id: 's3', key: 'students.bulkImport', name: 'Bulk Import Students', description: 'Import students via Excel/CSV', category: 'students', isLocked: false, tier: 'BASIC' },
  { id: 's4', key: 'students.advanced', name: 'Advanced Student Features', description: 'Health records, guardians management', category: 'students', isLocked: false, tier: 'STANDARD' },
  { id: 's5', key: 'students.analytics', name: 'Student Performance Analytics', description: 'Detailed analytics per student', category: 'students', isLocked: false, tier: 'STANDARD' },
  { id: 's6', key: 'students.growth', name: 'Student Growth Tracking', description: 'Academic growth and competency tracking', category: 'students', isLocked: false, tier: 'STANDARD' },

  // Teachers
  { id: 't1', key: 'teachers.view', name: 'View Teachers', description: 'View teacher list and details', category: 'teachers', isLocked: false, tier: 'BASIC' },
  { id: 't2', key: 'teachers.add', name: 'Add Teachers', description: 'Add new teachers to the system', category: 'teachers', isLocked: false, tier: 'BASIC' },
  { id: 't3', key: 'teachers.bulkImport', name: 'Bulk Import Teachers', description: 'Import teachers via Excel/CSV', category: 'teachers', isLocked: false, tier: 'STANDARD' },
  { id: 't4', key: 'teachers.analytics', name: 'Teacher Analytics', description: 'Teacher workload and performance insights', category: 'teachers', isLocked: false, tier: 'STANDARD' },

  // Classes
  { id: 'c1', key: 'classes.view', name: 'View Classes', description: 'View class list and details', category: 'classes', isLocked: false, tier: 'BASIC' },
  { id: 'c2', key: 'classes.add', name: 'Add Classes', description: 'Create new classes', category: 'classes', isLocked: false, tier: 'BASIC' },
  { id: 'c3', key: 'classes.analytics', name: 'Class Analytics', description: 'Class-level performance breakdown', category: 'classes', isLocked: false, tier: 'STANDARD' },

  // Subjects
  { id: 'sb1', key: 'subjects.view', name: 'View Subjects', description: 'View subject list', category: 'subjects', isLocked: false, tier: 'BASIC' },
  { id: 'sb2', key: 'subjects.add', name: 'Add Subjects', description: 'Create new subjects', category: 'subjects', isLocked: false, tier: 'BASIC' },

  // Timetable
  { id: 'tt1', key: 'timetable.view', name: 'View Timetable', description: 'View master and class timetables', category: 'timetable', isLocked: false, tier: 'BASIC' },
  { id: 'tt2', key: 'timetable.edit', name: 'Edit Timetable', description: 'Manually edit and adjust timetable', category: 'timetable', isLocked: false, tier: 'BASIC' },
  { id: 'tt3', key: 'timetable.generate', name: 'AI Timetable Generator', description: 'Auto-generate timetables using AI', category: 'timetable', isLocked: false, tier: 'STANDARD' },
  { id: 'tt4', key: 'timetable.constraints', name: 'Timetable Constraints', description: 'Custom scheduling constraints', category: 'timetable', isLocked: true, tier: 'PREMIUM' },

  // Attendance
  { id: 'a1', key: 'attendance.register', name: 'Attendance Register', description: 'Mark daily attendance', category: 'attendance', isLocked: false, tier: 'BASIC' },
  { id: 'a2', key: 'attendance.dashboard', name: 'Attendance Dashboard', description: 'Attendance analytics and trends', category: 'attendance', isLocked: false, tier: 'STANDARD' },
  { id: 'a3', key: 'attendance.reports', name: 'Attendance Reports', description: 'Detailed attendance reports and exports', category: 'attendance', isLocked: false, tier: 'STANDARD' },

  // Results
  { id: 'r1', key: 'results.view', name: 'View Results', description: 'View student results', category: 'results', isLocked: false, tier: 'BASIC' },
  { id: 'r2', key: 'results.add', name: 'Add Results', description: 'Enter and manage student results', category: 'results', isLocked: false, tier: 'BASIC' },
  { id: 'r3', key: 'results.bulkImport', name: 'Bulk Import Results', description: 'Import results via Excel', category: 'results', isLocked: false, tier: 'BASIC' },
  { id: 'r4', key: 'results.reports', name: 'Result Reports', description: 'Comprehensive result reports', category: 'results', isLocked: false, tier: 'STANDARD' },
  { id: 'r5', key: 'results.grading', name: 'Grading Policies', description: 'Custom grading scales and policies', category: 'results', isLocked: false, tier: 'STANDARD' },
  { id: 'r6', key: 'results.reportCards', name: 'Report Cards', description: 'Generate and customize report cards', category: 'results', isLocked: false, tier: 'STANDARD' },
  { id: 'r7', key: 'results.certificate', name: 'Certificate Designer', description: 'Design and issue certificates', category: 'results', isLocked: true, tier: 'PREMIUM' },

  // Assessments
  { id: 'as1', key: 'assessments.view', name: 'View Assessments', description: 'View assessment configurations', category: 'assessments', isLocked: false, tier: 'BASIC' },
  { id: 'as2', key: 'assessments.entry', name: 'Score Entry', description: 'Enter assessment scores', category: 'assessments', isLocked: false, tier: 'BASIC' },
  { id: 'as3', key: 'assessments.config', name: 'Assessment Configuration', description: 'Configure grading and assessment types', category: 'assessments', isLocked: false, tier: 'STANDARD' },

  // Fees
  { id: 'f1', key: 'fees.view', name: 'View Fees', description: 'View fee structure and payments', category: 'fees', isLocked: false, tier: 'BASIC' },
  { id: 'f2', key: 'fees.manage', name: 'Manage Fees', description: 'Create and modify fee structures', category: 'fees', isLocked: false, tier: 'BASIC' },
  { id: 'f3', key: 'fees.onlinePayment', name: 'Online Payment', description: 'Enable online fee payment gateway', category: 'fees', isLocked: false, tier: 'STANDARD' },

  // Communications
  { id: 'cm1', key: 'communications.view', name: 'View Communications', description: 'View messages and notifications', category: 'communications', isLocked: false, tier: 'BASIC' },
  { id: 'cm2', key: 'communications.send', name: 'Send Messages', description: 'Send messages to parents and teachers', category: 'communications', isLocked: false, tier: 'BASIC' },
  { id: 'cm3', key: 'communications.bulk', name: 'Bulk Messaging', description: 'Send bulk SMS and emails', category: 'communications', isLocked: false, tier: 'STANDARD' },
  { id: 'cm4', key: 'communications.whatsapp', name: 'WhatsApp Integration', description: 'Send messages via WhatsApp', category: 'communications', isLocked: true, tier: 'PREMIUM' },

  // Analytics
  { id: 'an1', key: 'analytics.view', name: 'View Analytics', description: 'Basic analytics dashboards', category: 'analytics', isLocked: false, tier: 'BASIC' },
  { id: 'an2', key: 'analytics.advanced', name: 'Advanced Analytics', description: 'Predictive analytics and insights', category: 'analytics', isLocked: false, tier: 'STANDARD' },
  { id: 'an3', key: 'analytics.ai', name: 'AI-Powered Insights', description: 'AI recommendations and predictions', category: 'analytics', isLocked: true, tier: 'PREMIUM' },
  { id: 'an4', key: 'analytics.enhanced', name: 'Enhanced Analytics', description: 'ECharts visualizations and heatmaps', category: 'analytics', isLocked: false, tier: 'STANDARD' },

  // Reports
  { id: 'rp1', key: 'reports.generate', name: 'Generate Reports', description: 'Standard system reports', category: 'reports', isLocked: false, tier: 'BASIC' },
  { id: 'rp2', key: 'reports.custom', name: 'Custom Reports', description: 'Create and customize reports', category: 'reports', isLocked: false, tier: 'STANDARD' },
  { id: 'rp3', key: 'reports.export', name: 'Export Reports', description: 'Export reports in various formats', category: 'reports', isLocked: false, tier: 'BASIC' },
  { id: 'rp4', key: 'reports.templates', name: 'Report Templates', description: 'Customizable report template builder', category: 'reports', isLocked: false, tier: 'STANDARD' },

  // Intelligence / AI
  { id: 'i1', key: 'intelligence.ai-tutor', name: 'AI Tutor', description: 'Intelligent tutoring assistant', category: 'intelligence', isLocked: true, tier: 'PREMIUM' },
  { id: 'i2', key: 'intelligence.benchmarking', name: 'Benchmarking', description: 'National average comparisons', category: 'intelligence', isLocked: true, tier: 'PREMIUM' },
  { id: 'i3', key: 'intelligence.psychometric', name: 'Psychometric Analysis', description: 'Exam reliability and item analysis', category: 'intelligence', isLocked: true, tier: 'PREMIUM' },
  { id: 'i4', key: 'intelligence.adaptive-testing', name: 'Adaptive Testing', description: 'IRT-based computerized testing', category: 'intelligence', isLocked: true, tier: 'PREMIUM' },
  { id: 'i5', key: 'intelligence.learning-style', name: 'Learning Style Analysis', description: 'VARK assessment and insights', category: 'intelligence', isLocked: false, tier: 'STANDARD' },
  { id: 'i6', key: 'intelligence.exam-quality', name: 'Exam Quality Analysis', description: 'Quality metrics and grade inflation detection', category: 'intelligence', isLocked: true, tier: 'PREMIUM' },
  { id: 'i7', key: 'intelligence.subject-engines', name: 'Subject-Specific AI Engines', description: 'Math, Science, English, Humanities domain AI', category: 'intelligence', isLocked: true, tier: 'PREMIUM' },

  // Online Exams
  { id: 'e1', key: 'exams.create', name: 'Create Exams', description: 'Create and configure online exams', category: 'exams', isLocked: false, tier: 'STANDARD' },
  { id: 'e2', key: 'exams.take', name: 'Take Exams', description: 'Student online exam taking', category: 'exams', isLocked: false, tier: 'BASIC' },
  { id: 'e3', key: 'exams.autoGrade', name: 'Auto-Grading', description: 'Automatic exam grading', category: 'exams', isLocked: false, tier: 'STANDARD' },

  // Library
  { id: 'l1', key: 'library.view', name: 'Digital Library', description: 'Browse school document library', category: 'library', isLocked: false, tier: 'BASIC' },
  { id: 'l2', key: 'library.upload', name: 'Library Upload', description: 'Upload documents to library', category: 'library', isLocked: false, tier: 'STANDARD' },

  // Lesson Plans
  { id: 'lp1', key: 'lessonplans.view', name: 'View Lesson Plans', description: 'View lesson plans', category: 'lessonplans', isLocked: false, tier: 'BASIC' },
  { id: 'lp2', key: 'lessonplans.create', name: 'Create Lesson Plans', description: 'Create and manage lesson plans', category: 'lessonplans', isLocked: false, tier: 'BASIC' },
  { id: 'lp3', key: 'lessonplans.ai', name: 'AI Lesson Plan Generator', description: 'Generate lesson plans using AI', category: 'lessonplans', isLocked: true, tier: 'PREMIUM' },

  // Digital Stamps & Signatures
  { id: 'ds1', key: 'stamps.view', name: 'View Stamps', description: 'View digital stamps', category: 'stamps', isLocked: false, tier: 'BASIC' },
  { id: 'ds2', key: 'stamps.apply', name: 'Apply Stamps', description: 'Apply stamps to documents', category: 'stamps', isLocked: false, tier: 'STANDARD' },
  { id: 'ds3', key: 'stamps.create', name: 'Create Stamps', description: 'Create custom digital stamps', category: 'stamps', isLocked: false, tier: 'STANDARD' },
  { id: 'ds4', key: 'stamps.verify', name: 'Verify Documents', description: 'Verify stamped documents via hash', category: 'stamps', isLocked: false, tier: 'BASIC' },
  { id: 'ds5', key: 'stamps.signatures', name: 'Digital Signatures', description: 'Create and manage digital signatures', category: 'stamps', isLocked: false, tier: 'STANDARD' },
  { id: 'ds6', key: 'stamps.blockchain', name: 'Blockchain Certificates', description: 'Issue blockchain-verified certificates', category: 'stamps', isLocked: true, tier: 'PREMIUM' },
  { id: 'ds7', key: 'stamps.approvals', name: 'Approval Workflows', description: 'Multi-step approval workflows', category: 'stamps', isLocked: false, tier: 'STANDARD' },

  // Gallery
  { id: 'g1', key: 'gallery.view', name: 'View Gallery', description: 'View photo gallery', category: 'gallery', isLocked: false, tier: 'BASIC' },
  { id: 'g2', key: 'gallery.upload', name: 'Upload Photos', description: 'Upload photos to school gallery', category: 'gallery', isLocked: false, tier: 'STANDARD' },

  // Templates
  { id: 'tm1', key: 'templates.view', name: 'View Templates', description: 'View report templates', category: 'templates', isLocked: false, tier: 'BASIC' },
  { id: 'tm2', key: 'templates.create', name: 'Create Templates', description: 'Design custom report templates', category: 'templates', isLocked: false, tier: 'STANDARD' },
  { id: 'tm3', key: 'templates.marketplace', name: 'Template Marketplace', description: 'Browse and install community templates', category: 'templates', isLocked: false, tier: 'STANDARD' },
  { id: 'tm4', key: 'templates.ai', name: 'AI Template Generator', description: 'Generate templates using AI', category: 'templates', isLocked: true, tier: 'PREMIUM' },

  // Integrations
  { id: 'in1', key: 'integrations.api', name: 'API Access', description: 'Access to REST API for integrations', category: 'integrations', isLocked: false, tier: 'STANDARD' },
  { id: 'in2', key: 'integrations.webhooks', name: 'Webhooks', description: 'Configure webhook notifications', category: 'integrations', isLocked: true, tier: 'PREMIUM' },
  { id: 'in3', key: 'integrations.ministry', name: 'Ministry Integration', description: 'Ministry of Education API sync', category: 'integrations', isLocked: true, tier: 'PREMIUM' },

  // Advanced
  { id: 'ad1', key: 'advanced.backup', name: 'Data Backup', description: 'Automated data backup', category: 'advanced', isLocked: false, tier: 'BASIC' },
  { id: 'ad2', key: 'advanced.restore', name: 'Data Restore', description: 'Restore from backup', category: 'advanced', isLocked: false, tier: 'BASIC' },
  { id: 'ad3', key: 'advanced.multiuser', name: 'Multi-user Access', description: 'Multiple admin user accounts', category: 'advanced', isLocked: false, tier: 'STANDARD' },
  { id: 'ad4', key: 'advanced.sso', name: 'Single Sign-On (SSO)', description: 'SSO integration with external systems', category: 'advanced', isLocked: true, tier: 'PREMIUM' },
  { id: 'ad5', key: 'advanced.settings', name: 'System Settings', description: 'School configuration and settings', category: 'advanced', isLocked: false, tier: 'BASIC' },
  { id: 'ad6', key: 'advanced.audit', name: 'Audit Logs', description: 'System audit trail', category: 'advanced', isLocked: false, tier: 'STANDARD' },

  // Branding
  { id: 'b1', key: 'branding.logo', name: 'School Branding', description: 'Upload logo and customize branding', category: 'branding', isLocked: false, tier: 'BASIC' },
  { id: 'b2', key: 'branding.presets', name: 'Brand Presets', description: 'Save and apply brand presets', category: 'branding', isLocked: false, tier: 'STANDARD' },
];

const TIER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  BASIC: { bg: '#f3f4f6', border: '#e8ddd0', text: '#6b7280' },
  STANDARD: { bg: '#dbeafe', border: '#bfdbfe', text: '#2563eb' },
  PREMIUM: { bg: '#f3e8ff', border: '#e9d5ff', text: '#9333ea' },
};

const CATEGORY_LABELS: Record<string, string> = {
  students: 'Students',
  teachers: 'Teachers',
  classes: 'Classes',
  subjects: 'Subjects',
  timetable: 'Timetable',
  attendance: 'Attendance',
  results: 'Results',
  assessments: 'Assessments',
  fees: 'Fees',
  communications: 'Communications',
  analytics: 'Analytics',
  reports: 'Reports',
  intelligence: 'Intelligence / AI',
  exams: 'Online Exams',
  library: 'Library',
  lessonplans: 'Lesson Plans',
  stamps: 'Digital Stamps & Signatures',
  gallery: 'Gallery',
  templates: 'Templates',
  integrations: 'Integrations',
  advanced: 'Advanced',
  branding: 'Branding',
};

export default function ModelLocksPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [features, setFeatures] = useState<Feature[]>(DEFAULT_FEATURES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadFeatures();
    }
  }, [isAuthenticated]);

  const loadFeatures = async () => {
    try {
      setLoading(true);
      const response = await featureLockApi.getFeatures();
      let featuresData: Feature[] = DEFAULT_FEATURES;
      const data = response.data?.data ?? response.data;
      if (Array.isArray(data)) {
        featuresData = data;
      } else if (Array.isArray(data?.data)) {
        featuresData = data.data;
      }
      setFeatures(featuresData);
    } catch (error) {
      console.error('Failed to load features:', error);
      setFeatures(DEFAULT_FEATURES);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLock = async (featureKey: string) => {
    try {
      setSaving(true);
      const feature = features.find(f => f.key === featureKey);
      if (feature) {
        await featureLockApi.updateFeature(featureKey, { isLocked: !feature.isLocked });
        setFeatures(features.map(f => 
          f.key === featureKey ? { ...f, isLocked: !f.isLocked } : f
        ));
        setMessage({ type: 'success', text: 'Feature updated successfully!' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error) {
      console.error('Failed to toggle feature:', error);
      setMessage({ type: 'error', text: 'Failed to update feature' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleTierChange = async (featureKey: string, tier: string) => {
    try {
      setSaving(true);
      await featureLockApi.updateFeature(featureKey, { minTier: tier });
      setFeatures(features.map(f => 
        f.key === featureKey ? { ...f, tier } : f
      ));
      setMessage({ type: 'success', text: 'Tier updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to update tier:', error);
      setMessage({ type: 'error', text: 'Failed to update tier' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const filteredFeatures = features.filter(f => {
    const matchesTab = activeTab === 'all' || 
      (activeTab === 'locked' && f.isLocked) || 
      (activeTab === 'unlocked' && !f.isLocked) ||
      f.tier === activeTab;
    const matchesCategory = selectedCategory === 'all' || f.category === selectedCategory;
    const matchesSearch = !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesCategory && matchesSearch;
  });

  if (isLoading || loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f5efe8'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 700,
            fontSize: '18px'
          }}>
            <i className="fa fa-lock"></i>
          </div>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e8ddd0',
            borderTopColor: '#8b5cf6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .tab-btn { transition: all 0.2s ease; cursor: pointer; }
        .tab-btn.active { background: linear-gradient(135deg, #8b5cf6, #7c3aed) !important; color: white !important; box-shadow: 0 4px 12px rgba(139,92,246,0.3); }
        .feature-card { transition: all 0.2s ease; }
        .feature-card:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0,0,0,0.1); }
      `}</style>
      
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <i className="fa fa-lock" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Feature Locks
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Manage feature access by subscription tier</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={async () => {
              if (!confirm('Reset all features to defaults? This will refresh the feature list from the database.')) return;
              try {
                await featureLockApi.resetToDefaults();
                setMessage({ type: 'success', text: 'Features reset successfully!' });
                loadFeatures();
              } catch (err) {
                setMessage({ type: 'error', text: 'Failed to reset features' });
              }
              setTimeout(() => setMessage(null), 3000);
            }}
            style={{
              padding: '10px 20px',
              background: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className="fa fa-refresh"></i> Reset Features
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '10px',
          background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: message.type === 'success' ? '#065f46' : '#991b1b',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '14px',
          fontWeight: 500
        }}>
          <i className={`fa ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        {['all', 'locked', 'unlocked', 'BASIC', 'STANDARD', 'PREMIUM'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              background: activeTab === tab ? '#8b5cf6' : '#f3f4f6',
              color: activeTab === tab ? 'white' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {tab === 'locked' && <i className="fa fa-lock" style={{ fontSize: '11px' }}></i>}
            {tab === 'unlocked' && <i className="fa fa-unlock" style={{ fontSize: '11px' }}></i>}
            {tab}
          </button>
        ))}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            fontSize: '13px',
            outline: 'none',
            background: '#fefcf9',
            cursor: 'pointer'
          }}
        >
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search features..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            fontSize: '14px',
            outline: 'none',
            width: '200px',
            background: '#fefcf9'
          }}
        />
      </div>

      {/* Features Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '16px'
      }}>
        {filteredFeatures.map((feature) => (
          <div
            key={feature.key}
            className="feature-card"
            style={{
              background: '#fefcf9',
              borderRadius: '14px',
              padding: '20px',
              border: '1px solid #f3f4f6',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  background: feature.isLocked 
                    ? 'linear-gradient(135deg, #fee2e2, #fecaca)' 
                    : 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <i 
                    className={`fa ${feature.isLocked ? 'fa-lock' : 'fa-unlock'}`} 
                    style={{ fontSize: '18px', color: feature.isLocked ? '#dc2626' : '#059669' }}
                  ></i>
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1f2937', margin: 0 }}>{feature.name}</h3>
                  <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>{feature.description}</p>
                </div>
              </div>
              <span style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '20px',
                background: TIER_COLORS[feature.tier]?.bg || '#f3f4f6',
                color: TIER_COLORS[feature.tier]?.text || '#6b7280',
                border: `1px solid ${TIER_COLORS[feature.tier]?.border || '#e8ddd0'}`
              }}>
                {feature.tier}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #f3f4f6' }}>
              <button
                onClick={() => handleToggleLock(feature.key)}
                disabled={saving}
                style={{
                  padding: '8px 14px',
                  background: feature.isLocked ? '#d1fae5' : '#fee2e2',
                  borderRadius: '8px',
                  border: 'none',
                  color: feature.isLocked ? '#059669' : '#dc2626',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className={`fa ${feature.isLocked ? 'fa-unlock' : 'fa-lock'}`}></i>
                {feature.isLocked ? 'Unlock' : 'Lock'}
              </button>
              <select
                value={feature.tier}
                onChange={(e) => handleTierChange(feature.key, e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '13px',
                  outline: 'none',
                  background: '#fefcf9',
                  cursor: 'pointer'
                }}
              >
                <option value="BASIC">Basic</option>
                <option value="STANDARD">Standard</option>
                <option value="PREMIUM">Premium</option>
              </select>
            </div>
          </div>
        ))}
        {filteredFeatures.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 20px' }}>
            <i className="fa fa-search" style={{ fontSize: '32px', color: '#d1d5db', marginBottom: '12px' }}></i>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>No features found</p>
          </div>
        )}
      </div>
    </div>
  );
}