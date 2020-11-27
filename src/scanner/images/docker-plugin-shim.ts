import * as depGraphLib from '@snyk/dep-graph';
import { ManifestFile, PluginResponse, ScanResult } from 'snyk-docker-plugin';

export interface PluginMetadata {
  name: 'snyk-docker-plugin';
  runtime: string | undefined;
  packageManager: string;
  dockerImageId: string;
  imageLayers: string[];
}

/** @deprecated */
export interface LegacyPluginResponse {
  plugin: PluginMetadata;
  package: DependencyTree;
  manifestFiles: ManifestFile[];
  hashes: string[];

  /**
   * WARNING! This field was added by kubernetes-monitor.
   * It is not part of the normal plugin response. */
  imageMetadata: {
    image: string;
    imageTag: string;
    imageDigest?: string;
  };
}

interface ExtractedFacts {
  depGraph: depGraphLib.DepGraph;
  manifestFiles?: ManifestFile[];
  hashes?: string[];
  imageLayers?: string[];
  rootFs?: string[];
  imageId?: string;
  imageOsReleasePrettyName?: string;
  platform?: string;
}

/** @deprecated */
export interface DependencyTree {
  name: string;
  type: string;
  targetOS?: {
    name: string;
    prettyName: string;
    version: string;
  };
  targetFile?: string;
  testedFiles?: string[];
  dependencies: any;
  version: string | undefined;
  dockerImageId?: string;
  docker?: {
    dockerImageId?: string;
    imageLayers?: string[];
    rootFs?: string[];
    imageName?: string;
    hashes?: string[];
  };
  rootFs?: string[];
  meta?: Meta;
}

/**
 * Meta is an object that eventually gets passed to project.monitor.meta in Registry
 * and gets persisted in the database. It is currently passed unmodified straight
 * to the database.
 *
 * The project.monitor.meta table is an HSTORE (key-value strings) so we must ensure
 * that we pass exactly this type of data to avoid mistakes.
 */
export interface Meta extends Partial<Record<string, string>> {
  platform?: string;
}

export function extractFactsFromDockerPluginResponse(
  pluginResponse: PluginResponse,
): ExtractedFacts {
  const depGraph: depGraphLib.DepGraph = pluginResponse.scanResults[0].facts.find(
    (fact) => fact.type === 'depGraph',
  )?.data;

  const manifestFiles:
    | ManifestFile[]
    | undefined = pluginResponse.scanResults[0].facts.find(
    (fact) => fact.type === 'imageManifestFiles',
  )?.data;

  const hashes: string[] | undefined = pluginResponse.scanResults[0].facts.find(
    (fact) => fact.type === 'keyBinariesHashes',
  )?.data;

  const imageLayers:
    | string[]
    | undefined = pluginResponse.scanResults[0].facts.find(
    (fact) => fact.type === 'imageLayers',
  )?.data;

  const rootFs: string[] | undefined = pluginResponse.scanResults[0].facts.find(
    (fact) => fact.type === 'rootFs',
  )?.data;

  const imageId: string | undefined = pluginResponse.scanResults[0].facts.find(
    (fact) => fact.type === 'imageId',
  )?.data;

  const imageOsReleasePrettyName:
    | string
    | undefined = pluginResponse.scanResults[0].facts.find(
    (fact) => fact.type === 'imageOsReleasePrettyName',
  )?.data;

  const platform = pluginResponse.scanResults[0].identity.args?.platform;

  return {
    depGraph,
    manifestFiles,
    hashes,
    imageLayers,
    rootFs,
    imageId,
    imageOsReleasePrettyName,
    platform,
  };
}

export function buildDockerPropertiesOnDepTree(
  depTree: depGraphLib.legacy.DepTree,
  dockerPluginFacts: ExtractedFacts,
  image: string,
): DependencyTree {
  const {
    hashes,
    imageLayers,
    rootFs,
    imageId,
    imageOsReleasePrettyName,
    platform,
  } = dockerPluginFacts;

  const mutatedDepTree = depTree as DependencyTree;
  mutatedDepTree.docker = {
    hashes,
    imageLayers,
    rootFs,
    dockerImageId: imageId,
    imageName: image,
  };

  mutatedDepTree.dockerImageId = imageId || '';
  if (mutatedDepTree.targetOS) {
    mutatedDepTree.targetOS.prettyName = imageOsReleasePrettyName || '';
  }

  if (!mutatedDepTree.meta) {
    mutatedDepTree.meta = {};
  }
  mutatedDepTree.meta.platform = platform;

  return mutatedDepTree;
}

/**
 * Produces a DependencyTree (DepsDiscoveryResult) for every ScanResult
 * that contains a dependency graph. ScanResults with other data are ignored
 * because the data cannot be resolved to a DepTree.
 */
export async function getApplicationDependencyTrees(
  applicationScanResults: ScanResult[],
): Promise<DependencyTree[]> {
  const dependencyTrees: DependencyTree[] = [];

  for (const scanResult of applicationScanResults) {
    const appDepGraph: depGraphLib.DepGraph | undefined = scanResult.facts.find(
      (fact) => fact.type === 'depGraph',
    )?.data;

    // Skip this ScanResult if we could not read a dependency graph.
    // Some ScanResults like Java will not contain a graph but instead a list of hashes.
    // These are not supported by the current API.
    if (appDepGraph === undefined) {
      continue;
    }

    const appDepTree = await depGraphLib.legacy.graphToDepTree(
      appDepGraph,
      appDepGraph.pkgManager.name,
    );

    if (!appDepTree.name || !appDepTree.type) {
      continue;
    }

    const testedFiles: string[] | undefined = scanResult.facts.find(
      (fact) => fact.type === 'testedFiles',
    )?.data;

    dependencyTrees.push({
      name: appDepTree.name,
      version: appDepTree.version,
      type: appDepTree.type,
      dependencies: appDepTree.dependencies,
      targetFile: scanResult.identity.targetFile,
      testedFiles,
    });
  }

  return dependencyTrees;
}
