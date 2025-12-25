import { withSentryConfig } from "@sentry/nextjs"

const nextConfig = {
  output: "standalone"
}

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Suppresses source map uploading logs during build
  silent: true
  // org: "transparency-toolkit",
  // project: "javascript-nextjs",

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
})
