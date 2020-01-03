export interface IPullableImage {
  imageName: string;
  fileSystemPath: string;
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
