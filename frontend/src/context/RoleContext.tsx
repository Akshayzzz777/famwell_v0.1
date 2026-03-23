import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  clearPersistedAccess,
  loadPersistedAccess,
  loginUser,
  persistAccessToken,
  persistSelectedRole,
  persistSessionUser,
  registerUser,
  type SessionUser,
  type UiRole,
} from '../services/api';

export type DevScenario = 'live' | 'empty' | 'error';

type RoleContextValue = {
  beginSession: () => Promise<boolean>;
  clearRoleState: (message?: string) => void;
  clearSessionError: () => void;
  currentUser: SessionUser | null;
  devScenario: DevScenario;
  hasStoredToken: boolean;
  login: (input: { email: string; password: string }) => Promise<boolean>;
  refreshPersistedAccess: () => void;
  register: (input: { fullName: string; email: string; phoneNumber: string; password: string }) => Promise<boolean>;
  selectedRole: UiRole | null;
  sessionBusy: boolean;
  sessionError: string | null;
  setDevScenario: (scenario: DevScenario) => void;
  setSelectedRole: (role: UiRole) => void;
};

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [selectedRole, setSelectedRoleState] = useState<UiRole | null>(null);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [hasStoredToken, setHasStoredToken] = useState(false);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [devScenario, setDevScenarioState] = useState<DevScenario>('live');

  const refreshPersistedAccess = useCallback(() => {
    const persisted = loadPersistedAccess();
    setSelectedRoleState(persisted.role);
    setCurrentUser(persisted.user);
    setHasStoredToken(Boolean(persisted.token));
  }, []);

  useEffect(() => {
    refreshPersistedAccess();
  }, [refreshPersistedAccess]);

  const setSelectedRole = useCallback((role: UiRole) => {
    persistSelectedRole(role);
    setSelectedRoleState(role);
    setSessionError(null);
  }, []);

  const clearRoleState = useCallback((message?: string) => {
    clearPersistedAccess();
    setSelectedRoleState(null);
    setCurrentUser(null);
    setHasStoredToken(false);
    setSessionError(message ?? null);
  }, []);

  const clearSessionError = useCallback(() => {
    setSessionError(null);
  }, []);

  const setDevScenario = useCallback((scenario: DevScenario) => {
    setDevScenarioState(scenario);
  }, []);

  const beginSession = useCallback(async () => {
    const persisted = loadPersistedAccess();
    setSelectedRoleState(persisted.role);
    setCurrentUser(persisted.user);
    setHasStoredToken(Boolean(persisted.token));

    if (!persisted.role) {
      setSessionError('Select a role to continue.');
      return false;
    }

    if (!persisted.token) {
      setSessionError('Login is required to continue.');
      return false;
    }

    setSessionError(null);
    return true;
  }, []);

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      if (!selectedRole) {
        setSessionError('Select a role to continue.');
        return false;
      }

      try {
        setSessionBusy(true);
        setSessionError(null);

        const session = await loginUser({
          email: input.email,
          password: input.password,
          role: selectedRole,
        });

        persistSelectedRole(selectedRole);
        persistAccessToken(session.accessToken);
        persistSessionUser(session.user);
        setCurrentUser(session.user);
        setHasStoredToken(true);
        setSessionError(null);
        return true;
      } catch (failure: any) {
        setSessionError(failure?.message || 'Login failed.');
        return false;
      } finally {
        setSessionBusy(false);
      }
    },
    [selectedRole]
  );

  const register = useCallback(
    async (input: { fullName: string; email: string; phoneNumber: string; password: string }) => {
      const role = selectedRole ?? 'PATIENT';

      try {
        setSessionBusy(true);
        setSessionError(null);

        const session = await registerUser({
          fullName: input.fullName,
          email: input.email,
          phoneNumber: input.phoneNumber,
          password: input.password,
          role,
        });

        persistSelectedRole(role);
        persistAccessToken(session.accessToken);
        persistSessionUser(session.user);
        setSelectedRoleState(role);
        setCurrentUser(session.user);
        setHasStoredToken(true);
        setSessionError(null);
        return true;
      } catch (failure: any) {
        setSessionError(failure?.message || 'Account creation failed.');
        return false;
      } finally {
        setSessionBusy(false);
      }
    },
    [selectedRole]
  );

  const value = useMemo<RoleContextValue>(
    () => ({
      beginSession,
      clearRoleState,
      clearSessionError,
      currentUser,
      devScenario,
      hasStoredToken,
      login,
      refreshPersistedAccess,
      register,
      selectedRole,
      sessionBusy,
      sessionError,
      setDevScenario,
      setSelectedRole,
    }),
    [
      beginSession,
      clearRoleState,
      clearSessionError,
      currentUser,
      devScenario,
      hasStoredToken,
      login,
      refreshPersistedAccess,
      register,
      selectedRole,
      sessionBusy,
      sessionError,
      setDevScenario,
      setSelectedRole,
    ]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);

  if (!context) {
    throw new Error('useRole must be used within RoleProvider');
  }

  return context;
}
