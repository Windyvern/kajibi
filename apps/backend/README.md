# Maplogg Backend

Backend API for a map‑based article system built with [Strapi 5](https://strapi.io/). It stores articles along with geolocation metadata so a frontend can render them on an interactive map.

## Prerequisites

- [Node.js](https://nodejs.org/) 18.x and npm 6+
- Git
- (optional) [Docker](https://www.docker.com/) and GNU Make for container workflows

Start by copying the environment template and filling in the required secrets:

```bash
cp .env.example .env
# Edit .env to provide APP_KEYS, API_TOKEN_SALT, ADMIN_JWT_SECRET, TRANSFER_TOKEN_SALT,
# and database configuration.
```

## Install & Run

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the Strapi server in development mode:
   ```bash
   npm run develop
   ```
   The API is served at `http://localhost:1337`.
3. (Optional) Build and run for production:
   ```bash
   npm run build
   npm start
   ```

## Seeding Example Content

Seed scripts populate the database with authors, categories, articles, and default settings:

```bash
npm run seed:example
```

The script is idempotent and will only import data on the first run unless the database is cleared.

## Docker & Makefile Workflow

To build and run the project inside a container, ensure Docker is installed and `.env` contains the desired configuration.

```bash
# Build image
make docker-build

# Run container using variables from .env
make docker-run
```

Equivalent Docker commands are:

```bash
docker build -f Dockerfile -t <repository>/scrapi:latest .
docker run --rm -P --env-file .env <repository>/scrapi:latest
```

## Consuming the API from the Frontend

The frontend communicates with the backend using Strapi's REST API:

- List articles with related data:
  `GET /api/articles?populate=cover,author,category`
- Fetch a single article by slug:
  `GET /api/articles?filters[slug][$eq]=my-article&populate=*`
- Each article can include geospatial fields (e.g. `latitude` and `longitude`) allowing the frontend to plot map markers.

Responses follow the [Strapi REST conventions](https://docs.strapi.io/dev-docs/api/rest).

## Directory Overview

- `config/` – application configuration (database, server, plugins)
- `src/api/` – content type schemas, controllers, and services
- `scripts/seed.js` – seed logic for importing example data
- `Makefile` – helper targets for Docker builds and runs

## License

This project is released under the MIT license.

