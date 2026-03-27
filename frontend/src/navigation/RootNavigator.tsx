import React, { useCallback, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DevPanel } from '../components/DevPanel';
import { RoleProvider, useRole } from '../context/RoleContext';
import { ChatScreen } from '../screens/ChatScreen';
import { ConnectionsScreen } from '../screens/ConnectionsScreen';
import { FamilyProfileScreen } from '../screens/FamilyProfileScreen';
import { FriendProfileScreen } from '../screens/FriendProfileScreen';
import { HomeDashboardScreen } from '../screens/HomeDashboardScreen';
import { InboxScreen } from '../screens/InboxScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { ResultScreen } from '../screens/ResultScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { StatusScreen } from '../screens/StatusScreen';
import { UploadScreen } from '../screens/UploadScreen';
import { loadPersistedAccess, setUnauthorizedHandler } from '../services/api';
import type { AuthStackParamList, MainStackParamList, SplashStackParamList } from './types';

type AppFlow = 'splash' | 'auth' | 'main';

const SplashStack = createNativeStackNavigator<SplashStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

function SplashStackNavigator({ onFinished }: { onFinished: () => void }) {
  return (
    <SplashStack.Navigator screenOptions={{ headerShown: false }}>
      <SplashStack.Screen name="SplashScreen">
        {() => <SplashScreen onFinished={onFinished} />}
      </SplashStack.Screen>
    </SplashStack.Navigator>
  );
}

function AuthStackNavigator({ onAuthenticated }: { onAuthenticated: () => void }) {
  return (
    <AuthStack.Navigator initialRouteName="LoginScreen" screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="LoginScreen">
        {(props) => <LoginScreen {...props} onAuthenticated={onAuthenticated} />}
      </AuthStack.Screen>
      <AuthStack.Screen name="SignInScreen">
        {(props) => <SignInScreen {...props} onAuthenticated={onAuthenticated} />}
      </AuthStack.Screen>
    </AuthStack.Navigator>
  );
}

function MainStackNavigator() {
  return (
    <MainStack.Navigator initialRouteName="HomeDashboard" screenOptions={{ headerShown: false }}>
      <MainStack.Screen component={HomeDashboardScreen} name="HomeDashboard" />
      <MainStack.Screen component={FamilyProfileScreen} name="FamilyProfileScreen" />
      <MainStack.Screen component={FriendProfileScreen} name="FriendProfileScreen" />
      <MainStack.Screen component={UploadScreen} name="UploadScreen" />
      <MainStack.Screen component={StatusScreen} name="StatusScreen" />
      <MainStack.Screen component={ResultScreen} name="ResultScreen" />
      <MainStack.Screen component={InboxScreen} name="InboxScreen" />
      <MainStack.Screen component={ChatScreen} name="ChatScreen" />
      <MainStack.Screen component={ConnectionsScreen} name="ConnectionsScreen" />
    </MainStack.Navigator>
  );
}

function NavigationShell({ devMode }: { devMode: boolean }) {
  const { clearRoleState, hasStoredToken, refreshPersistedAccess, selectedRole } = useRole();
  const [flow, setFlow] = useState<AppFlow>('splash');

  const syncFlowFromAccess = useCallback(() => {
    const persisted = loadPersistedAccess();
    refreshPersistedAccess();
    setFlow(persisted.role && persisted.token ? 'main' : 'auth');
  }, [refreshPersistedAccess]);

  useEffect(() => {
    setUnauthorizedHandler((failure) => {
      clearRoleState(failure.message);
      setFlow('auth');
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [clearRoleState]);

  useEffect(() => {
    if (flow === 'main' && (!selectedRole || !hasStoredToken)) {
      setFlow('auth');
    }
  }, [flow, hasStoredToken, selectedRole]);

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        {flow === 'splash' ? (
          <SplashStackNavigator key="splash" onFinished={syncFlowFromAccess} />
        ) : flow === 'auth' ? (
          <AuthStackNavigator key="auth" onAuthenticated={() => setFlow('main')} />
        ) : (
          <MainStackNavigator key="main" />
        )}
      </NavigationContainer>
      {devMode ? <DevPanel onAfterRoleChange={syncFlowFromAccess} /> : null}
    </View>
  );
}

export function RootNavigator({ devMode }: { devMode: boolean }) {
  return (
    <SafeAreaProvider>
      <RoleProvider>
        <NavigationShell devMode={devMode} />
      </RoleProvider>
    </SafeAreaProvider>
  );
}
