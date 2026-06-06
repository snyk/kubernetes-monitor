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

  describe('deleteGracePeriod values', () => {
    it('should render without deleteGracePeriod env vars when disabled (default)', async () => {
      const { stdout } = await exec(
        `${helmPath} template snyk-monitor ${helmChartPath} --namespace snyk-monitor --dry-run`,
      );
      expect(stdout).not.toContain('SNYK_DELETE_GRACE_PERIOD_ENABLED');
      expect(stdout).not.toContain('grace-period-state');
    });

    it('should render with deleteGracePeriod env vars and volume when enabled', async () => {
      const { stdout } = await exec(
        `${helmPath} template snyk-monitor ${helmChartPath} --namespace snyk-monitor --dry-run ` +
          '--set deleteGracePeriod.enabled=true ' +
          '--set deleteGracePeriod.pvc.create=true',
      );
      expect(stdout).toContain('SNYK_DELETE_GRACE_PERIOD_ENABLED');
      expect(stdout).toContain('SNYK_DELETE_GRACE_PERIOD_MAX_DURATION');
      expect(stdout).toContain('grace-period-state');
      expect(stdout).toContain('/var/data/grace-period');
      expect(stdout).toContain('snyk-monitor-grace-period');
    });

    it('should create grace-period PVC when pvc.create is true', async () => {
      const { stdout } = await exec(
        `${helmPath} template snyk-monitor ${helmChartPath} --namespace snyk-monitor --dry-run ` +
          '--set deleteGracePeriod.enabled=true ' +
          '--set deleteGracePeriod.pvc.create=true',
      );
      expect(stdout).toContain('kind: PersistentVolumeClaim');
      expect(stdout).toContain('snyk-monitor-grace-period');
      expect(stdout).toContain('64Mi');
    });

    it('should not create grace-period PVC when pvc.create is false', async () => {
      const { stdout } = await exec(
        `${helmPath} template snyk-monitor ${helmChartPath} --namespace snyk-monitor --dry-run ` +
          '--set deleteGracePeriod.enabled=true',
      );
      // The volume reference is there, but PVC resource is not created
      expect(stdout).toContain('grace-period-state');
      // Only the existing snyk-monitor-pvc template may create a PVC, not the grace period one
      expect(stdout).not.toMatch(
        /kind: PersistentVolumeClaim[\s\S]*?snyk-monitor-grace-period/,
      );
    });

    it('should render custom maxDuration value', async () => {
      const { stdout } = await exec(
        `${helmPath} template snyk-monitor ${helmChartPath} --namespace snyk-monitor --dry-run ` +
          '--set deleteGracePeriod.enabled=true ' +
          '--set deleteGracePeriod.maxDuration="14d"',
      );
      expect(stdout).toContain('14d');
    });
  });
});
