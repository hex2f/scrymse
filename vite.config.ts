import process from 'node:process'

import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

function pagesBase(): string {
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
  if (!repo) return '/'
  if (repo.endsWith('.github.io')) return '/'
  return `/${repo}/`
}

export default defineConfig({
  base: pagesBase(),
  plugins: [
    tailwindcss(),
  ],
})