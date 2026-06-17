const port = process.env.OFFERYOU_DESKTOP_PORT || "3100";
const HEALTH_URL = `http://127.0.0.1:${port}/me`;
const TIMEOUT_MS = 30_000;
const INTERVAL_MS = 500;

const start = Date.now();

async function check() {
  try {
    const resp = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2000) });
    if (resp.ok) {
      console.log("OfferYou desktop server ready");
      process.exit(0);
    }
  } catch {}

  if (Date.now() - start > TIMEOUT_MS) {
    console.error(`Health check timed out after ${TIMEOUT_MS / 1000}s`);
    process.exit(1);
  }

  setTimeout(check, INTERVAL_MS);
}

check();
