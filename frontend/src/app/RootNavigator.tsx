import React, { useCallback, useMemo, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AppProvider, useApp } from './state/AppContext';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { AuthScreen } from './screens/AuthScreen';
import { SplashScreen } from './screens/SplashScreen';
import { HomeDashboardScreen } from './screens/HomeDashboardScreen';
import { FindDoctorScreen } from './screens/FindDoctorScreen';
import { UploadDocumentsScreen } from './screens/UploadDocumentsScreen';
import { UploadReviewScreen } from './screens/UploadReviewScreen';
import { StatusScreen } from './screens/StatusScreen';
import { PrescriptionSummaryScreen } from './screens/PrescriptionSummaryScreen';
import { ConsultationChatScreen } from './screens/ConsultationChatScreen';
import { PatientRecordsScreen } from './screens/PatientRecordsScreen';
import { FamilyProfilesScreen } from './screens/FamilyProfilesScreen';
import { FriendsAndFamilyScreen } from './screens/FriendsAndFamilyScreen';
import { AIInsightsScreen } from './screens/AIInsightsScreen';
import { StressAnalysisScreen } from './screens/StressAnalysisScreen';
import type { AuthStackParamList, MainStackParamList, OnboardingStackParamList, SplashStackParamList } from './navigation';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      retry: 1,
    },
  },
});

type Flow = 'splash' | 'onboarding' | 'auth' | 'main';

const ONBOARDING_DONE_KEY = 'famwell_onboarding_done';

const SplashStack = createNativeStackNavigator<SplashStackParamList>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

function SplashNavigator({ onDone }: { onDone: () => void }) {
  return (
    <SplashStack.Navigator screenOptions={{ headerShown: false }}>
      <SplashStack.Screen name="Splash">{() => <SplashScreen onFinished={onDone} />}</SplashStack.Screen>
    </SplashStack.Navigator>
  );
}

function OnboardingNavigator({ onDone }: { onDone: () => void }) {
  return (
    <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingStack.Screen name="Onboarding">{() => <OnboardingScreen onDone={onDone} />}</OnboardingStack.Screen>
    </OnboardingStack.Navigator>
  );
}

function AuthNavigator({ onAuthenticated }: { onAuthenticated: () => void }) {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Auth">{() => <AuthScreen onAuthenticated={onAuthenticated} />}</AuthStack.Screen>
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }} initialRouteName="HomeDashboard">
      <MainStack.Screen component={HomeDashboardScreen} name="HomeDashboard" />
      <MainStack.Screen component={FindDoctorScreen} name="FindDoctor" />
      <MainStack.Screen component={UploadDocumentsScreen} name="UploadDocuments" />
      <MainStack.Screen component={UploadReviewScreen} name="UploadDocumentsUpdated" />
      <MainStack.Screen component={StatusScreen} name="StatusScreen" />
      <MainStack.Screen component={PrescriptionSummaryScreen} name="ResultScreen" />
      <MainStack.Screen component={ConsultationChatScreen} name="ConsultationChat" />
      <MainStack.Screen component={PatientRecordsScreen} name="PatientRecords" />
      <MainStack.Screen component={FamilyProfilesScreen} name="FamilyProfiles" />
      <MainStack.Screen component={FriendsAndFamilyScreen} name="FriendsAndFamily" />
      <MainStack.Screen component={AIInsightsScreen} name="AIInsights" />
      <MainStack.Screen component={StressAnalysisScreen} name="StressAnalysis" />
    </MainStack.Navigator>
  );
}

function NavigationShell() {
  const { bootstrapReady, isAuthenticated } = useApp();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  // Check onboarding status on mount
  React.useEffect(() => {
    try {
      const done = typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem(ONBOARDING_DONE_KEY)
        : null;
      setOnboardingDone(done === 'true');
    } catch {
      setOnboardingDone(false);
    }
  }, []);

  const initialFlow = useMemo<Flow>(() => {
    if (!bootstrapReady) return 'splash';
    if (isAuthenticated) return 'main';
    if (onboardingDone === false) return 'onboarding';
    return 'auth';
  }, [bootstrapReady, isAuthenticated, onboardingDone]);
  const [flow, setFlow] = useState<Flow>(initialFlow);

  const syncFlow = useCallback(() => {
    if (isAuthenticated) {
      setFlow('main');
    } else if (onboardingDone === false) {
      setFlow('onboarding');
    } else {
      setFlow('auth');
    }
  }, [isAuthenticated, onboardingDone]);

  React.useEffect(() => {
    syncFlow();
  }, [syncFlow]);

  const handleOnboardingDone = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(ONBOARDING_DONE_KEY, 'true');
      }
    } catch { /* noop */ }
    setOnboardingDone(true);
    setFlow('auth');
  }, []);

  // Wait until onboarding status is resolved
  if (onboardingDone === null && !bootstrapReady) {
    return (
      <NavigationContainer>
        <SplashNavigator onDone={() => {}} />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      {flow === 'splash' ? (
        <SplashNavigator onDone={syncFlow} />
      ) : flow === 'onboarding' ? (
        <OnboardingNavigator onDone={handleOnboardingDone} />
      ) : flow === 'auth' ? (
        <AuthNavigator onAuthenticated={() => setFlow('main')} />
      ) : (
        <MainNavigator />
      )}
    </NavigationContainer>
  );
}

export function RootNavigator() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <NavigationShell />
        </AppProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
