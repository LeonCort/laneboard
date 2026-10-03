import Dexie, { type Table } from "dexie";
import type { Workspace } from "../model/schema";
class LaneboardDB extends Dexie {
  workspaces!: Table<{ id: string; data: Workspace }, string>;
  constructor() {
    super("laneboard");
    this.version(1).stores({ workspaces: "id" });
  }
}
export const db = new LaneboardDB();
export async function loadWorkspace() {
  return (await db.workspaces.get("local"))?.data;
}
export async function saveWorkspace(data: Workspace) {
  await db.workspaces.put({ id: "local", data });
}
