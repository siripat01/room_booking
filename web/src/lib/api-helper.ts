export async function treatyFetch<T, E>(
  promise: Promise<{ data: T; error: E | null; status: number }>,
): Promise<T> {
  const { data, error, status } = await promise;
  if (error) {
    // Extract error message from Eden error structure
    const message =
      error instanceof Error
        ? error.message
        : (error as any)?.value?.message || `API Error (Status ${status})`;
    throw new Error(message);
  }
  return data as T;
}
