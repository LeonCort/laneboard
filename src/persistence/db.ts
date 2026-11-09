import Dexie, { type Table } from "dexie";
import type { Workspace } from "../model/schema";
/** The file on disk the workspace was opened from or last saved to. */
export interface FileLink {
  id: "current";
  name: string;
  dirty: boolean;
  /** FileSystemFileHandle where the File System Access API exists. */
  handle?: unknown;
}
class LaneboardDB extends Dexie {
  workspaces!: Table<{ id: string; data: Workspace }, string>;
  files!: Table<FileLink, string>;
  constructor() {
    super("laneboard");
    this.version(1).stores({ workspaces: "id" });
    this.version(2).stores({ workspaces: "id", files: "id" });
  }
}
export const db = new LaneboardDB();
export async function loadWorkspace() {
  return (await db.workspaces.get("local"))?.data;
}
export async function saveWorkspace(data: Workspace) {
  await db.workspaces.put({ id: "local", data });
}
export async function loadFileLink() {
  return db.files.get("current");
}
export async function saveFileLink(link: Omit<FileLink, "id"> | null) {
  if (link) await db.files.put({ id: "current", ...link });
  else await db.files.delete("current");
}
