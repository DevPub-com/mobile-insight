export default function DashboardLoading() {
  return (
    <main
      className="mi-loading-shell"
      aria-busy="true"
      aria-label="대시보드 데이터를 불러오는 중"
    >
      <aside className="mi-loading-sidebar" aria-hidden="true">
        <div className="mi-loading-brand">
          <span className="mi-loading-logo">
            <i />
            <i />
            <i />
          </span>
          <strong>Mobile Insight</strong>
        </div>
        <div className="mi-loading-block mi-loading-app" />
        <div className="mi-loading-nav">
          <div className="mi-loading-block mi-loading-nav-label" />
          {Array.from({ length: 5 }, (_, index) => (
            <div
              className={`mi-loading-nav-item${index === 0 ? " is-active" : ""}`}
              key={index}
            >
              <span className="mi-loading-block" />
              <span className="mi-loading-block" />
            </div>
          ))}
          <div className="mi-loading-block mi-loading-nav-label" />
          <div className="mi-loading-nav-item">
            <span className="mi-loading-block" />
            <span className="mi-loading-block" />
          </div>
        </div>
        <div className="mi-loading-sidebar-foot">
          <span className="mi-loading-block" />
          <span className="mi-loading-block" />
        </div>
      </aside>

      <section className="mi-loading-workspace" aria-hidden="true">
        <header className="mi-loading-header">
          <div className="mi-loading-heading">
            <div className="mi-loading-block" />
            <div className="mi-loading-block" />
          </div>
          <div className="mi-loading-header-tools">
            <div className="mi-loading-block" />
            <div className="mi-loading-block" />
          </div>
        </header>

        <div className="mi-loading-content">
          <section className="mi-loading-kpis">
            {Array.from({ length: 5 }, (_, index) => (
              <article className="mi-loading-card" key={index}>
                <div className="mi-loading-copy">
                  <div className="mi-loading-block" />
                  <div className="mi-loading-block" />
                  <div className="mi-loading-block" />
                </div>
                <div className="mi-loading-block mi-loading-sparkline" />
              </article>
            ))}
          </section>

          <section className="mi-loading-panels">
            {Array.from({ length: 2 }, (_, index) => (
              <article className="mi-loading-panel" key={index}>
                <div className="mi-loading-panel-head">
                  <div>
                    <div className="mi-loading-block" />
                    <div className="mi-loading-block" />
                  </div>
                  <div className="mi-loading-block" />
                </div>
                <div className="mi-loading-chart">
                  <div className="mi-loading-chart-line" />
                </div>
              </article>
            ))}
          </section>
        </div>
      </section>
    </main>
  );
}
