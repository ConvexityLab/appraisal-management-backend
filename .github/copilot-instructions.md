# Coding Assistant Protocol

**Primary stacks:** Node.js/TypeScript (Vitest) · C++ (GoogleTest) · Python (pytest) · Rust (cargo test)
**Tooling:** VS Code on WSL · Azure · Bicep · GitHub Actions

---

## Phase 1 — Understand (before touching anything)

1. **Restate the task** in 1-2 sentences; confirm success criteria, constraints, and what "done" looks like.
2. **Read relevant code, tests, and docs first** — never guess at APIs, function signatures, or project structure. Search the codebase; don't assume.
3. **For bugs: reproduce first.** Confirm the failure (or understand the failing test) before proposing a fix. Address root causes, not symptoms.
4. **Before changing existing code, understand why it exists that way.** Check comments, commit messages, or surrounding logic for intent. Don't assume existing code is wrong — it may handle a case you haven't considered yet.
5. **Identify the minimal set of files** expected to change; ask before expanding scope.

## Phase 2 — Plan (present the plan, then wait)

6. **Enumerate edge cases, failure modes, and backward-compatibility risks** before writing any code.
7. **Outline test cases first (TDD).** For non-trivial changes, present the plan and proposed test cases to the user and **wait for approval before writing code.**
8. **Break large changes into small, working increments.** Each increment should compile, pass tests, and be reviewable on its own. Never deliver one monolithic diff when a sequence of focused steps is possible.
9. **Search for existing utilities, patterns, and conventions** in the codebase — reuse before inventing.
10. **No new dependencies** without a one-line justification and explicit approval.

## Phase 3 — Implement

11. **Write/update tests first**, then write the minimal code to make them pass.
12. **Never weaken or delete existing tests to make new code pass.** If a test needs to change, explain why the old assertion was wrong, not just inconvenient.
13. **Keep functions small, pure where possible, single-responsibility.** Avoid speculative abstraction.
14. **Keep diffs tight** — change only what's needed. No drive-by refactors. Remove dead code you replace; never leave commented-out blocks.
15. **Validate inputs at boundaries;** fail fast with actionable error messages that include the actual invalid value and what was expected.
16. **Handle async and resources correctly:** await every Promise; close handles; clean up in `finally` / `defer` / `Drop`. No fire-and-forget.
17. **Enforce type safety per language:** strict TypeScript (`strict: true`); `const`-correctness in C++; proper lifetimes/borrows in Rust; type hints in Python.
18. **Check concurrency risks** (races, deadlocks, shared mutable state) and flag them explicitly in comments or response.
19. **Verify all imports/requires resolve to real modules.** Never hallucinate packages, methods, or API signatures that don't exist.
20. **Security mindset at boundaries:** sanitize/validate external input; parameterize queries (no string interpolation into SQL/commands); respect trust boundaries between user input, config, and internal state.
21. **Match project linters/formatters** (eslint/prettier, rustfmt, clang-format, black/ruff) and existing naming, file layout, and architectural patterns. Follow existing error-handling style — don't mix paradigms.
22. **Comments: only for non-obvious intent or trade-offs.** Prefer clear naming first; prefer a comment over a mystery; never over-comment the obvious.
23. **Update documentation** (README, doc comments, guides) when behavior, APIs, or configuration changes. Don't leave docs describing the old behavior.

## Phase 4 — Infrastructure & Deployment

24. **Azure:** parameterize all config; no secrets in code; prefer Key Vault / managed identity; least privilege on all RBAC.
25. **Bicep:** use modules + params; set explicit `apiVersion`; ensure idempotent deployments; document all outputs.
26. **GitHub Actions:** minimal jobs; cache dependencies; fail fast; least-privilege secrets scope; never echo or log secrets.
27. **WSL / VS Code:** no hardcoded Windows paths; all scripts must run in bash; note any required extensions or VS Code tasks.

## Phase 5 — Verify

28. **Compile / type-check the change** before declaring it done (`tsc --noEmit`, `cargo check`, `g++ -fsyntax-only`, `mypy`).
29. **Run targeted tests; confirm ALL existing tests still pass.** Report results with pass/fail counts. A "passing" result that required deleting or loosening tests is not passing.
30. **If tests can't be run,** state exactly why and provide the exact commands to run locally.

## Phase 6 — Safety & Discipline

31. **Never revert uncommitted user changes.** No destructive commands (`git reset --hard`, `rm -rf`). No config, secret, or infra changes unless explicitly requested.
32. **If uncertain or stuck, say so — and say what you're uncertain about.** Flag guesses explicitly: "I believe X but haven't verified." Ask a focused question rather than generating plausible-looking but wrong code.
33. **Watch for performance regressions;** note algorithmic-complexity changes. Add benchmarks only if relevant to the task.

## Phase 7 — Report (end of every response)

34. **Structured close-out — always end with:**
    - **What changed** — files, locations, and a one-line "why" for each.
    - **Tests** — results of tests run, or exact commands to run if not executed.
    - **Confidence** — flag anything you're unsure about or couldn't verify.
    - **Assumptions & risks** — anything assumed or deferred.
    - **Next steps** — what to do next, if applicable.

---

## Default test commands

| Stack | Command | Scoped run |
|---|---|---|
| Node/TypeScript | `pnpm vitest` | `pnpm vitest run path/to/file.test.ts` |
| Python | `pytest` | `pytest path/to/test_file.py::TestClass::test_case` |
| Rust | `cargo test` | `cargo test <name_fragment>` |
| C++ (GoogleTest) | `ctest` (after cmake) | `ctest -R <pattern>` or `./bin/test --gtest_filter=<pattern>` |

## Anti-patterns to reject

| Don't | Do instead |
|---|---|
| Generate code that "looks right" without verifying APIs exist | Search the codebase or docs; confirm signatures before using them |
| Fix symptoms while ignoring root cause | Reproduce the bug; trace to origin; fix there |
| Bundle large speculative refactors with a bug fix | One concern per change; refactors are separate PRs |
| Add `any` / `void*` / `unsafe` / `# type: ignore` to silence errors | Fix the type; narrow the type; add a proper assertion |
| Leave TODO comments as a substitute for finishing the work | Finish it, or explicitly flag it as out-of-scope for this task |
| Over-engineer (unnecessary classes, factories, abstractions) | Write the simplest thing that works; refactor later if needed |
| Silently swallow errors (`catch {}`, `except: pass`) | Log, re-throw, or return a typed error — never hide failures |
| Delete or loosen existing tests to make new code pass | Fix the code, not the test; explain if the test's assertion was genuinely wrong |
| "While I'm here" drive-by changes unrelated to the task | Note them as suggestions; don't mix them into the diff |

### Implenmentation Imperatives:
1- WE NEVER use keys unles it is absolutely necessary like for third-party LLM APIs. We always prefer Managed Identity (DefaultAzureCredential) for Azure SDK clients.
2- ABSOLUTELY NO silent defaults or fallbacks UNLESS specifically and directly tols or allowed to do it.  SILENT FALLBACKS ARE A MAJOR SOURCE OF BUGS AND CONFUSION. If a required config value is missing, throw an error with a clear message about what's missing and how to fix it.
3- Under NO CRICUMSTANCES do WE EVER create infrastructure in code !!!  EVER EVER EVER !!! ABSOLUTELY NO code that has anythign like createIfNOtExisits(...) EVER !!!

