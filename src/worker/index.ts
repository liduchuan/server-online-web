import { Hono } from "hono";
import type { Context } from "hono";
const app = new Hono<{ Bindings: Env }>();

export const SERVER_ONLINE_BEARER_TOKEN =
  "cb87826f2adebcec7e5990e4ffff82784bbf9474a94a7304f6dcf0aa9e3a52a5551";

const getServers = async (res: Context<{ Bindings: Env }>) => {
  const response = await fetch(
    "https://server-live.liduchuan.com/api/server-online?confirm=false",
    {
      headers: {
        Authorization: `Bearer ${SERVER_ONLINE_BEARER_TOKEN}`,
      },
    },
  );

  if (response.ok) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    return res.json((await response.json()).servers);
  } else {
    throw new Error(response.statusText);
  }
};

app.get("/api", getServers);
app.get("/api/", getServers);

export default app;
