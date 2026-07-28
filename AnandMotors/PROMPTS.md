# PROMPTS.md

## Purpose of This File

This file records how I used AI tools while developing the **Car Dealership Inventory System**.

My main objective was not only to complete the features, but also to learn and apply **Test-Driven Development (TDD)** correctly. For each important feature, I followed the same engineering cycle:

1. **Red** — define expected behaviour through tests and confirm that the tests fail for the correct reason.
2. **Green** — implement the minimum complete behaviour required to make those tests pass.
3. **Refactor** — improve naming, structure, boundaries, duplication, and maintainability while keeping the tests green.
4. **Regression validation** — run the complete quality suite to confirm that the new feature did not disturb existing behaviour.

AI was used as a supporting engineering tool for test-case review, edge-case discovery, debugging, architecture discussion, refactoring suggestions, documentation review, and quality assurance. I remained responsible for understanding the suggestions, implementing or adapting accepted changes, running the tests, and validating the final behaviour.

> **Important:** Test counts and command results below must be filled using actual terminal output. No result should be estimated or invented.

---

# Interaction 1 — Establishing the TDD and Testing Foundation

**Tool:** Codex  
**Purpose:** Review the project structure and establish a reliable testing foundation before implementing business features.  
**Related commits:**

- `chore: establish engineering standards and quality gates`
- `test: configure frontend and backend testing foundations`

## Prompt

I want to develop this project by learning and applying TDD rather than writing all production code first.

Please inspect the project structure and help me establish a testing foundation for both backend and frontend.

I want to understand:

- Which behaviours should be tested at unit, API, integration, frontend, and E2E levels
- How to separate fast unit tests from PostgreSQL integration tests
- How to configure Vitest, Supertest, React Testing Library, and test setup correctly
- How to keep test code type-safe
- How to avoid meaningless tests such as snapshots, `expect(true)`, skipped tests, or implementation-detail assertions
- How to structure feature tests so they can guide production design
- How to run formatting, linting, type checking, tests, and builds through one quality command

Please explain the reasoning behind the suggested structure so I can understand why each layer is needed.

Do not implement business features yet. Focus only on the testing and engineering foundation.

## AI Contribution

- Reviewed the proposed monorepo testing structure
- Suggested separation between unit, API, PostgreSQL integration, frontend component, and E2E tests
- Highlighted the importance of testing observable behaviour instead of internal implementation
- Suggested quality scripts for formatting, linting, type checking, tests, and builds
- Identified unsafe testing practices to avoid

## My Learning and Decisions

- I learned that TDD requires tests to guide design, not merely tests added after implementation.
- I decided to keep unit tests fast and use a dedicated PostgreSQL test database for persistence behaviour.
- I chose to avoid Docker and Testcontainers and use separate development and test database URLs.
- I kept the test suite strict so test files must compile, lint, and fail only for missing behaviour.

## Human Review

- [ ] Confirmed backend test setup works
- [ ] Confirmed frontend test setup works
- [ ] Confirmed TypeScript is strict in tests
- [ ] Confirmed PostgreSQL integration tests use the test database only
- [ ] Confirmed the quality command runs all required checks
- [ ] Confirmed no test is silently skipped

---

# Interaction 2 — Authentication and Authorization Through TDD

**Tool:** OpenAI ChatGPT  
**Purpose:** Review authentication requirements, identify security edge cases, and guide the Red–Green–Refactor cycle.  
**Related commit:** `feat(auth): implement authentication through red-green-refactor`

## Prompt

I am starting the authentication feature and want to follow TDD carefully.

Before implementation, help me define behavioural tests for:

- User registration
- User login
- Duplicate email handling
- Password hashing
- Invalid credentials
- JWT generation and validation
- Missing, malformed, and expired tokens
- USER and ADMIN role authorization
- Attempts to bypass authorization using request-body or header role values
- Safe error responses that do not expose sensitive information

Please review the test cases and explain which belong to service tests, API tests, and middleware tests.

During Green, I want to implement only the required behaviour.

During Refactor, help me review:

- Controller responsibilities
- Authentication service boundaries
- Password and token utilities
- Centralized error handling
- Role middleware
- Naming and duplication

Do not weaken tests to make implementation easier. Existing quality checks must remain green.

## TDD Evidence

| Stage    | Command                        |                        Actual Result |
| -------- | ------------------------------ | -----------------------------------: |
| Red      | `npm run test:backend -- auth` | `<fill actual failed/passed counts>` |
| Green    | `npm run test:backend -- auth` |         `<fill actual passed count>` |
| Refactor | `npm run check`                |               `<fill actual result>` |

## AI Contribution

- Reviewed authentication test scenarios
- Suggested security-focused edge cases
- Reviewed middleware and service boundaries
- Helped identify unsafe trust in client-provided roles
- Suggested refactoring opportunities after tests passed

## My Learning and Decisions

- I learned that frontend role checks are only for user experience; backend authorization must remain authoritative.
- I kept password hashing and JWT handling outside controllers.
- I used server-side authenticated context instead of trusting role or user identifiers from the client.
- I validated error responses to prevent leakage of internal details.

## Human Review

- [ ] Registration tests were defined before implementation
- [ ] Login tests were defined before implementation
- [ ] Duplicate email is handled safely
- [ ] Passwords are hashed
- [ ] Invalid credentials return safe feedback
- [ ] Protected routes reject missing or invalid JWTs
- [ ] USER cannot access ADMIN operations
- [ ] Client-provided roles cannot bypass authorization
- [ ] Full quality suite passes

---

# Interaction 3 — Vehicle Management Through TDD

**Tool:** Claude  
**Purpose:** Review vehicle-management behaviour and guide test-first development.  
**Related commit:** `feat(vehicle): implement vehicle management through red-green-refactor`

## Prompt

I am implementing vehicle management and want tests to define the feature before production code.

Please help me review behavioural tests for:

- Administrator vehicle creation
- Authenticated vehicle listing
- Search by make and model
- Category and price filtering
- In-stock filtering
- Sorting with an allowlist
- Pagination and deterministic ordering
- Vehicle updates
- Vehicle deletion
- Invalid IDs and missing vehicles
- Price and quantity validation
- USER and ADMIN permission boundaries
- Safe Decimal serialization
- PostgreSQL filtering instead of in-memory filtering

I want the tests to guide the design of:

- Route
- Controller
- Application service
- Repository interface
- Prisma repository
- Zod schemas
- Response mapper
- Error mapping

After Green, review the implementation for thin controllers, clear repository boundaries, safe query construction, and unnecessary abstractions.

## TDD Evidence

| Stage    | Command                           |                        Actual Result |
| -------- | --------------------------------- | -----------------------------------: |
| Red      | `npm run test:backend -- vehicle` | `<fill actual failed/passed counts>` |
| Green    | `npm run test:backend -- vehicle` |         `<fill actual passed count>` |
| Refactor | `npm run check`                   |               `<fill actual result>` |

## Tested Aspects

- Vehicle creation
- Vehicle listing
- Search
- Filtering
- Sorting
- Pagination
- Update
- Delete
- Validation
- Authentication
- Role authorization
- Missing-resource handling
- Decimal response mapping
- PostgreSQL repository behaviour

## My Learning and Decisions

- I learned to keep database filtering, sorting, and pagination inside PostgreSQL rather than loading all vehicles into memory.
- I used explicit sorting allowlists instead of accepting arbitrary client fields.
- I kept Prisma-specific details inside the repository.
- I preserved stable API error codes for validation and missing resources.

## Human Review

- [ ] Tests cover create, list, search, update, and delete
- [ ] ADMIN-only operations are protected
- [ ] USER can browse and search
- [ ] Pagination occurs in PostgreSQL
- [ ] Filtering occurs in PostgreSQL
- [ ] Sorting uses an allowlist
- [ ] Price and quantity validation is correct
- [ ] Missing vehicles return a stable 404 response
- [ ] Complete test suite remains green

---

# Interaction 4 — Purchase, Restock, and Concurrency Safety

**Tool:** Codex  
**Purpose:** Learn how to test and implement stock changes safely under concurrent requests.  
**Related commit:** `feat(inventory): implement purchase and restock through red-green-refactor`

## Prompt

I want to implement purchase and restock using TDD, with special focus on preventing overselling.

Please help me define tests for:

- USER and ADMIN purchasing
- ADMIN-only restocking
- Positive-integer quantity validation
- Purchasing the final available unit
- Insufficient stock
- Zero stock
- Missing vehicle
- Atomic stock decrement
- Atomic restock increment
- Two simultaneous purchase requests for the final unit
- Prevention of negative stock
- Safe 409 conflict handling
- Regression of existing authentication and vehicle features

Please explain why a read-modify-write sequence is unsafe and review an atomic PostgreSQL/Prisma approach.

After the tests pass, review whether stock calculations remain outside controllers and whether repository operations preserve concurrency safety.

## TDD Evidence

| Stage    | Command                             |                        Actual Result |
| -------- | ----------------------------------- | -----------------------------------: |
| Red      | `npm run test:backend -- inventory` | `<fill actual failed/passed counts>` |
| Green    | `npm run test:backend -- inventory` |         `<fill actual passed count>` |
| Refactor | `npm run check`                     |               `<fill actual result>` |

## Tested Aspects

- Purchase authorization
- Restock authorization
- Quantity validation
- Atomic decrement
- Atomic increment
- Insufficient-stock conflict
- Concurrency
- Negative-stock prevention
- Updated response data
- Regression coverage

## My Learning and Decisions

- I learned why reading stock, subtracting in memory, and saving later can oversell inventory.
- I used an atomic conditional database update.
- I added a real PostgreSQL concurrency test.
- I kept restocking as an atomic increment.
- I returned 409 for insufficient stock rather than treating it as a generic server error.

## Human Review

- [ ] USER can purchase
- [ ] ADMIN can purchase
- [ ] Only ADMIN can restock
- [ ] Invalid quantities are rejected
- [ ] Final-unit purchase succeeds
- [ ] Excess purchase returns 409
- [ ] Concurrent purchase cannot oversell
- [ ] Stock never becomes negative
- [ ] Existing tests still pass

---

# Interaction 5 — Frontend Behaviour and User Experience

**Tool:** OpenAI ChatGPT
**Purpose:** Review frontend behavioural tests and ensure the UI integrates correctly with the tested backend.  
**Related commit:** `feat(frontend): implement dealership experience through red-green-refactor`

## Prompt

I want the frontend to be driven by user behaviour rather than component implementation details.

Please review tests for:

- Registration and login forms
- Client-side and backend validation errors
- Session restoration
- Protected routes
- Logout and expired-session handling
- Vehicle loading, empty, and error states
- Search, filters, sorting, and pagination
- Purchase success and failure
- Disabled purchase at zero quantity
- Administrator add, edit, delete, and restock
- Role-aware navigation and controls
- Duplicate-submission prevention
- Accessibility and responsive interaction

Please focus the tests on what the user can see and do. Avoid CSS-class assertions, snapshots, private state assertions, and broad component mocking.

After Green, review component boundaries, API error handling, accessibility, and duplication without changing behaviour.

## TDD Evidence

| Stage    | Command                 |                        Actual Result |
| -------- | ----------------------- | -----------------------------------: |
| Red      | `npm run test:frontend` | `<fill actual failed/passed counts>` |
| Green    | `npm run test:frontend` |         `<fill actual passed count>` |
| Refactor | `npm run check`         |               `<fill actual result>` |

## Tested Aspects

- Authentication UI
- Protected routing
- Session handling
- Catalogue rendering
- Search and filters
- Sorting
- Pagination
- Purchase interaction
- Out-of-stock behaviour
- Admin vehicle management
- Loading, empty, error, and success feedback
- Accessibility basics

## My Learning and Decisions

- I learned to test observable behaviour instead of internal React state.
- I kept backend authorization authoritative even when admin controls were hidden in the UI.
- I centralized API error handling and token attachment.
- I preserved responsive and keyboard-accessible interactions.

## Human Review

- [ ] Registration and login work
- [ ] Protected routes work
- [ ] Session restoration works
- [ ] USER cannot see ADMIN controls
- [ ] Search, filters, sorting, and pagination work
- [ ] Purchase updates displayed stock
- [ ] Out-of-stock purchase is disabled
- [ ] Admin CRUD and restock work
- [ ] Frontend tests pass
- [ ] Backend regression tests pass

---

# Interaction 6 — Inventory Activity Log

**Tool:** Google Web Search  
**Purpose:** Learn how to implement append-only auditing with transactional consistency.  
**Related commits:**

- `test(activity-log): define inventory audit behaviour`
- `feat(activity-log): implement transactional inventory auditing`
- `refactor(activity-log): strengthen audit transaction boundaries`

## Prompt

I want to develop an inventory activity log feature through visible Red, Green, and Refactor commits.

Please help me review the tests first.

The activity log should record:

- Vehicle created
- Vehicle updated
- Vehicle deleted
- Vehicle purchased
- Vehicle restocked

Please identify tests for:

- Transactional activity creation
- Actor attribution
- Vehicle make/model/category snapshots
- Quantity before, change, and after
- Administrator-only history access
- Filtering by action and date
- Pagination and deterministic ordering
- History retention after vehicle deletion
- Rollback when activity creation fails
- Safe metadata that does not contain secrets

During Green, I will implement the minimum complete feature.

During Refactor, review transaction boundaries, activity mapping, query validation, repository responsibilities, and duplication. Do not introduce update or delete operations for audit records because the log must remain append-only.

## TDD Evidence

| Stage    | Commit                                                            | Command             |     Actual Result |
| -------- | ----------------------------------------------------------------- | ------------------- | ----------------: |
| Red      | `test(activity-log): define inventory audit behaviour`            | `<focused command>` | `<actual result>` |
| Green    | `feat(activity-log): implement transactional inventory auditing`  | `<focused command>` | `<actual result>` |
| Refactor | `refactor(activity-log): strengthen audit transaction boundaries` | `npm run check`     | `<actual result>` |

## Tested Aspects

- Activity creation for each inventory operation
- Transaction rollback
- Actor attribution
- Vehicle snapshots
- Quantity snapshots
- Deleted-vehicle history
- ADMIN authorization
- Filtering
- Pagination
- Append-only behaviour

## My Learning and Decisions

- I learned that an audit record should be written in the same database transaction as the business operation.
- I stored vehicle snapshots so the history remains understandable after deletion.
- I kept activity records append-only.
- I avoided storing tokens, passwords, or full raw requests in activity metadata.

## Human Review

- [ ] Every inventory-changing action creates an activity
- [ ] Activity and business operation succeed or fail together
- [ ] USER cannot read the admin activity log
- [ ] Deleted vehicle history remains readable
- [ ] Activity records cannot be updated or deleted through the API
- [ ] Metadata contains no secrets
- [ ] Full regression suite passes

---

# Interaction 7 — Low-Stock Monitoring

**Tool:** Google Web Search
**Purpose:** Learn how to derive stock state consistently and test alert behaviour.  
**Related commits:**

- `test(low-stock): define inventory alert behaviour`
- `<add Green commit>`
- `<add Refactor commit>`

## Prompt

I want to implement low-stock monitoring through Red, Green, and Refactor.

Please review tests for:

- Startup validation of `LOW_STOCK_THRESHOLD`
- Server-derived stock status
- OUT_OF_STOCK when quantity is zero
- LOW_STOCK when quantity is above zero and at or below the threshold
- IN_STOCK when quantity is above the threshold
- Administrator-only low-stock endpoint
- PostgreSQL filtering and ordering
- Pagination
- Low-stock navigation
- Quick restocking
- Query refresh after restock
- Regression of existing vehicle and inventory behaviour

The backend threshold must be authoritative. The frontend must not use a separate hard-coded threshold.

During Refactor, review whether stock-status logic is centralized and whether duplicate classification logic has been removed.

## TDD Evidence

| Stage    | Commit                                              | Command             |     Actual Result |
| -------- | --------------------------------------------------- | ------------------- | ----------------: |
| Red      | `test(low-stock): define inventory alert behaviour` | `<focused command>` | `<actual result>` |
| Green    | `<add Green commit>`                                | `<focused command>` | `<actual result>` |
| Refactor | `<add Refactor commit>`                             | `npm run check`     | `<actual result>` |

## Tested Aspects

- Environment validation
- Server-derived stock status
- ADMIN authorization
- PostgreSQL filtering
- Ordering
- Pagination
- Low-stock UI
- Quick restocking
- Query invalidation

## My Learning and Decisions

- I learned to derive stock status from quantity instead of storing duplicated state.
- I kept the threshold under backend control.
- I reused the same API contract in the frontend.
- I validated boundary values around zero and the configured threshold.

## Human Review

- [ ] Invalid threshold prevents unsafe startup
- [ ] Zero quantity is OUT_OF_STOCK
- [ ] Threshold quantity is LOW_STOCK
- [ ] Quantity above threshold is IN_STOCK
- [ ] USER cannot access admin low-stock operations
- [ ] Filtering occurs in PostgreSQL
- [ ] Quick restock refreshes the view
- [ ] Complete quality suite passes

---

# Interaction 8 — Final Quality, E2E, and Submission Review

**Tool:** Codex  
**Purpose:** Review critical journeys, final documentation, security, and submission readiness.  
**Related commit:** `test(e2e): validate critical journeys and finalize submission`

## Prompt

The required features are complete. I want to perform a final engineering review rather than add unnecessary features.

Please help me validate:

- Registration, login, protected routing, and logout
- USER vehicle browsing and purchase
- ADMIN vehicle creation, update, delete, and restock
- Search, filtering, sorting, and pagination
- Out-of-stock behaviour
- Concurrent stock safety
- Inventory activity history
- Low-stock monitoring
- Browser-level critical journeys
- README setup instructions
- API documentation
- `PROMPTS.md`
- `My AI Usage`
- Secret scanning
- GitHub Actions
- Manual acceptance checks

Do not fabricate test counts or results. Any limitation must be documented honestly.

## Final Validation Record

| Validation Layer  | Command                 |     Actual Result |
| ----------------- | ----------------------- | ----------------: |
| Formatting        | `npm run format:check`  | `<actual result>` |
| Lint              | `npm run lint`          | `<actual result>` |
| Type checking     | `npm run typecheck`     | `<actual result>` |
| Backend tests     | `npm run test:backend`  | `<actual result>` |
| Frontend tests    | `npm run test:frontend` | `<actual result>` |
| Complete tests    | `npm test`              | `<actual result>` |
| Build             | `npm run build`         | `<actual result>` |
| Full quality gate | `npm run check`         | `<actual result>` |
| E2E               | `npm run test:e2e`      | `<actual result>` |
| GitHub Actions    | Workflow run            | `<actual result>` |

## Human Review

- [ ] Setup instructions work from a clean environment
- [ ] Development and test databases are separated
- [ ] No secrets are committed
- [ ] All required user journeys work
- [ ] All required admin journeys work
- [ ] E2E results are recorded honestly
- [ ] GitHub Actions is green
- [ ] README reflects the actual implementation
- [ ] PROMPTS.md reflects the real AI interactions
- [ ] Known limitations are documented

---

# Feature-wise Test Summary

Fill this table only from actual test-runner output.

| Feature                          |      Unit |       API | PostgreSQL Integration | Concurrency |  Frontend |       E2E |     Total |
| -------------------------------- | --------: | --------: | ---------------------: | ----------: | --------: | --------: | --------: |
| Authentication and Authorization |     `<n>` |     `<n>` |                  `<n>` |         `0` |     `<n>` |     `<n>` |     `<n>` |
| Vehicle CRUD                     |     `<n>` |     `<n>` |                  `<n>` |         `0` |     `<n>` |     `<n>` |     `<n>` |
| Search, Filter, Sort, Pagination |     `<n>` |     `<n>` |                  `<n>` |         `0` |     `<n>` |     `<n>` |     `<n>` |
| Purchase and Restock             |     `<n>` |     `<n>` |                  `<n>` |       `<n>` |     `<n>` |     `<n>` |     `<n>` |
| Inventory Activity Log           |     `<n>` |     `<n>` |                  `<n>` |         `0` |     `<n>` |     `<n>` |     `<n>` |
| Low-Stock Monitoring             |     `<n>` |     `<n>` |                  `<n>` |         `0` |     `<n>` |     `<n>` |     `<n>` |
| **Total**                        | **`<n>`** | **`<n>`** |              **`<n>`** |   **`<n>`** | **`<n>`** | **`<n>`** | **`<n>`** |

---

# TDD Reflection

The most important learning from this project was that TDD is not simply writing tests before a commit. It is a design process:

- Tests made expected behaviour explicit.
- Red failures showed that the behaviour was genuinely missing.
- Green implementation focused on the smallest complete solution.
- Refactoring improved the internal design without changing behaviour.
- Regression testing protected previously completed features.
- Database integration and concurrency testing covered risks that unit tests alone could not prove.
- Frontend behavioural tests focused on what users can observe rather than internal component details.

For earlier features, some local Red–Green–Refactor cycles were combined into cohesive green feature commits. For newer backend features, separate Red, Green, and Refactor commits were preserved to make the TDD progression directly visible in Git history.

AI helped me review possible test cases, edge conditions, architectural trade-offs, debugging steps, and quality checks. I remained responsible for understanding, implementing, adapting, testing, and approving the final solution.
