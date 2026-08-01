import { useCallback, useEffect, useState } from 'react';
import { App } from './App';
import { Forecaster } from './components/Forecaster';
import { Home } from './components/Home';
import type { BoothBuild } from './domain/autoLayout';

type Route = 'home' | 'booth' | 'forecast';

function routeFromHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  if (h === 'booth') return 'booth';
  if (h === 'forecast') return 'forecast';
  return 'home';
}

export function Root() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  // A booth handed over from the Forecaster. Bumping `seedNonce` remounts the
  // builder so a second trip from the Forecaster replaces the layout again.
  const [seed, setSeed] = useState<BoothBuild | null>(null);
  const [seedNonce, setSeedNonce] = useState(0);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((r: Route) => {
    window.location.hash = r === 'home' ? '/' : `/${r}`;
    setRoute(r);
  }, []);

  const openBoothFromForecast = useCallback(
    (build: BoothBuild) => {
      setSeed(build);
      setSeedNonce((n) => n + 1);
      go('booth');
    },
    [go],
  );

  if (route === 'booth') {
    return (
      <App
        key={`booth-${seedNonce}`}
        seed={seed}
        onHome={() => go('home')}
        onForecast={() => go('forecast')}
      />
    );
  }

  if (route === 'forecast') {
    return <Forecaster onHome={() => go('home')} onBuildBooth={openBoothFromForecast} />;
  }

  return <Home onOpenBooth={() => go('booth')} onOpenForecast={() => go('forecast')} />;
}
