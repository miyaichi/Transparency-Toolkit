"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect, useState } from "react"

export default function VerifySentryPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Sentry Configuration Verification</h1>

      <div className="p-4 border rounded bg-gray-50">
        <h2 className="font-semibold">Environment Variables</h2>
        <p>
          <strong>NEXT_PUBLIC_SENTRY_DSN:</strong> {process.env.NEXT_PUBLIC_SENTRY_DSN ? "Present" : "Missing"}
        </p>
        <p className="text-sm text-gray-500 break-all">{process.env.NEXT_PUBLIC_SENTRY_DSN}</p>
        <p>
          <strong>NODE_ENV:</strong> {process.env.NODE_ENV}
        </p>
      </div>

      <div className="space-x-4">
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => {
            console.log("Sending test message to Sentry...")
            const eventId = Sentry.captureMessage("Test Message from Frontend Verification Page")
            console.log("Sent message with Event ID:", eventId)
            alert(`Sent message. ID: ${eventId}`)
          }}
        >
          Capture Message
        </button>

        <button
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          onClick={() => {
            console.log("Throwing test error...")
            throw new Error("Sentry Frontend Verification Error (Unhandled)")
          }}
        >
          Throw Unhandled Error
        </button>

        <button
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          onClick={() => {
            console.log("Capturing explicit exception...")
            try {
              const eventId = Sentry.captureException(new Error("Sentry Frontend Verification Error (Explicit)"))
              console.log("Captured explicit exception with Event ID:", eventId)
              alert(`Sent explicit exception. ID: ${eventId}`)
            } catch (e) {
              console.error("Failed to capture:", e)
              alert(`Failed to capture: ${e}`)
            }
          }}
        >
          Capture Explicit Error
        </button>
      </div>

      <div className="p-4 border rounded bg-gray-50 mt-4">
        <h2 className="font-semibold">SDK Status (Client)</h2>
        <pre className="text-xs overflow-auto mt-2 p-2 bg-gray-200 rounded">
          {JSON.stringify(
            {
              isInitialized: !!Sentry.getClient(),
              options: Sentry.getClient()?.getOptions()
                ? {
                    dsn: Sentry.getClient()?.getOptions().dsn,
                    enabled: Sentry.getClient()?.getOptions().enabled,
                    environment: Sentry.getClient()?.getOptions().environment,
                    release: Sentry.getClient()?.getOptions().release,
                    debug: Sentry.getClient()?.getOptions().debug,
                    sampleRate: Sentry.getClient()?.getOptions().sampleRate
                  }
                : "Client not found"
            },
            null,
            2
          )}
        </pre>
      </div>
    </div>
  )
}
