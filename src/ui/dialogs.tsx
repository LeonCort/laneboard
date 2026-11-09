import { useState, useEffect, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import {
  X,
  Upload,
  FileJson,
  Download,
  Image,
  FileSpreadsheet,
  ShieldCheck,
  Copy,
  Plus,
  Square,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { useT } from "../i18n";
import { useStore, currentJourney } from "../store";
import { Field, Select } from "./fields";
import { parseImport, MAX_IMPORT_SIZE } from "../io/import";
import { exportJSON, exportCSV, exportImage } from "../io/export";
import { saveFileAs } from "../io/file";
import { buildPrompt } from "../ai/prompt";
import { newId, blankWorkspace, type FileData } from "../model/schema";
export type DialogName =
  | "setup"
  | "target"
  | "import"
  | "export"
  | "ai"
  | "settings"
  | "new"
  | "help"
  | "definitions"
  | "confirm"
  | "palette"
  | null;
export function Modal({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="lb-scrim" />
        <Dialog.Content className="lb-dialog">
          <div className="lb-dialog-header">
            <Dialog.Title asChild>
              <h2>{title}</h2>
            </Dialog.Title>
            <Dialog.Close
              className="lb-btn lb-btn--icon lb-btn--ghost"
              aria-label="Close"
            >
              <X size={18} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="lb-field__hint">
            {description || t("localDefault")}
          </Dialog.Description>
          <div className="lb-dialog-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function ImportDialog({
  onClose,
  initial,
  notify,
}: {
  onClose: () => void;
  initial?: string;
  notify: (s: string) => void;
}) {
  const t = useT(),
    store = useStore(),
    [raw, setRaw] = useState(initial || ""),
    [result, setResult] = useState<{
      data: FileData;
      warnings: string[];
    } | null>(null),
    [error, setError] = useState(""),
    [replace, setReplace] = useState(false),
    [restore, setRestore] = useState(false);
  useEffect(() => {
    if (initial) {
      try {
        setResult(parseImport(initial));
      } catch (e) {
        setError(String(e));
      }
    }
  }, [initial]);
  const read = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_IMPORT_SIZE) {
      setError("File exceeds the 5 MB limit.");
      return;
    }
    try {
      const text = await file.text();
      setRaw(text);
      setResult(parseImport(text));
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    }
  };
  return (
    <Modal
      title={t("importTitle")}
      description={t("noCustomer")}
      onClose={onClose}
    >
      <label className="lb-btn lb-btn--primary lb-upload">
        <Upload size={16} />
        {t("chooseFile")}
        <input
          type="file"
          accept=".json,.laneboard.json,application/json"
          onChange={(e) => void read(e.target.files?.[0])}
        />
      </label>
      <Field
        label={t("pasteJson")}
        value={raw}
        onChange={(v) => {
          setRaw(v);
          setResult(null);
        }}
        multiline
      />
      <button
        className="lb-btn"
        onClick={() => {
          try {
            setResult(parseImport(raw));
            setError("");
          } catch (e) {
            setError((e as Error).message);
            setResult(null);
          }
        }}
      >
        {t("preview")}
      </button>
      {error ? (
        <pre role="alert" className="lb-import-error">
          {error}
        </pre>
      ) : null}
      {result ? (
        <>
          <div className="lb-import-preview">
            {result.data.journeys.map((j) => (
              <div key={j.id}>
                <h3>{j.title}</h3>
                <p>
                  {j.phases.length} {t("phases").toLowerCase()} ·{" "}
                  {j.lanes.length} {t("lanes").toLowerCase()} ·{" "}
                  {j.services.length} {t("services").toLowerCase()} ·{" "}
                  {j.steps.length} {t("steps").toLowerCase()} ·{" "}
                  {j.frictions.length} {t("frictions").toLowerCase()} ·{" "}
                  {j.feeds.length} feeds
                </p>
              </div>
            ))}
            <span className="lb-tag">{result.warnings.length} warnings</span>
          </div>
          {result.warnings.length ? (
            <details>
              <summary>{result.warnings.length} import warnings</summary>
              <ul>
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          ) : null}
          <Select
            label={t("importMethod")}
            value={replace ? "replace" : "add"}
            onChange={(v) => setReplace(v === "replace")}
          >
            <option value="add">{t("addJourneys")}</option>
            <option value="replace">{t("replaceJourneys")}</option>
          </Select>
          {result.data.ui || result.data.settings ? (
            <label className="lb-check">
              <input
                type="checkbox"
                checked={restore}
                onChange={(e) => setRestore(e.target.checked)}
              />
              {t("restore")}
            </label>
          ) : null}
          <button
            className="lb-btn lb-btn--primary"
            onClick={() => {
              store.importData(result.data, replace, restore);
              notify(`${result.data.journeys.length} journey(s) imported`);
              onClose();
            }}
          >
            {t("commitImport")}
          </button>
        </>
      ) : null}
    </Modal>
  );
}
export function ExportDialog({
  onClose,
  notify,
}: {
  onClose: () => void;
  notify: (s: string) => void;
}) {
  const t = useT(),
    s = useStore(),
    j = currentJourney(s),
    [scale, setScale] = useState("1"),
    [busy, setBusy] = useState(false);
  const image = async (type: "png" | "svg") => {
    setBusy(true);
    try {
      await exportImage(type, Number(scale));
      notify(`${type.toUpperCase()} exported`);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={t("exportTitle")}
      description={t("localNotice")}
      onClose={onClose}
    >
      <div className="lb-export-grid">
        <button
          className="lb-export-option"
          disabled={!j}
          onClick={() => {
            exportJSON(false);
            notify("Journey exported");
          }}
        >
          <FileJson />
          <strong>{t("oneJourney")}</strong>
          <span>.laneboard.json</span>
        </button>
        <button
          className="lb-export-option"
          onClick={() => {
            exportJSON(true);
            notify("Workspace backed up");
          }}
        >
          <ShieldCheck />
          <strong>{t("wholeWorkspace")}</strong>
          <span>.laneboard.json</span>
        </button>
        <button
          className="lb-export-option"
          disabled={!j || busy}
          onClick={() => void image("png")}
        >
          <Image />
          <strong>PNG</strong>
          <span>
            {t("map")} · {scale}×
          </span>
        </button>
        <button
          className="lb-export-option"
          disabled={!j || busy}
          onClick={() => void image("svg")}
        >
          <Image />
          <strong>SVG</strong>
          <span>
            {t("map")} · {scale}×
          </span>
        </button>
        <button
          className="lb-export-option"
          disabled={!j}
          onClick={() => j && exportCSV("services", j, s.workspace.ui.mode)}
        >
          <FileSpreadsheet />
          <strong>{t("services")}</strong>
          <span>CSV</span>
        </button>
        <button
          className="lb-export-option"
          disabled={!j}
          onClick={() => j && exportCSV("frictions", j, s.workspace.ui.mode)}
        >
          <FileSpreadsheet />
          <strong>{t("frictions")}</strong>
          <span>CSV</span>
        </button>
      </div>
      <Select label={t("imageScale")} value={scale} onChange={setScale}>
        <option value="1">1×</option>
        <option value="2">2×</option>
      </Select>
      <button
        className="lb-btn"
        onClick={() =>
          void saveFileAs().catch((e) => {
            if (e.name !== "AbortError") notify(e.message);
          })
        }
      >
        <Download size={16} />
        Save workspace to file
      </button>
      {busy ? <p role="status">{t("renderLocal")}</p> : null}
    </Modal>
  );
}
export function AIDialog({
  onClose,
  notify,
}: {
  onClose: () => void;
  notify: (s: string) => void;
}) {
  const t = useT(),
    [description, setDescription] = useState(""),
    [notes, setNotes] = useState(""),
    [prompt, setPrompt] = useState("");
  return (
    <Modal
      title={t("promptTitle")}
      description={t("aiNotice")}
      onClose={onClose}
    >
      <Field
        label={t("scenario")}
        value={description}
        onChange={setDescription}
        multiline
      />
      <Field
        label={t("additionalNotes")}
        value={notes}
        onChange={setNotes}
        multiline
      />
      <button
        disabled={!description.trim()}
        className="lb-btn lb-btn--primary"
        onClick={async () => {
          const p = buildPrompt(description, notes);
          setPrompt(p);
          try {
            await navigator.clipboard.writeText(p);
            notify("Prompt copied");
          } catch {
            notify("Select and copy the prompt below");
          }
        }}
      >
        <Copy size={16} />
        {t("copyPrompt")}
      </button>
      {prompt ? (
        <Field
          label={t("prompt")}
          value={prompt}
          onChange={setPrompt}
          multiline
        />
      ) : null}
    </Modal>
  );
}
export function SettingsDialog({
  onClose,
  onClear,
}: {
  onClose: () => void;
  onClear: () => void;
}) {
  const t = useT(),
    s = useStore(),
    settings = s.workspace.settings;
  return (
    <Modal
      title={t("settings")}
      description={t("localNotice")}
      onClose={onClose}
    >
      <Field
        label={t("workspace")}
        value={settings.name}
        onChange={(v) =>
          s.edit((w) => {
            w.settings.name = v;
          })
        }
      />
      <Select
        label={t("language")}
        value={settings.language}
        onChange={(v) =>
          s.edit((w) => {
            w.settings.language = v as "en" | "sv";
          })
        }
      >
        <option value="en">English</option>
        <option value="sv">Svenska</option>
      </Select>
      <Select
        label={t("theme")}
        value={settings.theme}
        onChange={(v) =>
          s.edit((w) => {
            w.settings.theme = v as "light" | "dark" | "system";
          })
        }
      >
        <option value="system">{t("system")}</option>
        <option value="light">{t("light")}</option>
        <option value="dark">{t("dark")}</option>
      </Select>
      <Select
        label={t("accent")}
        value={settings.accent}
        onChange={(v) =>
          s.edit((w) => {
            w.settings.accent = v as "blue" | "teal" | "purple";
          })
        }
      >
        <option value="blue">{t("blue")}</option>
        <option value="teal">{t("teal")}</option>
        <option value="purple">{t("purple")}</option>
      </Select>
      <label className="lb-field">
        <span className="lb-field__label">{t("logo")}</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file || file.size > 14000) return;
            const r = new FileReader();
            r.onload = () =>
              s.edit((w) => {
                w.settings.logo = String(r.result);
              });
            r.readAsDataURL(file);
          }}
        />
        <span className="lb-field__hint">
          PNG, JPEG or WebP · up to 14 KB · saved locally
        </span>
      </label>
      {settings.logo ? (
        <button
          className="lb-btn"
          onClick={() =>
            s.edit((w) => {
              w.settings.logo = "";
            })
          }
        >
          Remove logo
        </button>
      ) : null}
      <button className="lb-btn" onClick={() => exportJSON(true)}>
        <Download size={16} />
        {t("backup")}
      </button>
      <button className="lb-btn lb-btn--danger" onClick={onClear}>
        {t("clearWorkspace")}
      </button>
    </Modal>
  );
}
export function DefinitionsDialog({ onClose }: { onClose: () => void }) {
  const t = useT(),
    s = useStore();
  return (
    <Modal title={t("definitions")} onClose={onClose}>
      {(["owners", "capabilities"] as const).map((key) => (
        <section key={key} className="lb-definition-section">
          <div className="lb-section__head">
            <h3>{t(key)}</h3>
            <button
              className="lb-btn lb-btn--sm"
              onClick={() =>
                s.edit((w) => {
                  w[key].push({
                    id: newId(key),
                    name: key === "owners" ? "New owner" : "New capability",
                    description: "",
                  });
                })
              }
            >
              <Plus size={14} />
              {t("add")}
            </button>
          </div>
          {s.workspace[key].map((d) => (
            <div key={d.id} className="lb-definition-card">
              <Field
                label={t("name")}
                value={d.name}
                onChange={(v) =>
                  s.edit((w) => {
                    w[key].find((x) => x.id === d.id)!.name = v;
                  })
                }
              />
              <Field
                label={t("description")}
                value={d.description}
                onChange={(v) =>
                  s.edit((w) => {
                    w[key].find((x) => x.id === d.id)!.description = v;
                  })
                }
                multiline
              />
              <span className="lb-micro lb-mono">{d.id}</span>
            </div>
          ))}
        </section>
      ))}
    </Modal>
  );
}
export function NewDialog({
  onClose,
  onExample,
}: {
  onClose: () => void;
  onExample: () => void;
}) {
  const t = useT(),
    s = useStore();
  return (
    <Modal
      title={t("newJourney")}
      description={t("noCustomer")}
      onClose={onClose}
    >
      <button
        className="lb-export-option"
        onClick={() => {
          s.newJourney("bank");
          onClose();
        }}
      >
        <Plus />
        <strong>{t("startBank")}</strong>
        <span>7 lanes · 4 phases</span>
      </button>
      <button
        className="lb-export-option"
        onClick={() => {
          s.newJourney("blank");
          onClose();
        }}
      >
        <Square />
        <strong>{t("startBlank")}</strong>
        <span>2 lanes · 4 phases</span>
      </button>
      <button
        className="lb-export-option"
        onClick={() => {
          onExample();
          onClose();
        }}
      >
        <BookOpen />
        <strong>{t("loadExample")}</strong>
        <span>Example Bank · Business</span>
      </button>
    </Modal>
  );
}
export function HelpDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const shortcuts = [
    ["V", "Select"],
    ["H / Space", "Pan"],
    ["S / J / F / E / N", "Service / Step / Friction / Feed / Note"],
    ["R / O / A / T", "Rectangle / Ellipse / Arrow / Text in Sketch"],
    ["Q", t("keepTool")],
    ["⌘/Ctrl K", t("openPalette")],
    ["⌘/Ctrl Z", t("undo")],
    ["⌘/Ctrl Shift Z", t("redo")],
    ["⌘/Ctrl D", "Duplicate selection"],
    ["⌘/Ctrl C / V", "Copy / paste cards"],
    ["⌘/Ctrl \\", t("toggleUI")],
    ["Shift M", "Now / Target"],
    ["Delete", "Delete selected cards"],
    ["+ / −", "Zoom"],
    ["Arrow keys / Esc", "Presentation: next, previous / exit"],
  ];
  return (
    <Modal
      title={t("shortcutTitle")}
      description={t("localNotice")}
      onClose={onClose}
    >
      <table className="lb-table">
        <tbody>
          {shortcuts.map(([key, value]) => (
            <tr key={key}>
              <td>
                <kbd className="lb-kbd">{key}</kbd>
              </td>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Double-click a cell to add a card. Drag cards between cells.
        Double-click card text to edit it. Use the inspector for every other
        field.
      </p>
      <p>
        Examples are read-only: duplicate one to make it your own. Back up your
        workspace regularly; clearing browser data removes local journeys.
      </p>
    </Modal>
  );
}
export function ConfirmDialog({
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
}: {
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
}) {
  const t = useT();
  return (
    <Modal
      title={title}
      description={description ?? t("confirmDelete")}
      onClose={onClose}
    >
      <div className="lb-dialog-actions">
        <button className="lb-btn" onClick={onClose}>
          {t("cancel")}
        </button>
        <button
          className="lb-btn lb-btn--danger"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel ?? t("delete")}
        </button>
      </div>
    </Modal>
  );
}
export interface Action {
  id: string;
  label: string;
  run: () => void;
  shortcut?: string;
}
export function Palette({
  actions,
  onClose,
}: {
  actions: Action[];
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Modal title={t("openPalette")} onClose={onClose}>
      <Command className="lb-cmdk" label={t("openPalette")}>
        <Command.Input placeholder={t("searchActions")} />
        <Command.List>
          <Command.Empty>{t("noResults")}</Command.Empty>
          {actions.map((a) => (
            <Command.Item
              aria-label={a.label}
              key={a.id}
              value={a.label}
              onSelect={() => {
                onClose();
                a.run();
              }}
            >
              {a.label}
              {a.shortcut ? (
                <kbd className="lb-kbd">{a.shortcut}</kbd>
              ) : (
                <ArrowRight size={14} />
              )}
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </Modal>
  );
}
export function clearWorkspace() {
  useStore.getState().edit((w) => {
    Object.assign(w, blankWorkspace());
  });
  useStore.getState().select(null);
}
