import { platform, tmpdir } from 'os';
import { exec } from 'child-process-promise';

import { existsSync, unlinkSync, mkdirSync } from 'fs';

const directory = `${tmpdir()}/skopeo`;
export const path = `${directory}/skopeo`;

export async function install() {
  try {
    await exec('which skopeo');
    console.log('Skopeo already installed :tada:');
  } catch (err) {
    if (platform() !== 'linux') {
      throw new Error(
        'skopeo is missing from the system, please install with brew',
      );
    }

    console.log('installing Skopeo');
    await exec('git clone https://github.com/containers/skopeo');
    await exec('(cd skopeo && make binary-static DISABLE_CGO=1)');
    await exec('sudo mkdir -p /etc/containers');
    await exec('sudo chown circleci:circleci /etc/containers');
    await exec('cp ./skopeo/default-policy.json /etc/containers/policy.json');
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }
    await exec(`mv ./skopeo/skopeo ${path}`);
    process.env['PATH'] = process.env['PATH'] + `:${directory}`;
    await exec('rm -rf ./skopeo');
  }
}

export async function remove() {
  if (existsSync(path)) {
    unlinkSync(path);
  }
}
