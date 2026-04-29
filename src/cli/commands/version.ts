export async function version(): Promise<void> {
  console.log(process.env.MDB_VERSION ?? "unknown");
}
