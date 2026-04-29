import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import "./App.css";

type ServerStatus = {
  name: string;
  website: string;
  status: string;
};

type AuthStatus = {
  authenticated: boolean;
};

const formatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

async function fetchSession() {
  const response = await fetch("/api/session");

  if (!response.ok) {
    throw new Error("无法确认登录状态");
  }

  return response.json() as Promise<AuthStatus>;
}

async function fetchServers() {
  const response = await fetch("/api");

  if (response.status === 401) {
    throw new Error("请先登录");
  }

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
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");

  const sessionQuery = useQuery({
    queryKey: ["auth-session"],
    queryFn: fetchSession,
    retry: false,
  });

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
    enabled: sessionQuery.data?.authenticated === true,
  });

  const loginMutation = useMutation({
    mutationFn: async (nextPassword: string) => {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: nextPassword }),
      });

      if (!response.ok) {
        throw new Error("密码不正确");
      }

      return response.json() as Promise<AuthStatus>;
    },
    onSuccess: async () => {
      setPassword("");
      await queryClient.invalidateQueries({ queryKey: ["auth-session"] });
      await queryClient.invalidateQueries({ queryKey: ["server-status"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("退出失败");
      }

      return response.json() as Promise<AuthStatus>;
    },
    onSuccess: () => {
      queryClient.setQueryData<AuthStatus>(["auth-session"], {
        authenticated: false,
      });
      queryClient.removeQueries({ queryKey: ["server-status"] });
    },
  });

  const normalCount = servers.filter(
    (server) => server.status === "normal",
  ).length;
  const issueCount = servers.length - normalCount;
  const updatedTime = dataUpdatedAt
    ? formatter.format(dataUpdatedAt)
    : "--:--:--";
  const isAuthenticated = sessionQuery.data?.authenticated === true;

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loginMutation.mutate(password);
  }

  if (sessionQuery.isLoading) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <p className="eyebrow">Server Online</p>
          <h1>验证登录中</h1>
          <div className="auth-loading" />
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <div>
            <p className="eyebrow">Server Online</p>
            <h1>登录</h1>
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            <label htmlFor="password">密码</label>
            <input
              autoComplete="current-password"
              autoFocus
              id="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="输入访问密码"
              type="password"
              value={password}
            />
            {loginMutation.isError ? (
              <p className="form-error">
                {loginMutation.error instanceof Error
                  ? loginMutation.error.message
                  : "登录失败"}
              </p>
            ) : null}
            {sessionQuery.isError ? (
              <p className="form-error">
                {sessionQuery.error instanceof Error
                  ? sessionQuery.error.message
                  : "无法确认登录状态"}
              </p>
            ) : null}
            <button
              className="login-button"
              disabled={!password || loginMutation.isPending}
              type="submit"
            >
              {loginMutation.isPending ? "登录中" : "进入"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="status-page">
      <section className="hero">
        <div>
          <p className="eyebrow">Server Online</p>
          <h1>服务状态</h1>
        </div>
        <div className="action-bar">
          <button
            className="reload-button"
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label="刷新状态"
          >
            <span aria-hidden="true">{isFetching ? "..." : "↻"}</span>
            <span>{isFetching ? "刷新中" : "刷新"}</span>
          </button>
          <button
            className="logout-button"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
            type="button"
          >
            退出
          </button>
        </div>
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
