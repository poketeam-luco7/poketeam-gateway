const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { createProxyMiddleware } = require("http-proxy-middleware");

// Routes accessibles sans token : [méthode, préfixe]
const PUBLIC_ROUTES = [
  ["POST", "/auth/login"],
  ["POST", "/users"], // inscription
  ["GET", "/pokeapi"],
  ["GET", "/health"],
];

function isPublic(req) {
  return PUBLIC_ROUTES.some(
    ([method, prefix]) => req.method === method && req.path.startsWith(prefix)
  );
}

function createApp({ jwtSecret, dresseursUrl, equipesUrl, pokedexUrl, corsOrigin }) {
  const app = express();
  app.disable("x-powered-by");

  // 1. CORS : le navigateur n'autorise le front (port 4200) qu'à ce seul domaine
  app.use(cors({ origin: corsOrigin }));

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // 2. Sécurité : un client ne doit JAMAIS pouvoir choisir son X-User-Id
  app.use((req, _res, next) => {
    delete req.headers["x-user-id"];
    next();
  });

  // 3. Authentification centralisée : vérifie le JWT et transmet l'id aux services
  app.use((req, res, next) => {
    if (isPublic(req)) return next();
    const [type, token] = (req.headers.authorization || "").split(" ");
    if (type !== "Bearer" || !token) {
      return res.status(401).json({ error: "Token manquant" });
    }
    try {
      const payload = jwt.verify(token, jwtSecret, { algorithms: ["HS256"] });
      req.headers["x-user-id"] = String(payload.sub);
      next();
    } catch {
      res.status(401).json({ error: "Token invalide ou expiré" });
    }
  });

  // 4. Routage vers les microservices (mêmes URL que l'ancien monolithe)
  const proxy = (pathFilter, target, pathRewrite) =>
    createProxyMiddleware({
      pathFilter,
      target,
      pathRewrite,
      changeOrigin: true,
      on: {
        error: (_err, _req, res) => {
          if (res.headersSent) return;
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Service indisponible" }));
        },
      },
    });

  app.use(proxy(["/auth", "/users"], dresseursUrl));
  app.use(proxy("/teams", equipesUrl));
  // /pokeapi/poke/6 -> /pokemon/6 (ancienne route du front), /pokeapi/xxx -> /xxx
  app.use(
    proxy("/pokeapi", pokedexUrl, (path) =>
      path.replace(/^\/pokeapi\/poke\//, "/pokemon/").replace(/^\/pokeapi/, "")
    )
  );

  app.use((_req, res) => res.status(404).json({ error: "Route inconnue" }));
  return app;
}

module.exports = { createApp };
