export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isMarkdown: boolean;
  size: number;
  modifiedAt: string;
}

export interface DirectoryListing {
  path: string;
  entries: FileEntry[];
}

export interface FileContent {
  path: string;
  content: string;
}

export interface FileSaveRequest {
  path: string;
  content: string;
}

export interface FileCreateRequest {
  directory: string;
  name: string;
}
