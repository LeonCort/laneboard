import { it, expect, beforeEach, beforeAll, vi } from "vitest";
import { useStore } from "../src/store";
import { blankWorkspace } from "../src/model/schema";
import { investingExample } from "../src/examples";
import {
  useFile,
  openFile,
  saveFile,
  saveFileAs,
  newLaneboard,
  restoreFileLink,
} from "../src/io/file";

// An in-memory stand-in for the File System Access API.
const disk = new Map<string, string>();
const handleFor = (name: string) => ({
  name,
  // jsdom's File has no text(), so hand back the parts the app reads.
  getFile: async () => {
    const text = disk.get(name) ?? "";
    return { name, size: text.length, text: async () => text };
  },
  createWritable: async () => {
    let text = "";
    return {
      write: async (x: string) => {
        text += x;
      },
      close: async () => {
        disk.set(name, text);
      },
    };
  },
});
const pickers = {
  open: "",
  save: "",
};
beforeAll(async () => {
  Object.assign(window, {
    showOpenFilePicker: vi.fn(async () => [handleFor(pickers.open)]),
    showSaveFilePicker: vi.fn(async () => handleFor(pickers.save)),
  });
  await restoreFileLink();
});
const editable = () => {
  const file = structuredClone(investingExample);
  file.journeys[0].readOnly = false;
  return file;
};
beforeEach(() => {
  disk.clear();
  newLaneboard();
});

it("opens a file as the whole workspace and clears undo history", async () => {
  disk.set("bank.laneboard.json", JSON.stringify(editable()));
  pickers.open = "bank.laneboard.json";
  useStore.getState().editJourney(() => {});
  const result = await openFile();
  expect(result?.name).toBe("bank.laneboard.json");
  const w = useStore.getState().workspace;
  expect(w.journeys.map((j) => j.id)).toEqual(
    investingExample.journeys.map((j) => j.id),
  );
  expect(w.ui.selectedJourney).toBe(w.journeys[0].id);
  expect(useStore.temporal.getState().pastStates).toHaveLength(0);
  expect(useFile.getState()).toMatchObject({
    name: "bank.laneboard.json",
    dirty: false,
    inPlace: true,
  });
});

it("tracks unsaved content but ignores view changes, and undo restores saved", async () => {
  disk.set("a.laneboard.json", JSON.stringify(editable()));
  pickers.open = "a.laneboard.json";
  await openFile();
  useStore.getState().edit((w) => {
    w.ui.mode = "target";
  });
  expect(useFile.getState().dirty).toBe(false);
  useStore.getState().editJourney((j) => {
    j.title = "Changed";
  });
  expect(useFile.getState().dirty).toBe(true);
  useStore.temporal.getState().undo();
  expect(useFile.getState().dirty).toBe(false);
});

it("saves over the same file and keeps separate Laneboards apart", async () => {
  disk.set("first.laneboard.json", JSON.stringify(editable()));
  pickers.open = "first.laneboard.json";
  await openFile();
  useStore.getState().editJourney((j) => {
    j.title = "Updated first";
  });
  expect(await saveFile()).toBe("first.laneboard.json");
  expect(useFile.getState().dirty).toBe(false);
  expect(JSON.parse(disk.get("first.laneboard.json")!).journeys[0].title).toBe(
    "Updated first",
  );

  pickers.save = "second.laneboard.json";
  expect(await saveFileAs()).toBe("second.laneboard.json");
  useStore.getState().editJourney((j) => {
    j.title = "Only in second";
  });
  await saveFile();
  expect(JSON.parse(disk.get("first.laneboard.json")!).journeys[0].title).toBe(
    "Updated first",
  );
  expect(JSON.parse(disk.get("second.laneboard.json")!).journeys[0].title).toBe(
    "Only in second",
  );
});

it("asks where to save the first time and starts empty with New", async () => {
  useStore.setState({
    workspace: {
      ...blankWorkspace(),
      ...editable(),
      settings: blankWorkspace().settings,
      ui: blankWorkspace().ui,
    },
  });
  pickers.save = "fresh.laneboard.json";
  expect(await saveFile()).toBe("fresh.laneboard.json");
  expect(disk.has("fresh.laneboard.json")).toBe(true);
  newLaneboard();
  expect(useStore.getState().workspace.journeys).toEqual([]);
  expect(useFile.getState().name).toBeNull();
});

it("rejects an invalid file without touching the workspace", async () => {
  useStore.setState({
    workspace: {
      ...blankWorkspace(),
      ...editable(),
      settings: blankWorkspace().settings,
      ui: blankWorkspace().ui,
    },
  });
  disk.set("broken.laneboard.json", "{ not json");
  pickers.open = "broken.laneboard.json";
  await expect(openFile()).rejects.toThrow(/not valid JSON/);
  expect(useStore.getState().workspace.journeys).toHaveLength(1);
  expect(useFile.getState().name).toBeNull();
});
