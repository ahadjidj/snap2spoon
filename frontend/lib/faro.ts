import { getWebInstrumentations, initializeFaro } from "@grafana/faro-web-sdk";
import { TracingInstrumentation } from "@grafana/faro-web-tracing";

// No-op when NEXT_PUBLIC_FARO_URL is not set (standby mode).
// To activate: set NEXT_PUBLIC_FARO_URL (and optionally NEXT_PUBLIC_FARO_APP_NAME)
// at Docker build time and rebuild the image — see README.md § Observability.
export function initFaro() {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_FARO_URL) return;

  initializeFaro({
    url: process.env.NEXT_PUBLIC_FARO_URL,
    app: {
      name: process.env.NEXT_PUBLIC_FARO_APP_NAME ?? "snap2spoon",
      version: "1.0.0",
      environment: process.env.NODE_ENV ?? "production",
    },
    instrumentations: [
      ...getWebInstrumentations({ captureConsole: true }),
      new TracingInstrumentation(),
    ],
  });
}
