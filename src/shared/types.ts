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

export interface Comment {
  id: string;
  filePath: string;
  parentId: string | null;
  author: 'user' | 'ai';
  body: string;
  sourceLine: number | null;
  selectionText: string | null;
  createdAt: string;
  updatedAt: string;
  replies?: Comment[];
}

export interface CreateCommentRequest {
  filePath: string;
  parentId?: string;
  body: string;
  sourceLine?: number;
  selectionText?: string;
}

export interface AIReviewResponse {
  fileContent: string | null;
  commentReplies: Array<{
    parentId: string;
    body: string;
  }>;
}

export interface AIStatusResponse {
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
}

export type WSMessage =
  | { type: 'file-changed'; filePath: string }
  | { type: 'comments-changed'; filePath: string }
  | { type: 'ai-status'; jobId: string; status: 'running' | 'done' | 'error'; error?: string };
