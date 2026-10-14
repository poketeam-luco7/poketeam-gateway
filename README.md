# PokéTeam — API Gateway

Point d'entrée **unique** du front (Node 22 + Express 5). Composant d'infrastructure, pas un
microservice métier : il route, vérifie le JWT et gère le CORS. Il conserve les URL du
monolithe d'origine (*Strangler Fig*), le front n'a pas changé ses appels.

| Préfixe | Service |
|---|---|
| `/auth`, `/users` | Dresseurs |
| `/teams`, `/capture` | Équipes |
| `/pokeapi/*` | Pokédex (`/pokeapi/poke/:id` → `/pokemon/:id`) |

Routes publiques : `POST /auth/login`, `POST /users`, `GET /pokeapi/*`, `GET /health`.
Ailleurs, le JWT est vérifié puis l'identité est transmise dans `X-User-Id`, **après suppression
de tout en-tête du même nom envoyé par le client** (pas d'usurpation possible).

## Variables d'environnement

| Variable | Défaut |
|---|---|
| `JWT_SECRET` | obligatoire (partagé avec Dresseurs) |
| `DRESSEURS_URL` | `http://dresseurs:8001` |
| `EQUIPES_URL` | `http://equipes:8002` |
| `POKEDEX_URL` | `http://pokedex:8000` |
| `CORS_ORIGIN` | `http://localhost:4200` |
| `PORT` | `3000` |

## Lancer seul

```bash
npm ci
JWT_SECRET=dev npm start
```

## Tests

```bash
npm test                     # 8 tests : JWT, usurpation, routage, CORS, service arrêté
```

## Fait partie de PokéTeam

Ce dépôt est un des composants de l'organisation [poketeam-lucas](https://github.com/poketeam-lucas).
Pour lancer l'application complète (gateway, 3 services, 2 bases), voir le dépôt
d'orchestration [`poketeam`](https://github.com/poketeam-lucas/poketeam) : `docker-compose.yml`,
architecture (C4) et décisions d'architecture (ADR).
