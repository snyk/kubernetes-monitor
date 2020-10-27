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
        // 3. With SHA instead of tag
        {
            imageName: 'redis@sha256:8e9f8546050da8aae393a41d65ad37166b4f0d8131d627a520c0f0451742e9d6',
            imageId: 'docker.io/library/redis@sha256:8e9f8546050da8aae393a41d65ad37166b4f0d8131d627a520c0f0451742e9d6'
        },
        // 4. With SHA missing in imageId
        {
            imageName: 'redis:prod',
            imageId: 'docker.io/library/redis:eaa6f054e4a140bc3a1696cc7b1e84529e7e9567',
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
        // 7. With docker-pullable as protocol in imageId
        {
            imageName: 'redis:some-tag',
            imageId: 'docker-pullable://name@sha256:8e9f8546050da8aae393a41d65ad37166b4f0d8131d627a520c0f0451742e9d6',
        },
        // 8. With docker as protocol in imageId
        {
            imageName: 'redis:another-tag',
            imageId: 'docker://name@sha256:8e9f8546050da8aae393a41d65ad37166b4f0d8131d627a520c0f0451742e9d6'
        }
    ];

    const result = scanner.getUniqueImages(workload as any);

    t.strictEqual(result.length, 7, 'removed duplicate image');
    const resultWithDigest = result.filter(({imageWithDigest}) => imageWithDigest);
    const resultWithoutDigest = result.filter(({imageWithDigest}) => !imageWithDigest);

    t.strictEqual(resultWithDigest.length, 6, 'correct amount with digest');
    t.strictEqual(resultWithoutDigest.length, 1, 'correct amount without digest');

    resultWithDigest.map((metaData) => {
        t.ok(metaData.imageWithDigest!.includes('redis'), 'has name in imageWithDigest');
        t.ok(metaData.imageWithDigest!.includes('sha256:8e9f8546050da8aae393a41d65ad37166b4f0d8131d627a520c0f0451742e9d6'), 'has digest');

        if (metaData.imageWithDigest!.includes('gcr')) {
            t.ok(metaData.imageWithDigest!.includes('/'), 'contains / in GCR imageWithDigest');
        }

        if (metaData.imageWithDigest!.includes('ecr')) {
            t.ok(metaData.imageWithDigest!.includes('/'), 'contains / in ECR imageWithDigest');
        }
    });

    resultWithoutDigest.map((metadata) => {
        t.ok(metadata.imageName.includes('redis'));
        t.notOk(metadata.imageWithDigest);
    });
});
