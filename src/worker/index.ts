import type { Context } from "hono";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
const app = new Hono<{ Bindings: Env }>();

export const SERVER_ONLINE_BEARER_TOKEN =
  "cb87826f2adebcec7e5990e4ffff82784bbf9474a94a7304f6dcf0aa9e3a52a5551";
export const SERVER_ONLINE_PASSWORD_MD5 = "4bc905f4258b4a0544b0cf3976d93b6e";

const AUTH_COOKIE_NAME = "server_online_auth";
const AUTH_SESSION_VALUE = `verified.${SERVER_ONLINE_PASSWORD_MD5}`;

const md5ShiftAmounts = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5,
  9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11,
  16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15,
  21,
];

const md5Constants = Array.from({ length: 64 }, (_, index) =>
  Math.floor(Math.abs(Math.sin(index + 1)) * 2 ** 32),
);

function add32(a: number, b: number) {
  return (a + b) | 0;
}

function rotateLeft(value: number, amount: number) {
  return (value << amount) | (value >>> (32 - amount));
}

function wordToHex(word: number) {
  return [0, 1, 2, 3]
    .map((index) =>
      ((word >>> (index * 8)) & 0xff).toString(16).padStart(2, "0"),
    )
    .join("");
}

function md5(input: string) {
  const bytes = [...new TextEncoder().encode(input)];
  const bitLength = bytes.length * 8;

  bytes.push(0x80);

  while (bytes.length % 64 !== 56) {
    bytes.push(0);
  }

  for (let index = 0; index < 8; index += 1) {
    bytes.push(Math.floor(bitLength / 2 ** (index * 8)) & 0xff);
  }

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = Array.from({ length: 16 }, (_, index) => {
      const wordOffset = offset + index * 4;

      return (
        bytes[wordOffset] |
        (bytes[wordOffset + 1] << 8) |
        (bytes[wordOffset + 2] << 16) |
        (bytes[wordOffset + 3] << 24)
      );
    });

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let index = 0; index < 64; index += 1) {
      let f = 0;
      let g = 0;

      if (index < 16) {
        f = (b & c) | (~b & d);
        g = index;
      } else if (index < 32) {
        f = (d & b) | (~d & c);
        g = (5 * index + 1) % 16;
      } else if (index < 48) {
        f = b ^ c ^ d;
        g = (3 * index + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * index) % 16;
      }

      const nextD = d;
      d = c;
      c = b;
      b = add32(
        b,
        rotateLeft(
          add32(add32(a, f), add32(md5Constants[index], words[g])),
          md5ShiftAmounts[index],
        ),
      );
      a = nextD;
    }

    a0 = add32(a0, a);
    b0 = add32(b0, b);
    c0 = add32(c0, c);
    d0 = add32(d0, d);
  }

  return [a0, b0, c0, d0].map(wordToHex).join("");
}

function isAuthenticated(res: Context<{ Bindings: Env }>) {
  return getCookie(res, AUTH_COOKIE_NAME) === AUTH_SESSION_VALUE;
}

function setAuthCookie(res: Context<{ Bindings: Env }>) {
  setCookie(res, AUTH_COOKIE_NAME, AUTH_SESSION_VALUE, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "Strict",
    secure: new URL(res.req.url).protocol === "https:",
  });
}

const getServers = async (res: Context<{ Bindings: Env }>) => {
  if (!isAuthenticated(res)) {
    return res.json({ error: "Unauthorized" }, 401);
  }

  const response = await fetch(
    "https://server-live.liduchuan.com/api/server-online?confirm=false",
    {
      headers: {
        Authorization: `Bearer ${SERVER_ONLINE_BEARER_TOKEN}`,
      },
    },
  );

  if (response.ok) {
    const payload = (await response.json()) as { servers: unknown };

    return res.json(payload.servers);
  } else {
    throw new Error(response.statusText);
  }
};

app.get("/api/session", (res) => {
  return res.json({ authenticated: isAuthenticated(res) });
});

app.post("/api/login", async (res) => {
  const body = await res.req.json<{ password?: string }>().catch(() => null);

  if (body?.password && md5(body.password) === SERVER_ONLINE_PASSWORD_MD5) {
    setAuthCookie(res);

    return res.json({ authenticated: true });
  }

  return res.json({ error: "Invalid password" }, 401);
});

app.post("/api/logout", (res) => {
  deleteCookie(res, AUTH_COOKIE_NAME, {
    path: "/",
  });

  return res.json({ authenticated: false });
});

app.get("/api", getServers);
app.get("/api/", getServers);

export default app;
