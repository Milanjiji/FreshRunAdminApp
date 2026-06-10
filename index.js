/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import CodePush from '@revopush/react-native-code-push';

const CodePushApp = CodePush({
  checkFrequency: CodePush.CheckFrequency.ON_APP_RESUME,
  installMode: CodePush.InstallMode.IMMEDIATE,
})(App);

AppRegistry.registerComponent(appName, () => CodePushApp);
