import { defineConfig } from "cypress"

export default defineConfig({
  video: false,
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? "http://localhost:3000",
    specPattern: "cypress/e2e/**/*.cy.{ts,tsx}",
    supportFile: "cypress/support/e2e.ts",
    viewportWidth: 1280,
    viewportHeight: 720,
    env: {
      apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
    },
  },
})
