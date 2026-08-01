type Props = {
  onOpenBooth: () => void;
  onOpenForecast: () => void;
};

export function Home({ onOpenBooth, onOpenForecast }: Props) {
  return (
    <div className="home">
      <div className="home-inner">
        <header className="home-head">
          <div className="home-logo">📼</div>
          <h1>VHS Garage</h1>
          <p className="home-sub">
            Plan the booth. Forecast the year. Two tools, one shop.
          </p>
        </header>

        <div className="home-cards">
          <button className="home-card booth" onClick={onOpenBooth}>
            <span className="hc-icon">🎪</span>
            <span className="hc-title">Booth Builder</span>
            <span className="hc-blurb">
              Lay out your pop-up tent and tables to scale, see exactly how many
              tapes fit, then walk the booth in 3D.
            </span>
            <span className="hc-tags">
              <span>Floor plan</span>
              <span>Tape math</span>
              <span>3D preview</span>
            </span>
            <span className="hc-go">Open the builder →</span>
          </button>

          <button className="home-card forecast" onClick={onOpenForecast}>
            <span className="hc-icon">📈</span>
            <span className="hc-title">Forecaster</span>
            <span className="hc-blurb">
              Tap through shows, custom VHS releases, and T-shirt runs to see
              what the year makes — then build the booth to match.
            </span>
            <span className="hc-tags">
              <span>Shows</span>
              <span>Releases</span>
              <span>Profit</span>
            </span>
            <span className="hc-go">Run the numbers →</span>
          </button>
        </div>

        <p className="home-foot">
          Everything runs in your browser and saves locally. Nothing is uploaded.
        </p>
      </div>
    </div>
  );
}
