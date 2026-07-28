# Feature-wise Red–Green–Refactor Development

The project was developed in behavior-first slices. The four assignment features are documented first; additional features are recorded separately.

Historical failing-test output was transient and was not committed, so this document does not invent old failure counts. “Behavior defined” represents the red stage, while green and refactor stages were verified by the current focused and complete suites.

## Assignment Features

### Authentication and Authorization

| Stage    | Command                        |                            Result |
| -------- | ------------------------------ | --------------------------------: |
| Red      | `npm run test:backend -- auth` | Behavior defined in failing tests |
| Green    | `npm run test:backend -- auth` |              Focused suite passed |
| Refactor | `npm run check`                |      Complete quality gate passed |

#### Red

Tests defined registration, login, password security, JWT authentication, and role authorization.

#### Green

Routes, services, persistence, password hashing, tokens, and authorization middleware were implemented.

#### Refactor

Validation, dependencies, middleware, and response mapping were separated without changing behavior.

#### Tested aspects

- Registration and login
- Duplicate email and invalid credentials
- Password hashing and policy
- JWT creation and verification
- Missing and invalid tokens
- `USER` and `ADMIN` authorization
- Frontend sessions and protected routing

### Vehicle CRUD

| Stage    | Command                            |                            Result |
| -------- | ---------------------------------- | --------------------------------: |
| Red      | `npm run test:backend -- vehicles` | Behavior defined in failing tests |
| Green    | `npm run test:backend -- vehicles` |              Focused suite passed |
| Refactor | `npm run check`                    |      Complete quality gate passed |

#### Red

Tests defined administrator creation, listing, editing, deletion, validation, and role restrictions.

#### Green

Vehicle use cases, routes, Prisma persistence, and administrator controls were implemented.

#### Refactor

Shared validation, repository contracts, result mapping, and mutation feedback were consolidated.

#### Tested aspects

- Create, list, edit, and delete
- Required fields and unknown fields
- Price and quantity constraints
- Not-found behavior
- Administrator authorization
- Confirmation and error states

### Search, Filtering, Sorting and Pagination

| Stage    | Command                          |                            Result |
| -------- | -------------------------------- | --------------------------------: |
| Red      | `npm run test:backend -- search` | Behavior defined in failing tests |
| Green    | `npm run test:backend -- search` |              Focused suite passed |
| Refactor | `npm run check`                  |      Complete quality gate passed |

#### Red

Tests defined text search, structured filters, supported sorting, stable pagination, and invalid queries.

#### Green

Validated query parsing, repository filtering, pagination metadata, and catalogue controls were implemented.

#### Refactor

Query normalization, defaults, frontend filter state, and page resets were simplified.

#### Tested aspects

- Make, model, and category
- Minimum and maximum price
- In-stock filtering
- Sort directions
- Pagination boundaries and metadata
- Loading, empty, and retry states

### Purchase and Restock

| Stage    | Command                            |                            Result |
| -------- | ---------------------------------- | --------------------------------: |
| Red      | `npm run test:backend -- purchase` | Behavior defined in failing tests |
| Green    | `npm run test:backend -- purchase` |              Focused suite passed |
| Refactor | `npm run check`                    |      Complete quality gate passed |

#### Red

Tests defined atomic purchase, unavailable stock, administrator restock, and concurrent final-unit behavior.

#### Green

Conditional stock updates and transactional purchase and restock operations were implemented.

#### Refactor

Transaction orchestration, conflict mapping, and stock mutation contracts were tightened.

#### Tested aspects

- Successful purchase
- Final-unit and out-of-stock behavior
- Positive restock validation
- Atomic stock updates
- Concurrent purchase conflict
- Frontend success and stale-stock feedback

## Additional Features

### Frontend Authentication and Routing

| Stage    | Command                                           |                       Result |
| -------- | ------------------------------------------------- | ---------------------------: |
| Red      | `npm run test:frontend -- authentication routing` |             Behavior defined |
| Green    | `npm run test:frontend -- authentication routing` |         Focused suite passed |
| Refactor | `npm run check`                                   | Complete quality gate passed |

Tests cover forms, validation, sessions, logout, anonymous redirects, role-aware navigation, and protected routes. Authentication context and routing were reorganized without changing visible behavior.

### Vehicle Catalogue

| Stage    | Command                              |                       Result |
| -------- | ------------------------------------ | ---------------------------: |
| Red      | `npm run test:frontend -- catalogue` |             Behavior defined |
| Green    | `npm run test:frontend -- catalogue` |         Focused suite passed |
| Refactor | `npm run check`                      | Complete quality gate passed |

Tests cover vehicle cards, INR price formatting, filters, sorting, pagination, purchasing, loading, empty, retry, conflict, and responsive states.

### Administrator Frontend

| Stage    | Command                          |                       Result |
| -------- | -------------------------------- | ---------------------------: |
| Red      | `npm run test:frontend -- admin` |             Behavior defined |
| Green    | `npm run test:frontend -- admin` |         Focused suite passed |
| Refactor | `npm run check`                  | Complete quality gate passed |

Tests cover administrator navigation, create/edit forms, restock, deletion confirmation, accessible dialogs, feedback, and query refresh.

### Inventory Activity Log

| Stage    | Command                            |                       Result |
| -------- | ---------------------------------- | ---------------------------: |
| Red      | `npm run test:backend -- activity` |             Behavior defined |
| Green    | `npm run test:backend -- activity` |         Focused suite passed |
| Refactor | `npm run check`                    | Complete quality gate passed |

Tests cover transactional activity writes, role protection, action/vehicle/actor/date filters, pagination, quantity transitions, and snapshots retained after vehicle deletion.

### Low-Stock Monitoring

| Stage    | Command                             |                       Result |
| -------- | ----------------------------------- | ---------------------------: |
| Red      | `npm run test:backend -- low-stock` |             Behavior defined |
| Green    | `npm run test:backend -- low-stock` |         Focused suite passed |
| Refactor | `npm run check`                     | Complete quality gate passed |

Tests cover configurable threshold boundaries, three stock states, protected listing, pagination, and quick restocking.

### Purchase History

| Stage    | Command                             |                       Result |
| -------- | ----------------------------------- | ---------------------------: |
| Red      | `npm run test:backend -- purchases` |             Behavior defined |
| Green    | `npm run test:backend -- purchases` |         Focused suite passed |
| Refactor | `npm run check`                     | Complete quality gate passed |

Tests cover customer isolation, administrator access, filters, pagination, exact monetary snapshots, and retention after vehicle deletion.

### Analytics Dashboard

| Stage    | Command                             |                       Result |
| -------- | ----------------------------------- | ---------------------------: |
| Red      | `npm run test:backend -- dashboard` |             Behavior defined |
| Green    | `npm run test:backend -- dashboard` |         Focused suite passed |
| Refactor | `npm run check`                     | Complete quality gate passed |

Tests cover inventory count, units, value, categories, stock health, purchase count, revenue, date periods, daily totals, top vehicles, and access control.

### CSV Import and Export

| Stage    | Command                       |                       Result |
| -------- | ----------------------------- | ---------------------------: |
| Red      | `npm run test:backend -- csv` |             Behavior defined |
| Green    | `npm run test:backend -- csv` |         Focused suite passed |
| Refactor | `npm run check`               | Complete quality gate passed |

Tests cover strict headers, quoted values, file/row limits, row errors, write-free preview, transactional import, activity attribution, deterministic ordering, and spreadsheet-formula protection.

## Final Verification

| Layer                        |                      Result |
| ---------------------------- | --------------------------: |
| Backend                      |            386 tests passed |
| Frontend                     |            108 tests passed |
| Acceptance E2E               |           3 journeys passed |
| Populated screenshot journey |            1 journey passed |
| Total                        | 498 automated checks passed |

See [TEST_REPORT.md](TEST_REPORT.md) for the verification environment, concurrency evidence, browser journeys, and isolation audit.
