import { exec } from 'child-process-promise';
import { existsSync, chmodSync, rmSync } from 'fs';
import { platform } from 'os';
import { parseAllDocuments } from 'yaml';

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

  describe('image pull secrets', () => {
    const renderPodSpec = async (setValues = '') => {
      const { stdout } = await exec(
        `${helmPath} template snyk-monitor ${helmChartPath} --namespace snyk-monitor ${setValues}`,
      );
      const deployment = parseAllDocuments(stdout)
        .map((document) => document.toJS())
        .find((manifest) => manifest?.kind === 'Deployment');
      expect(deployment).toBeDefined();
      return deployment.spec.template.spec;
    };

    it('should not set imagePullSecrets by default', async () => {
      const podSpec = await renderPodSpec();

      expect(podSpec).not.toHaveProperty('imagePullSecrets');
    });

    it('should add imagePullSecrets to the snyk-monitor pod', async () => {
      const podSpec = await renderPodSpec(
        "--set 'imagePullSecrets[0].name=regcred'",
      );

      expect(podSpec.imagePullSecrets).toEqual([{ name: 'regcred' }]);
    });

    it('should add multiple imagePullSecrets in the given order', async () => {
      const podSpec = await renderPodSpec(
        "--set 'imagePullSecrets[0].name=first,imagePullSecrets[1].name=second'",
      );

      expect(podSpec.imagePullSecrets).toEqual([
        { name: 'first' },
        { name: 'second' },
      ]);
    });

    describe('schema validation', () => {
      // Match the schema violation reported by helm rather than the flag name:
      // the failed command line is part of the error message, so a loose match
      // would pass for any helm failure.
      it.each([
        [
          'an item that is not an object',
          "--set 'imagePullSecrets[0]=regcred'",
          /imagePullSecrets\.0: Invalid type\. Expected: object, given: string/,
        ],
        [
          'an item without a name',
          "--set 'imagePullSecrets[0].other=value'",
          /imagePullSecrets\.0: name is required/,
        ],
        [
          'an item with an empty name',
          "--set 'imagePullSecrets[0].name='",
          /imagePullSecrets\.0\.name: String length must be greater than or equal to 1/,
        ],
      ])('should reject %s', async (_description, setValues, violation) => {
        await expect(renderPodSpec(setValues)).rejects.toThrow(violation);
      });
    });
  });
});
