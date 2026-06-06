'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { institutionApi } from '@/lib/institution-api';
import { INSTITUTION_TYPE_LABELS, InstitutionTypeCode } from '@/lib/institution-types';

export default function InstitutionTypeDetailPage() {
  const params = useParams();
  const code = params.code as string;

  const { data: typeData, isLoading: typeLoading } = useQuery({
    queryKey: ['institution-type', code],
    queryFn: () => institutionApi.getTypeByCode(code).then(res => res.data?.data || res.data),
    enabled: !!code,
  });

  const { data: modules } = useQuery({
    queryKey: ['institution-type-modules', code],
    queryFn: () => institutionApi.getTypeModules(code).then(res => res.data?.data || res.data),
    enabled: !!code,
  });

  const { data: features } = useQuery({
    queryKey: ['institution-type-features', code],
    queryFn: () => institutionApi.getTypeFeatures(code).then(res => res.data?.data || res.data),
    enabled: !!code,
  });

  const { data: roles } = useQuery({
    queryKey: ['institution-type-roles', code],
    queryFn: () => institutionApi.getTypeRoles(code).then(res => res.data?.data || res.data),
    enabled: !!code,
  });

  const { data: dashboards } = useQuery({
    queryKey: ['institution-type-dashboards', code],
    queryFn: () => institutionApi.getTypeDashboards(code).then(res => res.data?.data || res.data),
    enabled: !!code,
  });

  const { data: settings } = useQuery({
    queryKey: ['institution-type-settings', code],
    queryFn: () => institutionApi.getTypeSettings(code).then(res => res.data?.data || res.data),
    enabled: !!code,
  });

  if (typeLoading) return <div style={{ padding: '24px' }}>Loading...</div>;

  const moduleList = Array.isArray(modules) ? modules : [];
  const featureList = Array.isArray(features) ? features : [];
  const roleList = Array.isArray(roles) ? roles : [];
  const dashboardList = Array.isArray(dashboards) ? dashboards : [];
  const settingList = Array.isArray(settings) ? settings : [];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link
          href="/super-admin/institution-types"
          style={{
            color: '#6b7280',
            textDecoration: 'none',
            fontSize: '14px',
            marginBottom: '8px',
            display: 'inline-block'
          }}
        >
          <i className="fa fa-arrow-left" style={{ marginRight: '6px' }}></i>
          Back to Institution Types
        </Link>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0 4px' }}>
          {INSTITUTION_TYPE_LABELS[code as InstitutionTypeCode] || code}
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>{code}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {typeData?.description && (
          <div style={{
            background: '#fefcf9',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #e8ddd0'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px', color: '#6b7280' }}>
              Description
            </h3>
            <p style={{ fontSize: '14px', margin: 0 }}>{typeData.description}</p>
          </div>
        )}
        <div style={{
          background: '#fefcf9',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e8ddd0'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px', color: '#6b7280' }}>
            Status
          </h3>
          <span style={{
            fontSize: '13px',
            fontWeight: 600,
            padding: '4px 12px',
            borderRadius: '12px',
            background: typeData?.isActive ? '#dcfce7' : '#fee2e2',
            color: typeData?.isActive ? '#16a34a' : '#dc2626'
          }}>
            {typeData?.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <Section title="Modules" count={moduleList.length} color="#059669">
          {moduleList.map((m: any, i: number) => (
            <Item key={m.id || i} label={m.module?.name || m.name} sub={m.module?.code || m.code} active={m.isActive !== false} />
          ))}
        </Section>

        <Section title="Features" count={featureList.length} color="#3b82f6">
          {featureList.map((f: any, i: number) => (
            <Item key={f.id || i} label={f.feature?.name || f.name} sub={f.feature?.code || f.code} active={f.isEnabled !== false} />
          ))}
        </Section>

        <Section title="Roles" count={roleList.length} color="#8b5cf6">
          {roleList.map((r: any, i: number) => (
            <Item key={r.id || i} label={r.role?.name || r.name} sub={r.role?.code || r.code} active={r.isActive !== false} />
          ))}
        </Section>

        <Section title="Dashboards" count={dashboardList.length} color="#06b6d4">
          {dashboardList.map((d: any, i: number) => (
            <Item key={d.id || i} label={d.dashboard?.name || d.name} sub={d.dashboard?.slug || d.slug} active={true} />
          ))}
        </Section>
      </div>

      {settingList.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <Section title="Settings" count={settingList.length} color="#f59e0b">
            {settingList.map((s: any, i: number) => (
              <div
                key={s.id || i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: i < settingList.length - 1 ? '1px solid #f3f4f6' : 'none'
                }}
              >
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 500, margin: 0 }}>{s.key}</p>
                  {s.isRequired && (
                    <span style={{ fontSize: '11px', color: '#dc2626' }}>Required</span>
                  )}
                </div>
                <code style={{
                  fontSize: '12px',
                  background: '#f3f4f6',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  color: '#374151'
                }}>
                  {typeof s.value === 'string' ? s.value : JSON.stringify(s.value)}
                </code>
              </div>
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, count, color, children }: { title: string; count: number; color: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fefcf9',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid #e8ddd0'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: '#374151' }}>{title}</h3>
        <span style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'white',
          background: color,
          padding: '2px 10px',
          borderRadius: '10px'
        }}>
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>None configured</p>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}

function Item({ label, sub, active }: { label: string; sub?: string; active: boolean }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 0',
      borderBottom: '1px solid #f3f4f6'
    }}>
      <div>
        <p style={{ fontSize: '14px', fontWeight: 500, margin: 0 }}>{label}</p>
        {sub && <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>{sub}</p>}
      </div>
      {!active && (
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
  );
}
