export type ValidationResult<T> = { message: string; status: false } | { output: T; status: true };
