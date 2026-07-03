import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Produces one self-contained dist/index.html (JS + CSS inlined) for
// sharing the prototype as a clickable online preview / Artifact.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'dist-single' },
})
