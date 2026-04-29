import { useQuery } from "@tanstack/react-query";
import "./App.css";

type ServerStatus = {
  name: string;
  website: string;
  status: string;
};

const formatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

async function fetchServers() {
  const response = await fetch("/api");

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.json() as Promise<ServerStatus[]>;
}

function getHostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function App() {
  const {
    data: servers = [],
    error,
    isError,
    isLoading,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ["server-status"],
    queryFn: fetchServers,
  });

  const normalCount = servers.filter(
    (server) => server.status === "normal",
  ).length;
  const issueCount = servers.length - normalCount;
  const updatedTime = dataUpdatedAt
    ? formatter.format(dataUpdatedAt)
    : "--:--:--";

  return (
    <main className="status-page">
      <section className="hero">
        <div>
          <p className="eyebrow">Server Online</p>
          <h1>服务状态</h1>
        </div>
        <button
          className="reload-button"
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label="Loading Status"
        >
          <span aria-hidden="true">{isFetching ? "..." : "↻"}</span>
          <span>{isFetching ? "Loading..." : "Reload"}</span>
        </button>
      </section>

      <section className="summary-grid" aria-label="服务状态统计">
        <article className="summary-panel">
          <span>总服务</span>
          <strong>{servers.length}</strong>
        </article>
        <article className="summary-panel success">
          <span>正常</span>
          <strong>{normalCount}</strong>
        </article>
        <article className="summary-panel danger">
          <span>异常</span>
          <strong>{issueCount}</strong>
        </article>
        <article className="summary-panel">
          <span>更新时间</span>
          <strong>{updatedTime}</strong>
        </article>
      </section>

      <section className="service-list" aria-label="服务列表">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, index) => (
            <div className="service-row skeleton" key={index}>
              <div />
              <div />
              <div />
            </div>
          ))
        ) : isError ? (
          <div className="empty-state" role="alert">
            <strong>请求失败</strong>
            <span>
              {error instanceof Error ? error.message : "无法获取服务状态"}
            </span>
          </div>
        ) : (
          servers.map((server) => {
            const isNormal = server.status === "normal";

            return (
              <a
                className="service-row"
                href={server.website}
                key={`${server.name}-${server.website}`}
                rel="noreferrer"
                target="_blank"
              >
                <span className="service-name">{server.name}</span>
                <span className="service-url">
                  {getHostname(server.website)}
                </span>
                <span
                  className={
                    isNormal ? "status-pill normal" : "status-pill issue"
                  }
                >
                  <span aria-hidden="true" />
                  {isNormal ? "正常" : server.status}
                </span>
              </a>
            );
          })
        )}
      </section>
    </main>
  );
}

export default App;
