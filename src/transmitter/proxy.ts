import { httpOverHttp, httpsOverHttp } from 'tunnel';
import { Agent, globalAgent as HttpAgent } from 'http';
import { Agent as HttpsAgentClass, globalAgent as HttpsAgent } from 'https';

import { logger } from '../common/logger';

function getTlsOptions(agent: Agent | undefined): {
  rejectUnauthorized?: boolean;
} {
  if (agent instanceof HttpsAgentClass) {
    return { rejectUnauthorized: agent.options.rejectUnauthorized };
  }
  return {};
}

export function getProxyAgent(
  config: Record<string, any>,
  endpoint: string,
  callerAgent?: Agent,
): Agent {
  const url = new URL(endpoint);

  // Check if the address is explicitly marked not to be proxied.
  if (config.NO_PROXY) {
    const hosts = config.NO_PROXY.split(',').map((host) => host.toLowerCase());

    if (hosts.includes(url.hostname.toLowerCase())) {
      return (
        callerAgent ?? (url.protocol === 'https:' ? HttpsAgent : HttpAgent)
      );
    }

    // CIDR ranges are not supported, e.g. NO_PROXY=192.168.0.0/16.
    // Wildcards are also not supported, e.g. NO_PROXY=*.mydomain.local
    // HTTPS proxies (the connection to the proxy, not to the upstream) are not supported.
  }

  switch (url.protocol) {
    case 'http:':
      if (!config.HTTP_PROXY) {
        return callerAgent ?? HttpAgent;
      }
      const httpProxyUrl = new URL(config.HTTP_PROXY);
      return httpOverHttp({
        proxy: {
          host: httpProxyUrl.hostname,
          port: getPort(httpProxyUrl),
        },
      });

    case 'https:':
      if (!config.HTTPS_PROXY) {
        return callerAgent ?? HttpsAgent;
      }
      const httpsProxyUrl = new URL(config.HTTPS_PROXY);
      return httpsOverHttp({
        proxy: {
          host: httpsProxyUrl.hostname,
          port: getPort(httpsProxyUrl),
        },
        ...getTlsOptions(callerAgent),
      });

    default:
      logger.error(
        { urlHost: url.host, urlProtocol: url.protocol },
        'Unsupported protocol for proxying',
      );
      throw new Error('Unsupported protocol for proxying');
  }
}

function getPort(proxyUrl: URL): number {
  const port = parseInt(proxyUrl.port);
  if (port) return port;

  switch (proxyUrl.protocol) {
    case 'ftp:':
      return 21;
    case 'http:':
      return 80;
    case 'https:':
      return 443;
    case 'ws:':
      return 80;
    case 'wss:':
      return 443;
    default:
      throw new Error('proxy port not defined');
  }
}
