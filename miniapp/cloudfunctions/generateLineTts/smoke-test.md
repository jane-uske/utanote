# Smoke test

1. Confirm local bridge health: `GET /health`.
2. Call `generateLineTts` with `source=user_uploaded_song` and a short Japanese line.
3. Check result contains `fileID`, `cacheHit=false`, `generated=true`.
4. Call the same request again.
5. Check result contains `cacheHit=true`, `generated=false`, `quotaConsumed=false`.
