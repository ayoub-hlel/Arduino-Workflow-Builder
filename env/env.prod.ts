import { PUBLIC_CLERK_PUBLISHABLE_KEY, PUBLIC_CONVEX_URL } from '$env/static/public';

export default {
  // Firebase configuration removed - using Clerk + Convex instead
  clerk: {
    publishableKey: PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_production_placeholder",
  },
  convex: {
    url: PUBLIC_CONVEX_URL || "https://production.convex.cloud",
  },
  server_arduino_url: "https://compile.arduino-workflow-builder.org",
  bucket_name: "arduino-workflow-builder-lesson-test",
  useEmulator: false,
  site: "arduino-workflow-builder-org",
};
