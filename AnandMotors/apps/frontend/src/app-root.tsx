import { AppProviders } from './app/providers.js';
import { AppRouter } from './app/router.js';

export function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
