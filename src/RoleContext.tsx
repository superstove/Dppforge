import { createContext, useContext, useState, type ReactNode } from 'react';

export type OperatorRole = 'engineer' | 'reviewer' | 'admin';

interface RoleContextValue {
  role: OperatorRole;
  setRole: (r: OperatorRole) => void;
  canApprove: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canCreate: boolean;
  roleLabel: string;
}

const ROLE_LABELS: Record<OperatorRole, string> = {
  engineer: 'Product Passport Engineer',
  reviewer: 'Reviewer / Approver',
  admin: 'Admin',
};

const RoleContext = createContext<RoleContextValue>({
  role: 'engineer',
  setRole: () => {},
  canApprove: false,
  canDelete: false,
  canEdit: true,
  canCreate: true,
  roleLabel: 'Product Passport Engineer',
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<OperatorRole>(
    () => (localStorage.getItem('dpp_operator_role') as OperatorRole) || 'engineer',
  );

  const handleSetRole = (r: OperatorRole) => {
    setRole(r);
    localStorage.setItem('dpp_operator_role', r);
  };

  const value: RoleContextValue = {
    role,
    setRole: handleSetRole,
    canApprove: role === 'reviewer' || role === 'admin',
    canDelete: role === 'admin',
    canEdit: role === 'engineer' || role === 'admin',
    canCreate: role === 'engineer' || role === 'admin',
    roleLabel: ROLE_LABELS[role],
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}
