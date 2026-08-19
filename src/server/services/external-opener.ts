import path from "node:path";
import { stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export type ExternalOpenAction = "terminal" | "finder" | "editor";

export interface ExternalOpenRequest {
  path: string;
  action: ExternalOpenAction;
  app?: string;
}

export type ExternalOpener = (request: ExternalOpenRequest) => Promise<void>;

const execFileAsync = promisify(execFile);

export const openExternalPath: ExternalOpener = async (request) => {
  if (process.env.NODE_ENV === "test") {
    throw new Error("External applications cannot be opened during tests");
  }

  switch (request.action) {
    case "terminal": {
      const fileStat = await stat(request.path);
      const directory = fileStat.isDirectory() ? request.path : path.dirname(request.path);
      await execFileAsync("open", ["-a", request.app || "Terminal", directory]);
      return;
    }
    case "finder":
      await execFileAsync("open", ["-R", request.path]);
      return;
    case "editor":
      await execFileAsync("open", request.app ? ["-a", request.app, request.path] : [request.path]);
  }
};
