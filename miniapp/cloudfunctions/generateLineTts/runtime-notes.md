# Runtime notes

The cloud function calls the local TTS server only after both asset and global cache misses. This keeps repeated playback cheap and avoids burning user quota for cached learning assets.
