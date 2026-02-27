# TokeScope Architecture

## Goals

- Minimal integration friction
- No blocking telemetry
- Clear workspace isolation
- Simple deployability
- Privacy-first defaults

---

## SDK Layer

Responsibilities:

- Wrap LLM client calls
- Capture token usage + latency
- Batch events asynchronously
- Never crash the user application
- Respect privacy configuration

Design tradeoff:

- Simplicity over full OpenTelemetry compliance

The SDK prioritizes minimal setup and safety over deep tracing integration.

---

## Backend Layer

Responsibilities:

- Accept batched telemetry
- Enforce workspace separation
- Persist events in PostgreSQL
- Compute aggregate metrics

Tradeoffs:

- No message queue (MVP simplicity)
- No rate limiting (to be added)
- No background job workers yet

This layer is intentionally monolithic for clarity and rapid iteration.

---

## Data Model

Each event includes:

- Model metadata
- Token usage
- Latency
- Cost estimation
- Status (ok / error)
- Error classification
- Request identifiers
- Optional prompt/response content

The schema is designed to support:

- Cost aggregation
- Error rate tracking
- Latency distribution metrics
- Multi-provider expansion

---

## Dashboard Layer

Responsibilities:

- Display total cost
- Show latency trends
- Show recent calls
- Provide quick observability surface

Tradeoff:

- Lightweight UI over complex analytics
- Client-side transformation for MVP simplicity

---

## Future Extensions

- Provider abstraction layer
- Streaming capture
- p95 / p99 latency metrics
- Error rate visualizations
- Hosted deployment
- Team-level API keys
