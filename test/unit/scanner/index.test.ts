import * as tap from 'tap';

import * as scanner from '../../../src/scanner';
import { IWorkload } from '../../../src/transmitter/types';

tap.test('getUniqueImages()', async (t) => {
    const workload: Partial<IWorkload>[] = [
        // 1.DCR
        {
            imageName: 'redis:latest',
            imageId: 'docker.io/library/redis@sha256:8e9f8546050da8aae393a41d65ad37166b4f0d8131d627a520c0f0451742e9d6'
        },
        // 2.Duplicate to verify uniqueness
        {
            imageName: 'redis:latest',
            imageId: 'docker.io/library/redis@sha256:8e9f8546050da8aae393a41d65ad37166b4f0d8131d627a520c0f0451742e9d6'
        },
        // 3. Duplicate without tag
        {
            imageName: 'redis',
            imageId: 'docker.io/library/redis@sha256:8e9f8546050da8aae393a41d65ad37166b4f0d8131d627a520c0f0451742e9d6'
        },
        // 4. Duplicate with SHA instead of tag
        {
            imageName: 'redis@sha256:8e9f8546050da8aae393a41d65ad37166b4f0d8131d627a520c0f0451742e9d6',
            imageId: 'docker.io/library/redis@sha256:8e9f8546050da8aae393a41d65ad37166b4f0d8131d627a520c0f0451742e9d6'
        },
        // 5. GCR
        {
            imageName: 'gcr.io/test-dummy/redis:latest',
            imageId: 'sha256:8e9f8546050da8aae393a41d65ad37166b4f0d8131d627a520c0f0451742e9d6'
        },
        // 6. ECR
        {
            imageName: '291964488713.dkr.ecr.us-east-2.amazonaws.com/snyk/redis:latest',
            imageId: 'sha256:8e9f8546050da8aae393a41d65ad37166b4f0d8131d627a520c0f0451742e9d6'
        },
    ];

    const result = scanner.getUniqueImages(workload as any);

    t.strictEqual(result.length, 3, 'removed duplicate image');
    result.map((metaData) => {
        t.ok(metaData.imageWithDigest.includes('redis'), 'has name in imageWithDigest');
        t.ok(metaData.imageWithDigest.includes('sha256:8e9f8546050da8aae393a41d65ad37166b4f0d8131d627a520c0f0451742e9d6'), 'has digest');

        if (metaData.imageWithDigest.includes('gcr')) {
            t.ok(metaData.imageWithDigest.includes('/'), 'contains / in GCR imageWithDigest');
        }

        if (metaData.imageWithDigest.includes('ecr')) {
            t.ok(metaData.imageWithDigest.includes('/'), 'contains / in ECR imageWithDigest');
        }
    });
});
