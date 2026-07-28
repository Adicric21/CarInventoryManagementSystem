# Engineering Guide

## Engineering Principles

- **Test-Driven Development:** Describe behaviour with a meaningful failing test before implementing it where applicable.
- **Clean Code:** Prefer readable names, focused functions, explicit dependencies, and code that explains its intent.
- **SOLID:** Use SOLID principles to guide maintainable boundaries without creating abstractions for their own sake.
- **DRY:** Remove meaningful duplication when a shared concept is clear; do not generalise coincidental similarity.
- **KISS:** Choose the simplest design that satisfies the current requirement.
- **YAGNI:** Do not build speculative features, layers, or extension points.
- **Quality with pragmatism:** Match engineering effort to risk while keeping the agreed quality gates intact.
- **Small and reversible changes:** Keep changes focused, easy to review, and safe to amend or revert.
- **Developer accountability:** Tool-assisted suggestions must be understood and reviewed. The developer remains responsible for every change.

## TDD Commit Workflow

For behaviour changes:

1. **Red:** Write a meaningful failing test that describes the expected behaviour.
2. **Green:** Write the minimum implementation needed to make the test pass.
3. **Refactor:** Improve names, structure, and duplication while preserving behaviour.
4. Run the complete relevant test suite.
5. Commit one logically complete change.

Future feature work may use a short sequence of focused commits:

```text
test(scope): define behaviour
feat(scope): implement behaviour
refactor(scope): improve design
```

Temporary red commits may exist on a feature branch to make the TDD sequence visible, but the final submitted branch must end in a green state with all configured checks passing.

## Testing Pyramid

- **Unit tests** cover isolated business rules and should remain fast.
- **Integration tests** will exercise database, route, and middleware boundaries using real boundaries where that provides value.
- **Component tests** cover frontend behaviour that users can observe.
- **End-to-end tests** may be added later in small numbers for critical workflows.

Tests must describe behaviour instead of mirroring the implementation. Mock only external boundaries or expensive collaborators, never the function under test. Avoid snapshots for core behaviour and avoid assertions about private implementation details. Cover errors, edge cases, and boundaries as well as happy paths. Behavioural confidence matters more than a cosmetic coverage percentage.

## Test Naming

Use behaviour-oriented names that state the outcome:

```text
registers a user with valid details
rejects registration when email already exists
disables purchase when stock is unavailable
```

Avoid weak names that conceal intent:

```text
works correctly
test registration
should work
```

Colocate tests with their source and use `*.test.ts` or `*.test.tsx` consistently.

## Current Test Commands

| Command                 | Purpose                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `npm test`              | Run backend and frontend tests once.                        |
| `npm run test:backend`  | Run backend tests once in the Node environment.             |
| `npm run test:frontend` | Run frontend component tests once in the jsdom environment. |
| `npm run test:watch`    | Run both workspace test suites in watch mode.               |
| `npm run test:coverage` | Generate separate V8 coverage reports for both workspaces.  |
| `npm run check`         | Run the complete non-interactive quality validation chain.  |

## Code Organisation Rules

When feature development begins:

- Organise code by feature where that improves cohesion.
- Keep controllers thin and limited to transport concerns.
- Keep business rules in services or domain logic.
- Isolate database access from business rules.
- Avoid circular dependencies.
- Introduce abstractions only after they provide concrete value.
- Do not create empty folders for hypothetical future code.
- Prefer dependency injection through explicit parameters or constructors.
- Keep framework details away from core business rules where practical.

These rules describe future organisation; they do not imply that feature modules or architectural layers already exist.

## TypeScript Standards

- Keep TypeScript strict.
- Avoid `any`; use `unknown` when a value's type has not yet been established.
- Use type-only imports where suitable.
- Prefer explicit domain types over loosely shaped objects.
- Avoid unsafe type assertions; validate or narrow values instead.
- Prefer small functions with clear, intention-revealing names.
- Await promises or deliberately handle their rejection.
- Never suppress compiler errors merely to make a build pass.

## React Standards

- Use functional components.
- Prefer accessible semantic HTML and keyboard-friendly interactions.
- Extract reusable UI only when genuine reuse exists.
- Keep server state separate from local UI state.
- Avoid unnecessary global state.
- Test user-observable behaviour rather than implementation details.
- Handle loading, empty, error, and disabled states explicitly.

## Backend Standards

- Validate all external input at the system boundary.
- Keep HTTP concerns out of business logic.
- Return errors in a consistent shape.
- Never expose secrets, credentials, or password hashes.
- Use atomic database operations for stock changes.
- Enforce authorization on the server.
- Never trust frontend role checks as a security boundary.

The backend framework and database configuration will be introduced in later commits; they are not part of Commit 02.

## Naming Conventions

- TypeScript and TSX filenames: `kebab-case`. Tool-mandated configuration filenames retain their ecosystem conventions.
- React component names: `PascalCase`.
- Functions and variables: `camelCase`.
- Types and interfaces: `PascalCase`, without an unnecessary `I` prefix.
- True constants: `UPPER_SNAKE_CASE`.
- Tests: names that clearly describe behaviour.
- Environment variables: `UPPER_SNAKE_CASE`.

Database naming conventions will be documented when Prisma is introduced.

## Commit Conventions

Use Conventional Commit messages with one of these types:

- `chore`
- `test`
- `feat`
- `fix`
- `refactor`
- `docs`
- `style`
- `perf`
- `ci`
- `build`

A commit message must describe one logical change. Add a scope when it improves clarity.

Good examples:

```text
test(auth): define duplicate email behaviour
feat(auth): implement user registration
refactor(auth): extract password hashing dependency
```

Bad examples:

```text
updated files
final changes
working code
fix stuff
```

## Tool-Assisted Development

- Tools may assist with planning, boilerplate, tests, review, and debugging.
- The developer remains accountable for every accepted change.
- Keep the concise assistance disclosure in the README current when applicable.
- Review and understand suggested code before accepting it.
- Never paste secrets or private information into third-party tools.
- Reject suggestions that are incorrect, unsafe, unnecessary, or unclear.
- Validate tool-assisted work through tests and manual review.

## Pull Request and Review Checklist

- [ ] Scope is focused.
- [ ] Tests describe behaviour where testing is available.
- [ ] All configured checks pass.
- [ ] No secrets are present.
- [ ] Error states are handled.
- [ ] Accessibility has been considered.
- [ ] Documentation is updated.
- [ ] Tool assistance is disclosed when applicable.
- [ ] The code is understandable.
- [ ] No unnecessary abstraction was introduced.

## Definition of Done

A future feature is done only when:

- [ ] Acceptance criteria are met.
- [ ] A test was written first where applicable.
- [ ] Tests pass.
- [ ] Formatting passes.
- [ ] Linting passes.
- [ ] Type checking passes.
- [ ] Production builds pass.
- [ ] Error cases are handled.
- [ ] Documentation is updated.
- [ ] The README assistance disclosure is current when applicable.
- [ ] The developer can explain the implementation.

## Local Quality Commands

| Command                 | Purpose                                                                       |
| ----------------------- | ----------------------------------------------------------------------------- |
| `npm run format`        | Format supported repository files with Prettier.                              |
| `npm run format:check`  | Verify formatting without modifying files.                                    |
| `npm run lint`          | Check relevant source and configuration files with ESLint.                    |
| `npm run lint:fix`      | Apply safe ESLint fixes where possible.                                       |
| `npm run typecheck`     | Type-check both workspaces without emitting files.                            |
| `npm test`              | Run both workspace test suites once.                                          |
| `npm run test:backend`  | Run the backend test suite once.                                              |
| `npm run test:frontend` | Run the frontend test suite once.                                             |
| `npm run test:watch`    | Run both workspace test watchers.                                             |
| `npm run test:coverage` | Generate backend and frontend V8 coverage reports.                            |
| `npm run build`         | Build both workspaces.                                                        |
| `npm run check`         | Run formatting, linting, type-checking, tests, and builds in fail-fast order. |

## Continuous Integration

- Every shared change must pass CI.
- Run `npm run check` before pushing so local and CI validation remain aligned.
- Fix CI failures instead of bypassing them.
- CI must remain independent of a developer's local machine.
- Never commit or log secrets.
- Keep shared branches green.

## Branch Protection Recommendation

Configure GitHub branch protection manually to require the **Continuous Integration** check and pull requests before merging into `main`. Discourage direct pushes and disable force pushes to `main`. This commit recommends these settings but does not enable them.
