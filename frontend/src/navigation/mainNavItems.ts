import type { MainRouteName } from './types';

export const mainNavItems: Array<{ label: string; route: MainRouteName }> = [
  { label: 'Home', route: 'HomeDashboard' },
  { label: 'Family', route: 'FamilyProfileScreen' },
  { label: 'Upload', route: 'UploadScreen' },
  { label: 'Status', route: 'StatusScreen' },
  { label: 'Results', route: 'ResultScreen' },
];
