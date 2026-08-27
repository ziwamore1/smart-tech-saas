# Railway Redis

Create Redis as its own Railway service in the `smarttech` project:

- `smarttech-api`: NestJS API container only
- `smarttech-redis`: Railway Redis service, private networking enabled
- `smarttech-worker`: optional future worker service using the same variable

Set `REDIS_URL` on the API and any worker with a Railway reference variable to
the Redis service's internal connection URL. Do not manually copy credentials,
use a public Redis endpoint, or install Redis in the API Dockerfile.

The application accepts both `redis://` and `rediss://` URLs. Development uses
`REDIS_URL=redis://localhost:6379`; production must use the Railway private
URL. Redis persistence should be enabled on the Railway service where the
selected plan supports it, but PostgreSQL remains the source of truth and all
Redis data must be rebuildable.

BullMQ producers, workers, cache/state code, and distributed HTTP rate limits
all use the centralized Redis configuration in
`backend/src/queues/redis.config.ts`. A Redis outage degrades health and
optional cache/queue features without stopping the API; queue operations that
require Redis report failure and can be retried.
