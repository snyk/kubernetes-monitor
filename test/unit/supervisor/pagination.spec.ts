let sleepMock = jest.fn();
jest.mock('sleep-promise', () => sleepMock);

import { IRequestError } from '../../../src/supervisor/types';
import {
  paginatedNamespacedList,
  paginatedClusterList,
} from '../../../src/supervisor/watchers/handlers/pagination';

describe('pagination', () => {
  afterEach(() => {
    sleepMock.mockRestore();
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  describe.each([
    [
      'paginatedNamespacedList',
      (namespace: string, workloads: { items: Array<any> }, listFn: any) =>
        paginatedNamespacedList(namespace, workloads, listFn),
    ],
    [
      'paginatedClusterList',
      (_namespace: string, workloads: { items: Array<any> }, listFn: any) =>
        paginatedClusterList(workloads, listFn),
    ],
  ])('error handling: %s', (_testCaseName, listFn) => {
    afterEach(() => {
      sleepMock.mockRestore();
    });

    it.each([['ECONNRESET']])('handles network error: %s', async (code) => {
      const sleepError = new Error('timeout');
      sleepMock
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(sleepError);

      const listError = { code } as IRequestError;
      const listMock = jest.fn().mockRejectedValue(listError);
      const pushMock = jest.fn();
      const workloads = { items: [] };
      workloads.items.push = pushMock;
      const namespace = 'unused';

      await listFn(namespace, workloads, listMock).catch((error) =>
        expect(error).toEqual(sleepError),
      );

      expect(listMock).toHaveBeenCalledTimes(2);
      expect(sleepMock).toHaveBeenCalledTimes(2);
      expect(pushMock).not.toHaveBeenCalled();
    });

    it.each([['EPIPE']])('handles unknown error: %s', async (code) => {
      const listError = { code } as IRequestError;
      const listMock = jest.fn().mockRejectedValue(listError);
      const pushMock = jest.fn();
      const workloads = { items: [] };
      workloads.items.push = pushMock;
      const namespace = 'unused';

      await listFn(namespace, workloads, listMock).catch((error) =>
        expect(error).toEqual(listError),
      );

      expect(listMock).toHaveBeenCalledTimes(1);
      expect(sleepMock).not.toHaveBeenCalled();
      expect(pushMock).not.toHaveBeenCalled();
    });

    it.each([[429], [502], [503], [504]])(
      'handles http error: %s',
      async (code) => {
        const sleepError = new Error('timeout');
        sleepMock
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(sleepError);

        const listError = { response: { statusCode: code } } as IRequestError;
        const listMock = jest.fn().mockRejectedValue(listError);
        const pushMock = jest.fn();
        const workloads = { items: [] };
        workloads.items.push = pushMock;
        const namespace = 'unused';

        await listFn(namespace, workloads, listMock).catch((error) =>
          expect(error).toEqual(sleepError),
        );

        expect(listMock).toHaveBeenCalledTimes(2);
        expect(sleepMock).toHaveBeenCalledTimes(2);
        expect(pushMock).not.toHaveBeenCalled();
      },
    );

    it.each([[410]])('handles unrecoverable http error: %s', async (code) => {
      const listError = { response: { statusCode: code } } as IRequestError;
      const listMock = jest.fn().mockRejectedValue(listError);
      const pushMock = jest.fn();
      const workloads = { items: [] };
      workloads.items.push = pushMock;
      const namespace = 'unused';

      await listFn(namespace, workloads, listMock).catch((error) =>
        expect(error).toEqual(new Error('could not list workload')),
      );

      expect(listMock).toHaveBeenCalledTimes(1);
      expect(sleepMock).not.toHaveBeenCalled();
      expect(pushMock).not.toHaveBeenCalled();
    });

    it.each([[[429, 502, 503, 504, 410]]])(
      'handles sequence of http errors: %s',
      async (codes) => {
        const listMock = jest.fn();
        for (const code of codes) {
          const listError = { response: { statusCode: code } } as IRequestError;
          listMock.mockRejectedValueOnce(listError);
        }

        const pushMock = jest.fn();
        const workloads = { items: [] };
        workloads.items.push = pushMock;
        const namespace = 'unused';

        await listFn(namespace, workloads, listMock).catch((error) =>
          expect(error).toEqual(new Error('could not list workload')),
        );

        expect(listMock).toHaveBeenCalledTimes(codes.length);
        expect(sleepMock).toHaveBeenCalledTimes(codes.length - 1);
        expect(pushMock).not.toHaveBeenCalled();
      },
    );

    it('handles failure after success', async () => {
      const listError = { response: { statusCode: 410 } } as IRequestError;
      const items = [{ metadata: { name: 'pod ' } }];
      const listMock = jest
        .fn()
        .mockResolvedValueOnce({
          items,
          metadata: {
            _continue: 'token',
          },
        })
        .mockRejectedValueOnce(listError);

      const pushMock = jest.fn();
      const workloads = { items: [] };
      workloads.items.push = pushMock;
      const namespace = 'unused';

      await listFn(namespace, workloads, listMock).catch((error) =>
        expect(error).toEqual(new Error('could not list workload')),
      );

      expect(listMock).toHaveBeenCalledTimes(2);
      expect(sleepMock).not.toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { name: 'pod ' },
        }),
      );
    });

    it('retries after failure', async () => {
      const listError = { response: { statusCode: 429 } } as IRequestError;
      const firstItems = [{ metadata: { name: 'first ' } }];
      const secondItems = [{ metadata: { name: 'second ' } }];
      const listMock = jest
        .fn()
        .mockResolvedValueOnce({
          items: firstItems,
          metadata: {
            _continue: 'token',
          },
        })
        .mockRejectedValueOnce(listError)
        .mockResolvedValueOnce({
          response: {},
          body: {
            items: secondItems,
            metadata: {
              _continue: undefined,
            },
          },
        });

      const pushMock = jest.fn();
      const workloads = { items: [] };
      workloads.items.push = pushMock;
      const namespace = 'unused';

      await listFn(namespace, workloads, listMock).catch((error) =>
        expect(error).toEqual(new Error('could not list workload')),
      );

      expect(listMock).toHaveBeenCalledTimes(3);
      expect(sleepMock).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          metadata: { name: 'first ' },
        }),
      );
      expect(pushMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          metadata: { name: 'second ' },
        }),
      );
    });
  });
});
