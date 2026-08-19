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
  rootName: string;
  rootPath: string;
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
  sourceEndLine: number | null;
  selectionText: string | null;
  blocking: boolean;
  createdAt: string;
  updatedAt: string;
  replies?: Comment[];
}

export interface CreateCommentRequest {
  filePath: string;
  parentId?: string;
  body: string;
  sourceLine?: number;
  sourceEndLine?: number;
  selectionText?: string;
  blocking?: boolean;
}

export interface UpdateCommentRequest {
  filePath?: string;
  body?: string;
  blocking?: boolean;
}

export interface CommentSidecar {
  version: 1;
  filePath: string;
  comments: Comment[];
}

export const COMMENT_SIDECAR_SUFFIX = '.mdb-comments.json';

export interface AIReviewResponse {
  fileContent: string | null;
  commentReplies: Array<{
    parentId: string;
    body: string;
  }>;
}

export type AIHarness = 'claude' | 'codex' | 'opencode';

export interface AIReviewRequest {
  filePath: string;
  harness?: AIHarness;
  model?: string;
  agent?: string;
  executablePath?: string;
}

export interface AIStatusResponse {
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
  harness?: AIHarness;
  model?: string;
  agent?: string;
}

export type WSMessage =
  | { type: 'file-changed'; filePath: string }
  | { type: 'comments-changed'; filePath: string }
  | { type: 'ai-status'; jobId: string; status: 'running' | 'done' | 'error'; error?: string };
