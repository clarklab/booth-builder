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
            Plan the booth. Keep the books. Two tools, one shop.
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
              Keep a running list of swap meets, VHS releases, and shirt runs.
              The tally updates as you add them — then build the booth to match.
            </span>
            <span className="hc-tags">
              <span>Swaps</span>
              <span>Releases</span>
              <span>Running tally</span>
            </span>
            <span className="hc-go">Open the planner →</span>
          </button>
        </div>

        <p className="home-foot">
          The booth layout saves in your browser. The season plan syncs to the
          cloud, so it follows you between devices.
        </p>
      </div>
    </div>
  );
}
