'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { institutionApi } from '@/lib/institution-api';
import { INSTITUTION_TYPE_LABELS, InstitutionTypeCode } from '@/lib/institution-types';

export default function InstitutionTypesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['institution-types'],
    queryFn: () => institutionApi.getSuperAdminTypes().then(res => res.data?.data || res.data),
  });

  const types = Array.isArray(data) ? data : [];

  if (isLoading) {
    return (
      <div style={{ padding: '24px' }}>
        <p>Loading institution types...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <p style={{ color: 'red' }}>Error loading institution types</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px' }}>
            Institution Types
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
            Manage institution types, their modules, features, roles, and dashboards
          </p>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
        gap: '20px'
      }}>
        {types.map((type: any) => (
          <Link
            key={type.id}
            href={`/super-admin/institution-types/${type.code}`}
            style={{
              background: '#fefcf9',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid #e8ddd0',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 10px 40px rgba(0,0,0,0.1)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 700,
                color: 'white',
                background: type.code === 'PRIMARY_SCHOOL' ? '#059669' :
                            type.code === 'SECONDARY_SCHOOL' ? '#3b82f6' :
                            type.code === 'ADVANCED_SECONDARY' ? '#a855f7' :
                            type.code === 'COLLEGE' ? '#06b6d4' :
                            '#d97706'
              }}>
                {type.name.charAt(0)}
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 2px' }}>
                  {type.name}
                </h3>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                  {type.code}
                </p>
              </div>
              {!type.isActive && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: '#fee2e2',
                  color: '#dc2626'
                }}>
                  Inactive
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              {type._count && (
                <>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#059669' }}>
                      {type._count.modules || 0}
                    </p>
                    <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>Modules</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#3b82f6' }}>
                      {type._count.features || 0}
                    </p>
                    <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>Features</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#8b5cf6' }}>
                      {type._count.roles || 0}
                    </p>
                    <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>Roles</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#06b6d4' }}>
                      {type._count.dashboards || 0}
                    </p>
                    <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>Dashboards</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#f59e0b' }}>
                      {type._count.schools || 0}
                    </p>
                    <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>Schools</p>
                  </div>
                </>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
