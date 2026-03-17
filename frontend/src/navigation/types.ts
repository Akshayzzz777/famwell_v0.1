import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type SplashStackParamList = {
  SplashScreen: undefined;
};

export type AuthStackParamList = {
  LoginScreen: undefined;
  SignInScreen: undefined;
};

export type MainStackParamList = {
  HomeDashboard: undefined;
  FamilyProfileScreen: undefined;
  FriendProfileScreen: undefined;
  UploadScreen: undefined;
  StatusScreen: {
    jobId?: string;
    fileName?: string;
  } | undefined;
  ResultScreen: {
    jobId?: string;
  } | undefined;
};

export type MainRouteName = keyof MainStackParamList;

export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'LoginScreen'>;
export type SignInScreenProps = NativeStackScreenProps<AuthStackParamList, 'SignInScreen'>;
export type HomeDashboardProps = NativeStackScreenProps<MainStackParamList, 'HomeDashboard'>;
export type FamilyProfileProps = NativeStackScreenProps<MainStackParamList, 'FamilyProfileScreen'>;
export type FriendProfileProps = NativeStackScreenProps<MainStackParamList, 'FriendProfileScreen'>;
export type UploadScreenProps = NativeStackScreenProps<MainStackParamList, 'UploadScreen'>;
export type StatusScreenProps = NativeStackScreenProps<MainStackParamList, 'StatusScreen'>;
export type ResultScreenProps = NativeStackScreenProps<MainStackParamList, 'ResultScreen'>;
