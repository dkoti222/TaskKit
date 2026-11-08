import { Redirect } from 'expo-router';

// Temporary: replaced by the logged-in home screen in the next step.
export default function Index() {
  return <Redirect href="/welcome" />;
}
