import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FamilyProfileScreen } from '../screens/FamilyProfileScreen';
import { FriendProfileScreen } from '../screens/FriendProfileScreen';
import { HomeDashboardScreen } from '../screens/HomeDashboardScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { ResultScreen } from '../screens/ResultScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { StatusScreen } from '../screens/StatusScreen';
import { UploadScreen } from '../screens/UploadScreen';
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
    </MainStack.Navigator>
  );
}

export function RootNavigator() {
  const [flow, setFlow] = useState<AppFlow>('splash');

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {flow === 'splash' ? (
          <SplashStackNavigator key="splash" onFinished={() => setFlow('auth')} />
        ) : flow === 'auth' ? (
          <AuthStackNavigator key="auth" onAuthenticated={() => setFlow('main')} />
        ) : (
          <MainStackNavigator key="main" />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
