import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type SplashStackParamList = {
  Splash: undefined;
};

export type AuthStackParamList = {
  Auth: undefined;
};

export type MainStackParamList = {
  HomeDashboard: undefined;
  FindDoctor: undefined;
  UploadDocuments: undefined;
  UploadDocumentsUpdated: undefined;
  StatusScreen: {
    jobId?: string;
    fileName?: string;
  } | undefined;
  ResultScreen: {
    jobId?: string;
  } | undefined;
  ConsultationChat: { initialMessage?: string } | undefined;
  PatientRecords: undefined;
  FamilyProfiles: undefined;
  FriendsAndFamily: undefined;
  AIInsights: undefined;
  StressAnalysis: { parameter?: string } | undefined;
};

export type MainRouteName = keyof MainStackParamList;

export type HomeDashboardProps = NativeStackScreenProps<MainStackParamList, 'HomeDashboard'>;
export type FindDoctorProps = NativeStackScreenProps<MainStackParamList, 'FindDoctor'>;
export type UploadDocumentsProps = NativeStackScreenProps<MainStackParamList, 'UploadDocuments'>;
export type UploadReviewProps = NativeStackScreenProps<MainStackParamList, 'UploadDocumentsUpdated'>;
export type StatusScreenProps = NativeStackScreenProps<MainStackParamList, 'StatusScreen'>;
export type ResultScreenProps = NativeStackScreenProps<MainStackParamList, 'ResultScreen'>;
export type ConsultationChatProps = NativeStackScreenProps<MainStackParamList, 'ConsultationChat'>;
export type PatientRecordsProps = NativeStackScreenProps<MainStackParamList, 'PatientRecords'>;
export type FamilyProfilesProps = NativeStackScreenProps<MainStackParamList, 'FamilyProfiles'>;
export type FriendsAndFamilyProps = NativeStackScreenProps<MainStackParamList, 'FriendsAndFamily'>;
export type AIInsightsProps = NativeStackScreenProps<MainStackParamList, 'AIInsights'>;
export type StressAnalysisProps = NativeStackScreenProps<MainStackParamList, 'StressAnalysis'>;

export const mainNavItems: Array<{
  label: string;
  route: MainRouteName;
  iconFamily: 'MaterialIcons' | 'MaterialCommunityIcons';
  iconName: string;
}> = [
  { label: 'Home', route: 'HomeDashboard', iconFamily: 'MaterialIcons', iconName: 'home-filled' },
  { label: 'Records', route: 'PatientRecords', iconFamily: 'MaterialCommunityIcons', iconName: 'file-document-outline' },
  { label: 'AI Insights', route: 'AIInsights', iconFamily: 'MaterialIcons', iconName: 'auto-awesome' },
  { label: 'Doctors', route: 'FindDoctor', iconFamily: 'MaterialCommunityIcons', iconName: 'stethoscope' },
  { label: 'Profile', route: 'FamilyProfiles', iconFamily: 'MaterialIcons', iconName: 'account-circle' },
];
