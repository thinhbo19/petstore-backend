/* eslint-disable no-console */
const base = process.env.SMOKE_BASE_URL || "http://localhost:8888";

async function check(path) {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status}`);
  }
  const body = await res.json();
  console.log(path, body.status || "ok");
}

async function run() {
  await check("/health");
  await check("/ready");
  console.log("Smoke checks passed");
}

run().catch((e) => {
  console.error("Smoke checks failed:", e.message);
  process.exit(1);
});
