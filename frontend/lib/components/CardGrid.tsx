"use client";

import React from 'react';

interface CardItem {
  id: string;
  name: string;
  description?: string;
  code?: string;
  icon?: string;
  color?: string;
  stats?: { label: string; value: string | number }[];
  actions?: { label: string; icon: string; onClick: () => void; variant?: 'primary' | 'secondary' | 'danger' }[];
}

interface CardGridProps {
  title?: string;
  subtitle?: string;
  items: CardItem[];
  loading?: boolean;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  onAdd?: () => void;
  addLabel?: string;
}

export function CardGrid({
  title,
  subtitle,
  items,
  loading,
  emptyIcon = '📦',
  emptyTitle = 'No Items',
  emptyMessage = 'Nothing to display yet.',
  onAdd,
  addLabel = 'Add New',
}: CardGridProps) {
  const colors = [
    { from: 'from-blue-500', to: 'to-blue-700', bg: 'bg-blue-100', text: 'text-blue-700' },
    { from: 'from-green-500', to: 'to-green-700', bg: 'bg-green-100', text: 'text-green-700' },
    { from: 'from-purple-500', to: 'to-purple-700', bg: 'bg-purple-100', text: 'text-purple-700' },
    { from: 'from-pink-500', to: 'to-pink-700', bg: 'bg-pink-100', text: 'text-pink-700' },
    { from: 'from-indigo-500', to: 'to-indigo-700', bg: 'bg-indigo-100', text: 'text-indigo-700' },
    { from: 'from-amber-500', to: 'to-amber-700', bg: 'bg-amber-100', text: 'text-amber-700' },
    { from: 'from-teal-500', to: 'to-teal-700', bg: 'bg-teal-100', text: 'text-teal-700' },
    { from: 'from-red-500', to: 'to-red-700', bg: 'bg-red-100', text: 'text-red-700' },
  ];

  const getColorSet = (name: string) => {
    const index = name?.charCodeAt(0) || 0;
    return colors[index % colors.length];
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          {title && <h2 className="text-lg font-bold text-gray-900">{title}</h2>}
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-xl hover:from-indigo-600 hover:to-blue-700 transition-all shadow-sm text-sm font-medium flex items-center gap-2"
          >
            <span className="text-lg">+</span> {addLabel}
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-2xl shadow-lg p-6 animate-pulse">
              <div className="h-12 w-12 bg-gray-200 rounded-xl mb-4"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : !items || items.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">{emptyIcon}</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{emptyTitle}</h3>
          <p className="text-gray-500 mb-4">{emptyMessage}</p>
          {onAdd && (
            <button
              onClick={onAdd}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              + Add {addLabel}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item, index) => {
            const colorSet = getColorSet(item.name);
            return (
              <div key={item.id || index} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow group">
                <div className={`h-2 bg-gradient-to-r ${colorSet.from} ${colorSet.to}`}></div>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gradient-to-br ${colorSet.from} ${colorSet.to} text-white shadow-md`}>
                      {item.icon || item.name?.[0] || '📦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{item.name}</h3>
                      {item.code && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${colorSet.bg} ${colorSet.text}`}>
                          {item.code}
                        </span>
                      )}
                      {item.description && (
                        <p className="text-sm text-gray-500 mt-1 truncate">{item.description}</p>
                      )}
                    </div>
                  </div>

                  {item.stats && item.stats.length > 0 && (
                    <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-2">
                      {item.stats.map((stat, i) => (
                        <div key={i} className="text-center">
                          <div className="text-lg font-bold text-gray-900">{stat.value}</div>
                          <div className="text-xs text-gray-500">{stat.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {item.actions && item.actions.length > 0 && (
                    <div className="mt-4 pt-4 border-t flex gap-2">
                      {item.actions.map((action, i) => (
                        <button
                          key={i}
                          onClick={action.onClick}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            action.variant === 'danger' 
                              ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                              : action.variant === 'primary'
                              ? `bg-gradient-to-r ${colorSet.from} ${colorSet.to} text-white`
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {action.icon} {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SimpleCard({ 
  title, 
  icon, 
  children, 
  color = 'indigo',
  actions 
}: { 
  title: string; 
  icon?: string; 
  children: React.ReactNode;
  color?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className={`h-2 bg-gradient-to-r from-${color}-500 to-${color}-600`}></div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {icon && <span className="text-2xl">{icon}</span>}
            <h3 className="font-bold text-gray-900">{title}</h3>
          </div>
          {actions}
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatCard({ 
  label, 
  value, 
  icon, 
  trend,
  color = 'indigo' 
}: { 
  label: string; 
  value: string | number; 
  icon?: string;
  trend?: { value: string; up: boolean };
  color?: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {trend && (
            <p className={`text-xs mt-1 ${trend.up ? 'text-green-600' : 'text-red-600'}`}>
              {trend.up ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-${color}-100 text-${color}-600 text-xl`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}