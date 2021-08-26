import { URL } from 'url';
import { httpOverHttp, httpsOverHttp } from 'tunnel';
import { Agent, globalAgent as HttpAgent } from 'http';
import { globalAgent as HttpsAgent } from 'https';

import { logger } from '../common/logger';

export function getProxyAgent(
  config: Record<string, any>,
  endpoint: string,
): Agent {
  const url = new URL(endpoint);

  // Check if the address is explicitly marked not to be proxied.
  if (config.NO_PROXY) {
    const hosts = config.NO_PROXY.split(',').map((host) => host.toLowerCase());

    if (hosts.includes(url.hostname.toLowerCase())) {
      return url.protocol === 'https:' ? HttpsAgent : HttpAgent;
    }

    // CIDR ranges are not supported, e.g. NO_PROXY=192.168.0.0/16.
    // Wildcards are also not supported, e.g. NO_PROXY=*.mydomain.local
    // HTTPS proxies (the connection to the proxy, not to the upstream) are not supported.
  }

  switch (url.protocol) {
    case 'http:':
      if (!config.HTTP_PROXY) {
        return HttpAgent;
      }
      const httpProxyUrl = new URL(config.HTTP_PROXY);
      return httpOverHttp({
        proxy: {
          host: httpProxyUrl.hostname,
          port: parseInt(httpProxyUrl.port) || 80,
        },
      });

    case 'https:':
      if (!config.HTTPS_PROXY) {
        return HttpsAgent;
      }
      const httpsProxyUrl = new URL(config.HTTPS_PROXY);
      return httpsOverHttp({
        proxy: {
          host: httpsProxyUrl.hostname,
          port: parseInt(httpsProxyUrl.port) || 443,
        },
      });

    default:
      logger.error(
        { urlHost: url.host, urlProtocol: url.protocol },
        'Unsupported protocol for proxying',
      );
      throw new Error('Unsupported protocol for proxying');
  }
}
