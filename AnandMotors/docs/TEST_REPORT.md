# Test Report

Verification evidence for the Car Dealership Inventory System, recorded on 23 July 2026 (Asia/Calcutta).

## Environment

| Component            | Verified value                                              |
| -------------------- | ----------------------------------------------------------- |
| Operating system     | Microsoft Windows NT 10.0.26200.0, x64                      |
| Node.js              | 22.17.0                                                     |
| npm                  | 10.9.2                                                      |
| PostgreSQL           | 18.4                                                        |
| Vitest               | 4.1.10                                                      |
| Playwright           | 1.61.1                                                      |
| Chromium             | 149.0.7827.55                                               |
| Git working baseline | `8164a5ec31f7` on `main`                                    |
| Test database        | Dedicated local PostgreSQL database with `test` in its name |

Connection strings, passwords, JWTs, and generated browser credentials were not written to this report or committed.

## Automated Results

| Layer                                          |        Files/Journeys |   Tests |     Result |
| ---------------------------------------------- | --------------------: | ------: | ---------: |
| Backend unit, HTTP, and PostgreSQL integration |              38 files |     386 |     Passed |
| Frontend component                             |              11 files |     108 |     Passed |
| Full-stack browser acceptance                  |            3 journeys |       3 |     Passed |
| Populated documentation and responsive review  |             1 journey |       1 |     Passed |
| **Total**                                      | **53 files/journeys** | **498** | **Passed** |

The backend total includes the real-database migration, repository, transaction, and concurrent final-unit purchase checks because `TEST_DATABASE_URL` was available. The screenshot journey also contains assertions for the feature pages it captures; it is not only an image-writing script.

## Commands

```text
npm run test:backend
npm run test:frontend
npm run test:e2e
npm run screenshots
```

The repository quality gate is:

```text
npm run check
```

It runs Prettier verification, ESLint with zero warnings, TypeScript checks, both Vitest suites, and both production builds in fail-fast order.

## Feature Coverage

| Feature               | Direct verification                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| Authentication        | Registration, login, duplicate email, hashing, JWTs, middleware, role guards, session restoration, logout |
| Vehicle CRUD          | Validation, repository behavior, API authorization, forms, editing, confirmation, deletion                |
| Search and pagination | Text/structured filters, sorting, bounds, metadata, catalogue controls                                    |
| Purchase and restock  | Atomic stock changes, conflict mapping, concurrent final unit, UI feedback                                |
| Activity log          | Transactional writes, filters, actor attribution, snapshots, deletion retention, admin UI                 |
| Low-stock monitoring  | Threshold boundaries, statuses, endpoint pagination, quick restock, admin UI                              |
| Purchase history      | Ownership, admin access, filtering, exact snapshots, pagination, customer/admin UI                        |
| Dashboard             | Inventory and sales metrics, periods, exact values, protected route, populated UI                         |
| CSV import/export     | Parsing, limits, preview, rollback, activity, deterministic/formula-safe export, UI                       |

## Database and Concurrency Evidence

- Tracked migrations apply to the isolated test database.
- Prisma repository tests use unique markers and remove only their own records.
- Two synchronized purchases compete for a vehicle with quantity one.
- Exactly one request succeeds, exactly one returns `409`, neither returns `500`, and persisted stock is zero.
- The successful purchase creates both its purchase snapshot and inventory activity transactionally.
- Vehicle create, update, delete, purchase, and restock operations roll back if the required audit write fails.
- CSV confirmation creates every valid vehicle and activity in one transaction or imports nothing.

## Browser Journeys

The three acceptance journeys verify:

- anonymous route protection;
- registration validation, authentication, session restoration, and logout;
- customer catalogue filtering, sorting, pagination, purchase, final-unit handling, and stale-stock conflict;
- role-based visibility and route access;
- administrator vehicle creation, editing, restocking, purchasing, and deletion.

The populated documentation journey verifies and captures:

- login;
- customer catalogue and purchase history;
- administrator inventory and low-stock monitoring;
- administrator analytics and cross-customer purchase history;
- validated CSV preview followed by transactional import;
- inventory activity including CSV-created vehicles.

It also checks tablet and mobile layouts for document-level horizontal overflow.

## Screenshot Inventory

| File                         | Feature evidence                       |
| ---------------------------- | -------------------------------------- |
| `login.png`                  | Authentication entry point             |
| `user-catalogue.png`         | Searchable catalogue and purchasing    |
| `user-purchase-history.png`  | Durable customer purchase history      |
| `admin-inventory.png`        | Vehicle CRUD and stock administration  |
| `admin-dashboard.png`        | Inventory and purchase analytics       |
| `admin-low-stock.png`        | Threshold monitoring and quick restock |
| `admin-purchase-history.png` | Cross-customer sales history           |
| `admin-csv-preview.png`      | Parsed and validated import preview    |
| `admin-activity-log.png`     | Append-only inventory auditing         |

All screenshots come from the running application with temporary realistic records. Cleanup targets the exact generated accounts, vehicle IDs, and categories.

## Security and Isolation Audit

- `.env`, build output, coverage, dependencies, reports, traces, videos, and transient files are ignored.
- The test database name is validated before database-aware scripts run.
- Test cleanup does not reset, truncate, or broadly delete the database.
- Browser selectors use accessible roles, names, labels, and observable network/UI states.
- Browser tests contain no fixed sleeps.
- Passwords and access tokens are absent from page text, URLs, documentation, and screenshots.
- CSV input is bounded; export is formula-safe.
- Protected behavior is tested at the API even when the UI also hides it.

## Limitations

- Database and browser verification requires the dedicated local PostgreSQL test database.
- Automated browser coverage currently uses the pinned Chromium project.
- The remote CI pipeline has no PostgreSQL service, so database integration and browser checks remain explicit local gates.
- Deployment, password recovery, refresh-token rotation, email verification, and multi-factor authentication are outside the current scope.
