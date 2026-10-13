const { createApp } = require("./app");

const env = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
};

const app = createApp({
  jwtSecret: env("JWT_SECRET"),
  dresseursUrl: env("DRESSEURS_URL", "http://dresseurs:8001"),
  equipesUrl: env("EQUIPES_URL", "http://equipes:8002"),
  pokedexUrl: env("POKEDEX_URL", "http://pokedex:8000"),
  corsOrigin: env("CORS_ORIGIN", "http://localhost:4200"),
});

const port = env("PORT", "3000");
app.listen(port, () => console.log(`Gateway à l'écoute sur :${port}`));
