import React, { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { usePermissions } from '../utils/usePermissions';
import { Permission } from '../utils/permissions';
import { colors, spacing, borderRadius } from '../theme';

export function PermissionGuard({
  permission,
  fallback = null,
  children,
}: {
  permission: Permission;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can: hasPermission } = usePermissions();
  if (!hasPermission(permission)) return <>{fallback}</>;
  return <>{children}</>;
}

export function ReadOnlyOverlay({
  managePermission,
  children,
}: {
  managePermission: Permission;
  children: ReactNode;
}) {
  const { isReadOnly: checkReadOnly } = usePermissions();
  const readOnly = checkReadOnly(managePermission);

  if (!readOnly) return <>{children}</>;

  return (
    <View>
      <View style={styles.readOnlyBanner}>
        <Text style={styles.readOnlyIcon}>🔒</Text>
        <Text style={styles.readOnlyText}>Read-only — Contact the Director to make changes</Text>
      </View>
      <View style={styles.readOnlyContent}>
        {children}
      </View>
    </View>
  );
}

export function useRoutePermission(permission: Permission): boolean {
  const { can: hasPermission } = usePermissions();
  return hasPermission(permission);
}

const styles = StyleSheet.create({
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  readOnlyIcon: {
    fontSize: 14,
  },
  readOnlyText: {
    fontSize: 12,
    color: '#92400E',
    flex: 1,
  },
  readOnlyContent: {
    opacity: 0.85,
  },
});
