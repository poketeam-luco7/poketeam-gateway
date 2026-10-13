// Tests de la gateway : les microservices sont remplacés par un faux service
// qui renvoie ce qu'il a reçu (chemin, méthode, X-User-Id).
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const jwt = require("jsonwebtoken");
const { createApp } = require("../src/app");

const SECRET = "test-secret";
let upstream, gateway, base;

function listen(server) {
  return new Promise((resolve) => server.listen(0, () => resolve(server.address().port)));
}

before(async () => {
  upstream = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ path: req.url, method: req.method, userId: req.headers["x-user-id"] ?? null }));
  });
  const up = `http://localhost:${await listen(upstream)}`;
  const app = createApp({
    jwtSecret: SECRET, dresseursUrl: up, equipesUrl: up, pokedexUrl: up,
    corsOrigin: "http://localhost:4200",
  });
  gateway = http.createServer(app);
  base = `http://localhost:${await listen(gateway)}`;
});

after(() => { upstream.close(); gateway.close(); });

const token = (sub = "42", secret = SECRET) => jwt.sign({ sub }, secret);
const call = (path, opts = {}) => fetch(base + path, opts);

test("connexion publique, et un X-User-Id envoyé par le client est supprimé", async () => {
  const r = await call("/auth/login", { method: "POST", headers: { "X-User-Id": "1" } });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).userId, null);
});

test("inscription publique mais modification du profil protégée", async () => {
  assert.equal((await call("/users", { method: "POST" })).status, 200);
  assert.equal((await call("/users", { method: "PUT" })).status, 401);
});

test("/teams sans token ou avec un token invalide : 401", async () => {
  assert.equal((await call("/teams")).status, 401);
  const bad = await call("/teams", { headers: { Authorization: `Bearer ${token("1", "autre")}` } });
  assert.equal(bad.status, 401);
});

test("token valide : l'id du token remplace un X-User-Id usurpé", async () => {
  const r = await call("/teams/abc", {
    headers: { Authorization: `Bearer ${token("42")}`, "X-User-Id": "1" },
  });
  const body = await r.json();
  assert.equal(r.status, 200);
  assert.equal(body.userId, "42");
  assert.equal(body.path, "/teams/abc");
});

test("les anciennes routes /pokeapi sont réécrites vers le Pokédex", async () => {
  assert.equal((await (await call("/pokeapi/generation/1")).json()).path, "/generation/1");
  assert.equal((await (await call("/pokeapi/poke/6")).json()).path, "/pokemon/6");
  assert.equal((await (await call("/pokeapi/megas")).json()).path, "/megas");
  assert.equal((await (await call("/pokeapi/type/water/pokemon")).json()).path, "/type/water/pokemon");
});

test("préflight CORS autorisé pour le front", async () => {
  const r = await call("/teams", {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:4200", "Access-Control-Request-Method": "GET" },
  });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("access-control-allow-origin"), "http://localhost:4200");
});

test("service arrêté : 502 propre", async () => {
  const app = createApp({
    jwtSecret: SECRET, dresseursUrl: "http://localhost:1", equipesUrl: "http://localhost:1",
    pokedexUrl: "http://localhost:1", corsOrigin: "*",
  });
  const srv = http.createServer(app);
  const port = await listen(srv);
  const r = await fetch(`http://localhost:${port}/pokeapi/poke/6`);
  assert.equal(r.status, 502);
  srv.close();
});
