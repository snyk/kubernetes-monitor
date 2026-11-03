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

  describe('monitor image tag', () => {
    const renderImageAndVersion = async (setValues: string) => {
      const { stdout } = await exec(
        `${helmPath} template snyk-monitor ${helmChartPath} --namespace snyk-monitor ${setValues}`,
      );
      const image = /^\s*image: "snyk\/kubernetes-monitor:(.+)"$/m.exec(stdout);
      const version = /name: SNYK_MONITOR_VERSION\n\s*value: (.+)$/m.exec(
        stdout,
      );
      return { image: image?.[1], version: version?.[1] };
    };

    it('should use image.tag when image.releaseTag is not set', async () => {
      const rendered = await renderImageAndVersion('--set image.tag=1.2.3');
      expect(rendered).toEqual({ image: '1.2.3', version: '1.2.3' });
    });

    it('should prefer image.releaseTag over image.tag', async () => {
      // GitOps tools such as ArgoCD overwrite image.tag with a manifest SHA.
      const rendered = await renderImageAndVersion(
        '--set image.tag=0123456789abcdef --set image.releaseTag=2.24.1',
      );
      expect(rendered).toEqual({ image: '2.24.1', version: '2.24.1' });
    });
  });

  describe('sysdig TLS verification', () => {
    const renderSkipTlsVerify = async (setValues: string) => {
      const { stdout } = await exec(
        `${helmPath} template snyk-monitor ${helmChartPath} --namespace snyk-monitor --set sysdig.enabled=true ${setValues}`,
      );
      return /name: SNYK_SYSDIG_SKIP_TLS_VERIFY\n\s*value: (.+)$/m.exec(
        stdout,
      )?.[1];
    };

    it('should verify TLS certificates by default', async () => {
      expect(await renderSkipTlsVerify('')).toEqual('"false"');
    });

    it('should skip TLS verification when sysdig.skipTlsVerify is set', async () => {
      expect(
        await renderSkipTlsVerify('--set sysdig.skipTlsVerify=true'),
      ).toEqual('"true"');
    });
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
