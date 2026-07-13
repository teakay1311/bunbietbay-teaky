export async function runSupabaseMutation(run: () => PromiseLike<{ error: unknown }>) {
  const response = await Promise.resolve(run());
  if (response.error) throw response.error;
}
