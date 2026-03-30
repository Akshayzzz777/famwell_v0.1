import React, { useCallback, useMemo, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AppProvider, useApp } from './state/AppContext';
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
import type { AuthStackParamList, MainStackParamList, SplashStackParamList } from './navigation';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

type Flow = 'splash' | 'auth' | 'main';

const SplashStack = createNativeStackNavigator<SplashStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

function SplashNavigator({ onDone }: { onDone: () => void }) {
  return (
    <SplashStack.Navigator screenOptions={{ headerShown: false }}>
      <SplashStack.Screen name="Splash">{() => <SplashScreen onFinished={onDone} />}</SplashStack.Screen>
    </SplashStack.Navigator>
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
  const initialFlow = useMemo<Flow>(() => (bootstrapReady ? (isAuthenticated ? 'main' : 'auth') : 'splash'), [bootstrapReady, isAuthenticated]);
  const [flow, setFlow] = useState<Flow>(initialFlow);

  const syncFlow = useCallback(() => {
    setFlow(isAuthenticated ? 'main' : 'auth');
  }, [isAuthenticated]);

  React.useEffect(() => {
    syncFlow();
  }, [syncFlow]);

  return (
    <NavigationContainer>
      {flow === 'splash' ? (
        <SplashNavigator onDone={syncFlow} />
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
