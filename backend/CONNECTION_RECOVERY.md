# Database connection recovery

- API errors are handled for all `/api` routes. A disconnected caller ends its request; it does not stop other requests.
- Database transport errors return 503 with a trace ID. SQL errors return 500. Write errors report an unknown outcome: do not blindly resubmit.
- Logs contain exception type chains, SQLSTATE, path and duration, not SQL, credentials or exception messages.
- Read retries belong to the frontend React Query layer: one retry for transient network/HTTP failures. Axios and backend do not replay writes or requests. Certificate/configuration problems still require diagnosis; retries do not repair them.
- Default DB connection timeout is 5 seconds and command timeout 8 seconds unless explicitly configured. Frontend request timeout is 15 seconds per attempt. These are per-operation limits, not a guarantee for endpoints with multiple queries.
- TLS settings are preserved. Do not disable SSL to recover from a handshake error.
- `GET /api/health` checks API liveness. `GET /api/health/ready` probes the database with a three-second deadline and returns 503 if unavailable. Readiness failure should not trigger a process restart loop.
- Startup migration is opt-in (`Database:InitializeOnStartup=true`). Prefer running `dotnet run --project backend/src/QuanLyDatPhong_TBD.Api -- --migrate-database` separately with the appropriate environment. This command migrates and exits without seeding.
- Visual Studio can still break on thrown exceptions according to debugger settings even when middleware handles them. Use Ctrl+F5 for normal operation; do not confuse debugger suspension with process failure.

Validation: inject client cancellation and wrapped Npgsql SSL failures into the middleware for GET/POST; confirm 499/503, one execution, redacted output and unknown write outcome. Test readiness with unavailable DB and recovery without altering TLS. End-to-end UI testing must also be performed after updating the separate AI Studio frontend.
