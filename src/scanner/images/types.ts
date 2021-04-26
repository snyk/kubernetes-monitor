export interface IScanImage {
  imageName: string;
  imageWithDigest?: string;
  skopeoRepoType: SkopeoRepositoryType;
}

export interface IPullableImage {
  imageName: string;
  imageWithDigest?: string;
  fileSystemPath: string;
  skopeoRepoType: SkopeoRepositoryType;
}

/**
 * https://github.com/containers/skopeo
 */
export enum SkopeoRepositoryType {
  DockerArchive = 'docker-archive',
  OciArchive = 'oci',
  ImageRegistry = 'docker',
  Directory = 'dir', // Note, skopeo marks this as a non-standard format
}
