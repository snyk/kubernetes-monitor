export function throwIfEnvironmentVariableUnset(variableName: string) {
  if (!process.env[variableName]) {
    throw new Error(`Missing required environment variable ${variableName}`);
  }
}
