import { exec, PromiseResult } from 'child-process-promise';

/**
 * It seems like there is an issue with Jest where changes to process.env are not persisted through
 * calls to child_process.exec(). This causes env vars like KUBECONFIG to be lost and to fail our tests.
 * For now use this wrapper to explicitly pass process.env as a workaround.
 * https://github.com/facebook/jest/issues/9341
 * https://github.com/facebook/jest/issues/9264
 * https://snyk.slack.com/archives/CLW30N31V/p1612860708027800?thread_ts=1612856703.026500&cid=CLW30N31V
 */
export async function execWrapper(command: string): Promise<PromiseResult<string>> {
  return await exec(command, { env: process.env });
}
