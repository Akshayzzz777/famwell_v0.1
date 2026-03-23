import React from 'react';

import { RootNavigator } from './src/navigation/RootNavigator';

const DEV_MODE = true;

export default function App() {
  return <RootNavigator devMode={DEV_MODE} />;
}
