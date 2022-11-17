import { exec } from 'child-process-promise';
import { existsSync, chmodSync, rmSync } from 'fs';
import { platform } from 'os';

const helmVersion = '3.0.0';

async function downloadHelm(helmPath): Promise<void> {
  const os = platform();
  const res = await exec(
    `curl https://get.helm.sh/helm-v${helmVersion}-${os}-amd64.tar.gz | tar xfzO - ${os}-amd64/helm > ${helmPath}`,
  );
  chmodSync(helmPath, 0o755); // rwxr-xr-x
}

describe('helm chart parameter validation', () => {
  let helmPath = 'helm';
  let removeHelm = false;
  const helmChartPath = './snyk-monitor';

  beforeAll(async () => {
    await exec(`helm --help`).catch((_) => {
      helmPath = './helm';
      if (existsSync('./helm')) {
        return Promise.resolve();
      }
      removeHelm = true;
      return downloadHelm(helmPath);
    });
  });

  afterAll(() => {
    if (removeHelm) {
      rmSync(helmPath);
    }
  });

  it('should accept empty cluster name', async () => {
    await exec(
      // cannot use helm upgrade --install as that requires a cluster
      `${helmPath} template snyk-monitor ${helmChartPath} --namespace snyk-monitor --dry-run`,
    );
  });

  it('should accept valid cluster name', async () => {
    await exec(
      // cannot use helm upgrade --install as that requires a cluster
      `${helmPath} template snyk-monitor ${helmChartPath} --namespace snyk-monitor --dry-run ` +
        '--set clusterName="Alpha Beta 12_345"',
    );
  });

  it('should reject invalid cluster name', async () => {
    try {
      await exec(
        // cannot use helm upgrade --install as that requires a cluster
        `${helmPath} template snyk-monitor ${helmChartPath} --namespace snyk-monitor --dry-run ` +
          '--set clusterName="Alpha?Beta"',
      );
      fail('The name should have been rejected.');
    } catch (_) {
      // this is expected
    }
  });
});
