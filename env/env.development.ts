import { PUBLIC_CLERK_PUBLISHABLE_KEY, PUBLIC_CONVEX_URL } from '$env/static/public';

export default {
  // Firebase configuration removed - using Clerk + Convex instead
  clerk: {
    publishableKey: PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_development_placeholder",
  },
  convex: {
    url: PUBLIC_CONVEX_URL || "https://development.convex.cloud",
  },
  server_arduino_url: "http://localhost:3001",
  bucket_name: "arduino-workflow-builder-lesson-dev",
  useEmulator: true,
  site: "arduino-workflow-builder-dev",
};
