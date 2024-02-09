export interface IScanImage {
  imageName: string;
  imageWithDigest?: string;
  skopeoRepoType: SkopeoRepositoryType;
}

export interface IPullableImage {
  imageName: string;
  imageWithDigest?: string;
  manifestDigest?: string;
  indexDigest?: string;
  fileSystemPath: string;
  skopeoRepoType: SkopeoRepositoryType;
}

/**
 * https://github.com/containers/skopeo
 */
export enum SkopeoRepositoryType {
  DockerArchive = 'docker-archive',
  ImageRegistry = 'docker',
}

export type ImageDigests = {
  manifestDigest?: string;
  indexDigest?: string;
};

export type ImageManifest = {
  mediaType: string;
  manifests?: Array<{
    digest: string;
    platform: {
      architecture: string;
      os: string;
      variant: string;
    };
  }>;
};
