# @computerwwwizards/spec-glue

Binds implementation handlers to Markdown-declared spec steps. Parses a Markdown document (`## Scenarios` / `### <title>` / bullet steps) into executable `Scenario`s, and lets the consumer register `Step(pattern, handler)` bindings that are pattern-matched (with variable extraction) against each step at `.run()` time.
