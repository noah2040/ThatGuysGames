import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The cloud preview hostname changes per workspace, so it is passed in per
// process rather than hardcoded here.
const previewHost = process.env.PREVIEW_HOST?.trim()

export default defineConfig({
  plugins: [react()],
  server: {
    // Matches the Supabase project's local Site URL, so email confirmation
    // links land back on the app during development.
    port: 3000,
    allowedHosts: previewHost ? [previewHost] : undefined,
  },
})
