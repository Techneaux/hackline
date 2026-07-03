export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureTodoistAccount } = await import("./lib/sync/engine");
    ensureTodoistAccount();
    const { startScheduler } = await import("./lib/sync/scheduler");
    startScheduler();
  }
}
