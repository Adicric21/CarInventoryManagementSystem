# Architecture and Database Guide

## System Overview

The repository is an npm workspace containing independently buildable frontend and backend applications.

```text
Browser
  |
  | HTTP/JSON and bearer token
  v
Express delivery layer
  |
  | validated commands and queries
  v
Application use cases
  |
  | domain repository contracts
  v
Prisma infrastructure
  |
  | transactions and parameterized queries
  v
PostgreSQL
```

## Backend Layers

Each backend feature follows the same general structure:

```text
module/
|-- application/      # Use cases, validation, orchestration
|-- domain/           # Types, errors, and repository contracts
|-- http/             # Express routes, controllers, response mapping
|-- infrastructure/   # Prisma repository implementations
|-- test-support/     # Focused fixtures and doubles where needed
`-- module.ts         # Dependency composition
```

The separation keeps Express and Prisma details out of business rules. Application tests can use repository doubles, while integration tests exercise the real PostgreSQL adapters.

### Backend modules

| Module               | Responsibility                                           |
| -------------------- | -------------------------------------------------------- |
| `auth`               | Registration, login, JWT authentication, roles           |
| `vehicles`           | CRUD, search, pagination, purchase, restock, stock state |
| `inventory-activity` | Append-only inventory audit history                      |
| `purchases`          | Personal and administrator purchase history              |
| `dashboard`          | Inventory and period-based purchase analytics            |
| `vehicle-csv`        | Preview, transactional import, and safe export           |

## Frontend Structure

The React application separates:

- application providers and routing;
- authentication state;
- feature pages and reusable controls;
- shared API request and response types;
- session storage;
- global responsive styling;
- component tests.

TanStack Query owns server state and invalidation. React Hook Form and Zod handle interactive forms. The backend remains authoritative for roles and business invariants.

## Database Design

### User

Stores identity and authentication information:

- UUID;
- name;
- unique normalized email;
- bcrypt password hash;
- `USER` or `ADMIN` role;
- created and updated timestamps.

A user owns purchase records and performed inventory activities. Referenced users cannot be deleted accidentally.

### Vehicle

Stores current inventory:

- UUID;
- make;
- model;
- category;
- exact decimal price;
- available quantity;
- created and updated timestamps.

Database checks prevent negative prices and quantities. A deleted vehicle is removed from active inventory while historical relations use nullable foreign keys.

### Purchase

Stores append-only sales history:

- purchasing user;
- optional live vehicle relation;
- vehicle make, model, and category snapshots;
- exact unit price;
- quantity;
- exact total amount;
- purchase timestamp.

Snapshots keep a purchase understandable after the vehicle is edited or deleted.

### InventoryActivity

Stores append-only inventory history:

- action;
- optional live vehicle relation;
- vehicle identity snapshot;
- quantity before, change, and after;
- performing user;
- optional metadata;
- timestamp.

Indexed action, vehicle, actor, and timestamp fields support administrator filtering.

## Transaction Boundaries

### Purchase

```text
Conditional stock decrement
        +
Purchase snapshot creation
        +
Inventory activity creation
        =
One PostgreSQL transaction
```

If any step fails, all steps roll back.

### Vehicle mutations

Vehicle creation, update, deletion, and restock create their associated activity inside the same transaction.

### CSV import

All parsed rows and all corresponding activity records are written in one transaction. A single invalid or failed row prevents a partial import.

## Repository Map

```text
.
|-- .github/workflows/
|   `-- ci.yml
|-- .husky/
|   `-- pre-commit
|-- apps/
|   |-- backend/
|   |   |-- prisma/
|   |   |   |-- migrations/
|   |   |   `-- schema.prisma
|   |   |-- src/
|   |   |   |-- config/
|   |   |   |-- modules/
|   |   |   |   |-- auth/
|   |   |   |   |-- dashboard/
|   |   |   |   |-- inventory-activity/
|   |   |   |   |-- purchases/
|   |   |   |   |-- vehicle-csv/
|   |   |   |   `-- vehicles/
|   |   |   |-- scripts/
|   |   |   |-- shared/
|   |   |   `-- types/
|   |   |-- package.json
|   |   |-- prisma.config.ts
|   |   |-- tsconfig.json
|   |   `-- vitest.config.js
|   `-- frontend/
|       |-- src/
|       |   |-- app/
|       |   |-- features/
|       |   |   |-- auth/
|       |   |   |-- dashboard/
|       |   |   |-- inventory-activity/
|       |   |   |-- purchases/
|       |   |   |-- vehicle-csv/
|       |   |   `-- vehicles/
|       |   |-- lib/
|       |   |-- test/
|       |   |-- app-root.tsx
|       |   |-- index.css
|       |   `-- main.tsx
|       |-- package.json
|       |-- tsconfig.app.json
|       `-- vite.config.ts
|-- docs/
|   |-- decisions/
|   |-- screenshots/
|   |-- ARCHITECTURE.md
|   |-- FEATURE_GUIDE.md
|   |-- RED_GREEN_REFACTOR.md
|   |-- TEST_REPORT.md
|   `-- api.yaml
|-- e2e/
|   |-- support/
|   |-- acceptance.spec.ts
|   `-- screenshots.spec.ts
|-- scripts/
|   |-- migrate-test-database.mjs
|   |-- project-environment.mjs
|   |-- run-playwright.mjs
|   `-- setup.mjs
|-- ENGINEERING_GUIDE.md
|-- package.json
|-- playwright.config.ts
`-- tsconfig.json
```

Generated dependencies, builds, Prisma client output, coverage, test reports, browser traces, and local environment files are intentionally excluded from the repository map.

## API and Error Design

Requests are validated with Zod before they reach application operations. Successful list endpoints use stable items and pagination metadata. Failures use safe error envelopes with a machine-readable code and user-safe message.

Exact monetary values are serialized as decimal strings. Dates are ISO 8601 timestamps. The complete contract is defined in [api.yaml](api.yaml).

## Configuration Safety

- Development and test databases are configured separately.
- The test database name must contain a `test` segment.
- Test scripts never fall back to the development URL.
- JWT secrets are required and kept out of frontend build variables.
- Administrator credentials are read only by the explicit seed.
- `.env` and generated output are ignored by Git.
