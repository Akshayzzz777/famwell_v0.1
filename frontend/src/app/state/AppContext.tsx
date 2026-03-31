import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  clearPersistedAccess,
  loadPersistedAccess,
  loginUser,
  persistAccessToken,
  persistSelectedRole,
  persistSessionUser,
  registerUser,
  setUnauthorizedHandler,
  type ApiFailure,
  type PickedPdf,
  type SessionUser,
  type UiRole,
} from '../lib/api';
import { queryClient } from '../RootNavigator';

export type ActiveJob = {
  jobId: string;
  fileId?: string;
  fileName?: string;
  uploadUrl?: string;
};

type AppContextValue = {
  activeJob: ActiveJob | null;
  bootstrapReady: boolean;
  clearSessionError: () => void;
  currentUser: SessionUser | null;
  healthScore: number | null;
  hasStoredToken: boolean;
  isAuthenticated: boolean;
  logout: () => void;
  pendingUpload: PickedPdf | null;
  selectedRole: UiRole | null;
  sessionBusy: boolean;
  sessionError: string | null;
  setActiveJob: (job: ActiveJob | null) => void;
  setHealthScore: (score: number | null) => void;
  setPendingUpload: (file: PickedPdf | null) => void;
  setSelectedRole: (role: UiRole) => void;
  signIn: (input: { email: string; password: string }) => Promise<boolean>;
  signUp: (input: { fullName: string; email: string; phoneNumber: string; password: string }) => Promise<boolean>;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [selectedRole, setSelectedRoleState] = useState<UiRole | null>(null);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [hasStoredToken, setHasStoredToken] = useState(false);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [bootstrapReady, setBootstrapReady] = useState(false);
  const [activeJob, setActiveJobState] = useState<ActiveJob | null>(null);
  const [pendingUpload, setPendingUploadState] = useState<PickedPdf | null>(null);
  const [healthScore, setHealthScoreState] = useState<number | null>(null);

  const syncPersistedAccess = useCallback(() => {
    const persisted = loadPersistedAccess();
    setSelectedRoleState(persisted.role);
    setCurrentUser(persisted.user);
    setHasStoredToken(Boolean(persisted.token));
    setBootstrapReady(true);
  }, []);

  useEffect(() => {
    syncPersistedAccess();
  }, [syncPersistedAccess]);

  useEffect(() => {
    setUnauthorizedHandler((failure: ApiFailure) => {
      clearPersistedAccess();
      queryClient.clear();
      setSelectedRoleState(null);
      setCurrentUser(null);
      setHasStoredToken(false);
      setActiveJobState(null);
      setPendingUploadState(null);
    setHealthScoreState(null);
      setSessionError(failure.message);
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  const setSelectedRole = useCallback((role: UiRole) => {
    persistSelectedRole(role);
    setSelectedRoleState(role);
    setSessionError(null);
  }, []);

  const clearSessionError = useCallback(() => {
    setSessionError(null);
  }, []);

  const logout = useCallback(() => {
    clearPersistedAccess();
    queryClient.clear();
    setSelectedRoleState(null);
    setCurrentUser(null);
    setHasStoredToken(false);
    setActiveJobState(null);
    setPendingUploadState(null);
    setHealthScoreState(null);
    setSessionError(null);
  }, []);

  const signIn = useCallback(
    async (input: { email: string; password: string }) => {
      if (!selectedRole) {
        setSessionError('Select whether you are signing in as a patient or doctor.');
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
        queryClient.clear();
        return true;
      } catch (error) {
        setSessionError((error as ApiFailure)?.message || 'Unable to sign in.');
        return false;
      } finally {
        setSessionBusy(false);
      }
    },
    [selectedRole]
  );

  const signUp = useCallback(
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
        queryClient.clear();
        return true;
      } catch (error) {
        setSessionError((error as ApiFailure)?.message || 'Unable to create account.');
        return false;
      } finally {
        setSessionBusy(false);
      }
    },
    [selectedRole]
  );

    const value = useMemo<AppContextValue>(
    () => ({
      activeJob,
      bootstrapReady,
      clearSessionError,
      currentUser,
      healthScore,
      hasStoredToken,
      isAuthenticated: Boolean(selectedRole && hasStoredToken),
      logout,
      pendingUpload,
      selectedRole,
      sessionBusy,
      sessionError,
      setActiveJob: setActiveJobState,
      setHealthScore: setHealthScoreState,
      setPendingUpload: setPendingUploadState,
      setSelectedRole,
      signIn,
      signUp,
    }),
    [
      activeJob,
      bootstrapReady,
      clearSessionError,
      currentUser,
      healthScore,
      hasStoredToken,
      logout,
      pendingUpload,
      selectedRole,
      sessionBusy,
      sessionError,
      setSelectedRole,
      setHealthScoreState,
      signIn,
      signUp,
    ]
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }

  return context;
}







