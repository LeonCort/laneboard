import { JourneySetup, TargetReview } from "./ui/Workflow";
import { ResponsivePanel } from "./ui/ResponsivePanel";
import { targetState } from "./model/analysis";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  MiniMap,
  Panel,
  useReactFlow,
  useViewport,
  getNodesBounds,
  getViewportForBounds,
  applyNodeChanges,
  ConnectionLineType,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import {
  FileText,
  Layers,
  Library,
  SlidersHorizontal,
  Sparkles,
  Settings,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Eye,
  EyeOff,
  Lock,
  Upload,
  Download,
  Play,
  Check,
  MousePointer2,
  Hand,
  Square,
  Circle,
  ArrowUpRight,
  Type,
  StickyNote,
  Route,
  TriangleAlert,
  ArrowRightToLine,
  Undo2,
  Redo2,
  Minus,
  Maximize,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
  Table2,
  GripVertical,
  ShieldCheck,
  Pin,
} from "lucide-react";
import {
  useStore,
  currentJourney,
  addCard,
  deleteSelection,
  setUI,
  type Selection,
} from "./store";
import {
  addLane,
  addPhase,
  addGroup,
  reorder,
  reorderPhase,
  duplicateCards,
  copyCards,
  pasteCards,
  setCardLink,
  reconnectCardLink,
  setLaneHidden,
} from "./store/actions";
import {
  cardSource,
  cardTarget,
  canConnectCards,
  hasCardLink,
  canReconnectConnection,
  canEditConnection,
  connectionEdgeId,
  type ConnectionRef,
} from "./model/connections";
import { useT, type Key } from "./i18n";
import { exampleFile } from "./examples";
import { layout, type CardData, type CellData } from "./canvas/layout";
import { nodeTypes, edgeTypes } from "./canvas/nodes";
import {
  CanvasContextMenu,
  type ContextCommand,
  type ContextTarget,
} from "./canvas/ContextMenu";
import {
  AddLaneButton,
  HiddenLanesControl,
  LaneLabel,
} from "./canvas/LaneControls";
import { Inspector } from "./views/Inspector";
import { Drawer, type Tab } from "./views/Drawer";
import { Overview } from "./views/Overview";
import { presentationFor } from "./present";
import { layers, newId, type Layer } from "./model/schema";
import { exportJSON, exportImage, exportCSV } from "./io/export";
import {
  useFile,
  openFile,
  saveFile,
  saveFileAs,
  newLaneboard,
  canSaveInPlace,
} from "./io/file";
import {
  Modal,
  ImportDialog,
  ExportDialog,
  AIDialog,
  SettingsDialog,
  DefinitionsDialog,
  NewDialog,
  HelpDialog,
  ConfirmDialog,
  Palette,
  clearWorkspace,
  type DialogName,
  type Action,
} from "./ui/dialogs";
import "./styles/editor.css";
const toolSpec = [
  { id: "select", key: "V", icon: MousePointer2, label: "toolSelect" },
  { id: "hand", key: "H", icon: Hand, label: "toolPan" },
  { id: "service", key: "S", icon: Square, label: "toolService" },
  { id: "step", key: "J", icon: Route, label: "toolStep" },
  { id: "friction", key: "F", icon: TriangleAlert, label: "toolFriction" },
  { id: "feed", key: "E", icon: ArrowRightToLine, label: "toolFeed" },
  { id: "note", key: "N", icon: StickyNote, label: "toolNote" },
];
const sketchSpec = [
  ...toolSpec.slice(0, 2),
  { id: "rectangle", key: "R", icon: Square, label: "toolRectangle" },
  { id: "ellipse", key: "O", icon: Circle, label: "toolEllipse" },
  { id: "arrow", key: "A", icon: ArrowUpRight, label: "toolArrow" },
  { id: "text", key: "T", icon: Type, label: "toolText" },
  { id: "note", key: "N", icon: StickyNote, label: "toolSticky" },
];
const duration = { duration: 180 };
export default function Editor() {
  return (
    <ReactFlowProvider>
      <EditorInner />
    </ReactFlowProvider>
  );
}
function EditorInner() {
  const s = useStore(),
    t = useT(),
    j = currentJourney(s),
    flow = useReactFlow(),
    viewport = useViewport();
  const [dialog, setDialog] = useState<DialogName>(null),
    [importRaw, setImportRaw] = useState<string>(),
    [drawer, setDrawer] = useState<Tab | null>(null),
    [view, setView] = useState<"canvas" | "data" | "overview">("canvas"),
    [canvasSize, setCanvasSize] = useState({
      width: window.innerWidth,
      height: window.innerHeight,
    }),
    [guideHeight, setGuideHeight] = useState(100),
    [rail, setRail] = useState("journeys"),
    [tool, setTool] = useState("select"),
    [editorMode, setEditorMode] = useState<"map" | "sketch">("map"),
    [keepTool, setKeepTool] = useState(false),
    [leftCollapsed, setLeftCollapsed] = useState(false),
    [toast, setToast] = useState(""),
    [present, setPresent] = useState<number | null>(null),
    [picker, setPicker] = useState<{ lane: string; phase: string } | null>(
      null,
    ),
    [search, setSearch] = useState(""),
    [searchOpen, setSearchOpen] = useState(false),
    [owner, setOwner] = useState(""),
    [severity, setSeverity] = useState(""),
    [laneFilter, setLaneFilter] = useState(""),
    [confirmAction, setConfirmAction] = useState<{
      title: string;
      run: () => void;
      description?: string;
      confirmLabel?: string;
    } | null>(null),
    [space, setSpace] = useState(false);
  const [sheet, setSheet] = useState<"tools" | "details" | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextTarget | null>(null);
  const reconnecting = useRef<ConnectionRef | null>(null);
  const seenJourneys = useRef(new Set(s.workspace.journeys.map((j) => j.id)));
  const narrow = canvasSize.width <= 960;
  const newJourneyPending =
    !!j &&
    !seenJourneys.current.has(j.id) &&
    j.title === "Untitled journey" &&
    targetState(j) === "not-started";
  useEffect(() => {
    if (
      j &&
      s.workspace.ui.mode === "target" &&
      targetState(j) === "not-started"
    )
      setDialog("target");
  }, [j, s.workspace.ui.mode]);
  useEffect(() => {
    if (newJourneyPending) setDialog("setup");
    seenJourneys.current = new Set(s.workspace.journeys.map((j) => j.id));
  }, [j, newJourneyPending, s.workspace.journeys]);
  const previousDetailSelection = useRef(s.selection);
  useEffect(() => {
    if (!s.selection) setSheet((value) => (value === "details" ? null : value));
    else if (
      narrow &&
      !dialog &&
      !newJourneyPending &&
      previousDetailSelection.current !== s.selection &&
      !s.selection.inline
    )
      setSheet("details");
    previousDetailSelection.current = s.selection;
  }, [narrow, dialog, newJourneyPending, s.selection]);
  const [nodes, setNodes] = useState<Node[]>([]),
    dragId = useRef(""),
    toastTimer = useRef<ReturnType<typeof setTimeout>>(),
    originalPresent = useRef<{
      layers: Layer[];
      viewport: typeof viewport;
      view: "canvas" | "data" | "overview";
    } | null>(null),
    editorRef = useRef<HTMLElement>(null),
    guideRef = useRef<HTMLDivElement>(null),
    fileRef = useRef<HTMLInputElement>(null),
    searchRef = useRef<HTMLInputElement>(null),
    searchTriggerRef = useRef<HTMLButtonElement>(null);
  const closeSearch = () => {
    setSearchOpen(false);
    searchTriggerRef.current?.focus();
  };
  const leftX =
      present !== null
        ? 16
        : leftCollapsed || canvasSize.width <= 960
          ? 84
          : 340,
    rightInset =
      present !== null ||
      !s.selection ||
      s.selection.kind === "connection" ||
      canvasSize.width <= 960
        ? 16
        : 304,
    labelWidth = 132,
    phaseTop = present !== null ? 16 : canvasSize.width <= 520 ? 108 : 60,
    laneTop = phaseTop + 40,
    columnLeft = leftX + labelWidth + 8;
  useEffect(() => {
    const element = editorRef.current;
    if (!element) return;
    // Apply sizes in the next frame: changing layout inside the observer
    // callback makes WebKit report "ResizeObserver loop completed" errors.
    let frame = 0;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setCanvasSize((size) =>
          size.width === width && size.height === height
            ? size
            : { width, height },
        ),
      );
    });
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);
  const presenting = present !== null;
  useEffect(() => {
    const element = guideRef.current;
    if (!element) return;
    let frame = 0;
    const observer = new ResizeObserver(([entry]) => {
      const height =
        entry.borderBoxSize?.[0]?.blockSize || element.offsetHeight;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setGuideHeight(height));
    });
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [presenting]);
  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }, []);
  const confirm = useCallback(
    (
      title: string,
      run: () => void,
      options?: { description?: string; confirmLabel?: string },
    ) => {
      setConfirmAction({ title, run, ...options });
      setDialog("confirm");
    },
    [],
  );
  const file = useFile();
  useEffect(() => {
    document.title = file.name
      ? `${file.dirty ? "• " : ""}${file.name} — Laneboard`
      : "Laneboard — your channels, one journey";
  }, [file.name, file.dirty]);
  const fileError = useCallback(
    (e: unknown) => {
      if ((e as Error)?.name !== "AbortError") notify((e as Error).message);
    },
    [notify],
  );
  // Opening a file or starting a new Laneboard replaces the workspace. Ask
  // first when that would lose work that is not in a file.
  const replaceWorkspace = useCallback(
    (run: () => void) => {
      const f = useFile.getState(),
        w = useStore.getState().workspace;
      const unsaved = f.name ? f.dirty : w.journeys.some((x) => !x.readOnly);
      if (unsaved)
        confirm(t("replaceTitle"), run, {
          description: t("replaceUnsaved"),
          confirmLabel: t("replaceConfirm"),
        });
      else run();
    },
    [confirm, t],
  );
  const openLaneboard = useCallback(
    () =>
      replaceWorkspace(() => {
        setView("canvas");
        void openFile()
          .then((r) => r && notify(`${t("fileOpened")} ${r.name}`))
          .catch(fileError);
      }),
    [replaceWorkspace, notify, fileError, t],
  );
  const save = useCallback(
    (as = false) => {
      void (as ? saveFileAs() : saveFile())
        .then((name) =>
          notify(
            canSaveInPlace()
              ? `${t("fileSavedAs")} ${name}`
              : `${t("downloadedCopy")} ${name}`,
          ),
        )
        .catch(fileError);
    },
    [notify, fileError, t],
  );
  const startNewLaneboard = useCallback(
    () =>
      replaceWorkspace(() => {
        setView("canvas");
        newLaneboard();
      }),
    [replaceWorkspace],
  );
  const sequence = useMemo(() => (j ? presentationFor(j) : []), [j]),
    slide = present !== null ? sequence[present] : undefined;
  const effectiveUI = useMemo(
    () =>
      slide ? { ...s.workspace.ui, layers: slide.layers } : s.workspace.ui,
    [slide, s.workspace.ui],
  );
  const graph = useMemo(
    () =>
      j
        ? layout(
            j,
            effectiveUI,
            s.selection,
            slide?.focusLanes,
            slide?.dimJourney,
            { search, owner, severity, lane: laneFilter },
          )
        : null,
    [j, effectiveUI, s.selection, slide, search, owner, severity, laneFilter],
  );
  useEffect(() => {
    setNodes(graph?.nodes || []);
  }, [graph]);
  useEffect(() => {
    const state = useStore.getState(),
      selection = state.selection;
    if (selection?.kind !== "connection" || !graph) return;
    const edge = graph.edges.find((edge) => edge.id === selection.id),
      ref = edge?.data?.connection as ConnectionRef | undefined,
      previous = selection.connection;
    if (!ref) state.select(null);
    else if (
      ref.source.id !== previous?.source.id ||
      ref.source.kind !== previous.source.kind ||
      ref.source.lane !== previous.source.lane ||
      ref.target.id !== previous.target.id
    )
      state.select({ ...selection, connection: ref });
  }, [graph, s.selection]);
  const validConnection = useCallback(
    (connection: Connection | Edge) => {
      const from = flow.getNode(connection.source),
        to = flow.getNode(connection.target);
      const source =
        from?.type === "card" ? cardSource(from.data as CardData) : null;
      const target =
        to?.type === "card" ? cardTarget(to.data as CardData) : null;
      return !!(
        j &&
        source &&
        target &&
        (reconnecting.current
          ? canReconnectConnection(
              j,
              reconnecting.current,
              source,
              target,
              s.workspace.ui.mode,
            )
          : canConnectCards(j, source, target, s.workspace.ui.mode) &&
            !hasCardLink(j, source, target, s.workspace.ui.mode))
      );
    },
    [flow, j, s.workspace.ui.mode],
  );
  useEffect(() => {
    document.documentElement.dataset.sidebar = leftCollapsed
      ? "collapsed"
      : "expanded";
  }, [leftCollapsed]);
  useEffect(() => {
    document.documentElement.dataset.presenting =
      present !== null ? "true" : "false";
  }, [present]);
  useEffect(() => {
    const settings = s.workspace.settings,
      root = document.documentElement;
    if (settings.theme === "system") delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
    root.dataset.accent = settings.accent;
    root.lang = settings.language;
  }, [s.workspace.settings]);
  const journeyId = j?.id;
  useEffect(() => {
    if (journeyId) {
      const v = useStore.getState().workspace.ui.viewport;
      flow.setViewport(
        v || { x: window.innerWidth <= 960 ? 232 : 488, y: 156, zoom: 0.68 },
      );
    }
    setSearch("");
    setOwner("");
    setSeverity("");
    setLaneFilter("");
  }, [journeyId, flow]);
  const readFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      notify("File exceeds the 5 MB limit.");
      return;
    }
    setImportRaw(await file.text());
    setDialog("import");
  };
  const loadExample = (kind: "investing" | "mortgage") => {
    setView("canvas");
    const existing = s.workspace.journeys.find(
      (x) => x.id === (kind === "investing" ? "sme-investing" : "mortgage"),
    );
    if (existing)
      setUI((ui) => {
        ui.selectedJourney = existing.id;
        delete ui.viewport;
      });
    else s.importData(exampleFile(kind), false);
    const selected = currentJourney(useStore.getState());
    s.select(selected ? { kind: "journey", id: selected.id } : null);
  };
  const closeDialog = () => {
    setDialog(null);
    setImportRaw(undefined);
  };
  const select = useCallback(
    (selection: Selection) => {
      setView("canvas");
      useStore.getState().select(selection);
      const candidates = flow
        .getNodes()
        .filter(
          (n) => n.data.entityId === selection.id || n.data.id === selection.id,
        );
      const node =
        candidates.find((n) => n.data.lane === selection.lane) || candidates[0];
      if (node) {
        const parent = node.parentId ? flow.getNode(node.parentId) : undefined;
        const x =
            node.position.x +
            (parent?.position.x || 0) +
            Number(node.style?.width || 220) / 2,
          y =
            node.position.y +
            (parent?.position.y || 0) +
            Number(node.style?.height || 80) / 2;
        flow.setCenter(x, y, {
          zoom: Math.max(flow.getZoom(), 0.8),
          duration: 180,
        });
      }
    },
    [flow],
  );
  const finishPresent = useCallback(() => {
    setPresent(null);
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
    if (originalPresent.current)
      flow.setViewport(originalPresent.current.viewport, duration);
    if (originalPresent.current) setView(originalPresent.current.view);
  }, [flow]);
  useEffect(() => {
    if (present === null) return;
    const changed = () => {
      if (!document.fullscreenElement) finishPresent();
    };
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, [present, finishPresent]);
  const startPresent = () => {
    if (!j) return;
    if (s.selection?.kind === "connection") s.select(null);
    originalPresent.current = {
      layers: s.workspace.ui.layers,
      viewport: flow.getViewport(),
      view,
    };
    setView("canvas");
    setPresent(0);
    setDrawer(null);
    document.documentElement.requestFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    if (present === null || !graph) return;
    const relevant = graph.nodes.filter(
      (n) =>
        n.type === "cell" &&
        (!slide?.focusLanes.length ||
          slide.focusLanes.includes(String(n.data.lane))),
    );
    if (!relevant.length) return;
    const fitted = getViewportForBounds(
      getNodesBounds(
        relevant.map((node) => ({
          ...node,
          width: Number(node.style?.width),
          height: Number(node.style?.height),
        })),
      ),
      Math.max(100, canvasSize.width - columnLeft - rightInset),
      Math.max(100, canvasSize.height - laneTop - guideHeight - 32),
      0.1,
      0.8,
      0.04,
    );
    const frame = requestAnimationFrame(
      () =>
        void flow.setViewport(
          { ...fitted, x: fitted.x + columnLeft, y: fitted.y + laneTop },
          { duration: 200 },
        ),
    );
    return () => cancelAnimationFrame(frame);
  }, [
    present,
    graph,
    slide,
    flow,
    canvasSize,
    columnLeft,
    rightInset,
    laneTop,
    guideHeight,
  ]);
  const defaultCell = () => {
    const sel = s.selection;
    return {
      lane:
        sel?.lane ||
        j?.lanes.find(
          (l) => l.channel?.type === "digital" && l.channel.authenticated,
        )?.id ||
        j?.lanes[0].id ||
        "",
      phase: sel?.phase || j?.phases[0].id || "",
    };
  };
  const place = (
    kind: string,
    cell = defaultCell(),
    position?: { x: number; y: number },
  ) => {
    if (!j) return;
    if (j.readOnly) {
      notify(t("duplicate"));
      return;
    }
    if (
      editorMode === "sketch" ||
      ["rectangle", "ellipse", "arrow", "text"].includes(kind)
    ) {
      const id = newId("sketch");
      s.editJourney((j) =>
        j.sketches.push({
          id,
          kind: kind as "rectangle" | "ellipse" | "arrow" | "text" | "note",
          text:
            kind === "note"
              ? "Your note"
              : kind === "text"
                ? "Your annotation"
                : "",
          x: position?.x ?? 100,
          y: position?.y ?? 100,
          width: 220,
          height: 100,
        }),
      );
      s.select({ kind: "sketch", id });
    } else if (kind === "feed" && !j.steps.length) {
      notify(t("noFeedStep"));
      return;
    } else addCard(kind as Selection["kind"], cell.lane, cell.phase, position);
    if (!keepTool) setTool("select");
    setPicker(null);
  };
  const fit = () => {
    if (!graph) return;
    const cells = graph.nodes.filter((n) => n.type === "cell");
    if (!cells.length) return;
    const fitted = getViewportForBounds(
      getNodesBounds(cells),
      Math.max(100, canvasSize.width - columnLeft - rightInset),
      Math.max(100, canvasSize.height - laneTop - (narrow ? 154 : 94)),
      0.1,
      1,
      0.04,
    );
    void flow.setViewport(
      { ...fitted, x: fitted.x + columnLeft, y: fitted.y + laneTop },
      { duration: 180 },
    );
  };
  const onChanges = useCallback(
    (changes: NodeChange[]) => setNodes((ns) => applyNodeChanges(changes, ns)),
    [],
  );
  const onSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => {
    const ids = [
      ...new Set(
        nodes
          .filter((n) => n.type === "card" || n.type === "sketch")
          .map((n) => String(n.data.entityId || n.data.id)),
      ),
    ];
    const previous = useStore.getState().selectedIds;
    if (
      ids.length > 1 &&
      (ids.length !== previous.length ||
        ids.some((id, i) => id !== previous[i]))
    ) {
      useStore.setState({ selectedIds: ids });
    }
  }, []);
  const onDragStop = (_: unknown, node: Node, dragged: Node[]) => {
    const list = dragged?.length ? dragged : [node];
    s.editJourney((j) => {
      for (const n of list) {
        if (n.type === "cell" || n.type === "curve") continue;
        const parent = n.parentId ? flow.getNode(n.parentId) : undefined;
        const abs = {
          x: n.position.x + (parent?.position.x || 0),
          y: n.position.y + (parent?.position.y || 0),
        };
        const centre = {
          x: abs.x + Number(n.style?.width || 220) / 2,
          y: abs.y + Number(n.style?.height || 80) / 2,
        };
        const cell = graph?.nodes.find(
          (c) =>
            c.type === "cell" &&
            centre.x >= c.position.x &&
            centre.x <= c.position.x + Number(c.style?.width) &&
            centre.y >= c.position.y &&
            centre.y <= c.position.y + Number(c.style?.height),
        );
        if (n.type === "sketch") {
          const sketch = j.sketches.find((x) => x.id === n.data.id);
          if (sketch) {
            sketch.x = abs.x;
            sketch.y = abs.y;
            if (sketch.anchor) {
              if (cell)
                sketch.anchor = {
                  lane: String(cell.data.lane),
                  phase: String(cell.data.phase),
                  dx: abs.x - cell.position.x,
                  dy: abs.y - cell.position.y,
                };
              else delete sketch.anchor;
            }
          }
          continue;
        }
        if (!cell) continue;
        const data = n.data as CardData,
          lane = String(cell.data.lane),
          phase = String(cell.data.phase);
        if (data.kind === "service") {
          const service = j.services.find((x) => x.id === data.entityId),
            target = j.lanes.find((x) => x.id === lane);
          if (service) {
            service.phase = phase;
            if (target?.channel?.type === "digital" && lane !== data.lane) {
              service.status[s.workspace.ui.mode][lane] =
                service.status[s.workspace.ui.mode][data.lane] || "native";
              service.status[s.workspace.ui.mode][data.lane] = "na";
            }
          }
        } else {
          const arr =
            data.kind === "step"
              ? j.steps
              : data.kind === "friction"
                ? j.frictions
                : data.kind === "feed"
                  ? j.feeds
                  : j.notes;
          const item = arr.find((x) => x.id === data.entityId);
          if (item) {
            item.lane = lane;
            item.phase = phase;
          }
        }
      }
    });
    setNodes(graph?.nodes || []);
  };
  const exportCanvasImage = (type: "png" | "svg") => {
    setView("canvas");
    requestAnimationFrame(
      () => void exportImage(type, 1).catch((error) => notify(error.message)),
    );
  };
  const actions: Action[] = [
    {
      id: "open-file",
      label: t("openFile"),
      shortcut: "Ctrl O",
      run: openLaneboard,
    },
    {
      id: "save-file",
      label: t("saveFile"),
      shortcut: "Ctrl S",
      run: () => save(),
    },
    {
      id: "save-file-as",
      label: t("saveFileAs"),
      shortcut: "Ctrl Shift S",
      run: () => save(true),
    },
    { id: "new-laneboard", label: t("newLaneboard"), run: startNewLaneboard },
    { id: "new", label: t("newJourney"), run: () => setDialog("new") },
    { id: "duplicate-journey", label: t("duplicate"), run: s.duplicateJourney },
    { id: "import", label: t("import"), run: () => setDialog("import") },
    {
      id: "export",
      label: t("export"),
      run: () => {
        setView("canvas");
        setDialog("export");
      },
    },
    { id: "backup", label: t("backup"), run: () => exportJSON(true) },
    {
      id: "png",
      label: "Export PNG",
      run: () => exportCanvasImage("png"),
    },
    {
      id: "svg",
      label: "Export SVG",
      run: () => exportCanvasImage("svg"),
    },
    {
      id: "csv-services",
      label: `${t("export")} ${t("services")} CSV`,
      run: () => {
        if (j) exportCSV("services", j, s.workspace.ui.mode);
      },
    },
    {
      id: "csv-frictions",
      label: `${t("export")} ${t("frictions")} CSV`,
      run: () => {
        if (j) exportCSV("frictions", j, s.workspace.ui.mode);
      },
    },
    { id: "ai", label: t("ai"), run: () => setDialog("ai") },
    { id: "settings", label: t("settings"), run: () => setDialog("settings") },
    {
      id: "definitions",
      label: t("definitions"),
      run: () => setDialog("definitions"),
    },
    {
      id: "help",
      label: t("help"),
      run: () => setDialog("help"),
      shortcut: "?",
    },
    {
      id: "ui",
      label: t(leftCollapsed ? "expandUI" : "toggleUI"),
      run: () => setLeftCollapsed((v) => !v),
      shortcut: "⌘ \\",
    },
    { id: "present", label: t("present"), run: startPresent },
    { id: "fit", label: t("fit"), run: fit },
    {
      id: "mode",
      label: `Switch to ${s.workspace.ui.mode === "now" ? t("target") : t("now")}`,
      run: () => s.setMode(s.workspace.ui.mode === "now" ? "target" : "now"),
      shortcut: "Shift M",
    },
    {
      id: "undo",
      label: t("undo"),
      run: () => useStore.temporal.getState().undo(),
      shortcut: "⌘ Z",
    },
    {
      id: "redo",
      label: t("redo"),
      run: () => useStore.temporal.getState().redo(),
      shortcut: "⌘ Shift Z",
    },
    { id: "addlane", label: t("addLane"), run: addLane },
    { id: "addphase", label: t("addPhase"), run: addPhase },
    { id: "addgroup", label: t("addGroup"), run: addGroup },
    { id: "copy", label: t("copySelected"), run: copyCards },
    {
      id: "paste",
      label: t("pasteCards"),
      run: () => void pasteCards().catch((e) => notify(e.message)),
    },
    {
      id: "duplicate-cards",
      label: t("duplicateSelected"),
      run: duplicateCards,
    },
    { id: "delete-card", label: t("deleteSelected"), run: deleteSelection },
    ...(["service", "step", "friction", "feed", "note"] as const).map(
      (kind) => ({
        id: `add-${kind}`,
        label: t(
          (
            {
              service: "newService",
              step: "newStep",
              friction: "newFriction",
              feed: "newFeed",
              note: "newNote",
            } as const
          )[kind],
        ),
        run: () => place(kind),
      }),
    ),
    ...(["rectangle", "ellipse", "arrow", "text", "note"] as const).map(
      (kind) => ({
        id: `sketch-${kind}`,
        label: `Add sketch ${kind}`,
        run: () => {
          setEditorMode("sketch");
          const cell = defaultCell(),
            id = newId("sketch");
          s.editJourney((j) =>
            j.sketches.push({
              id,
              kind,
              text: kind === "text" || kind === "note" ? "Your annotation" : "",
              x: 100,
              y: 100,
              width: 220,
              height: 100,
              anchor: { ...cell, dx: 12, dy: 12 },
            }),
          );
          s.select({ kind: "sketch", id });
        },
      }),
    ),
    ...layers.map((l) => ({
      id: `layer-${l}`,
      label: `Toggle ${t(l)} layer`,
      run: () => s.toggleLayer(l),
    })),
    ...s.workspace.journeys.map((j) => ({
      id: `journey-${j.id}`,
      label: `Open journey: ${j.title}`,
      run: () => {
        setView("canvas");
        setUI((ui) => {
          ui.selectedJourney = j.id;
          delete ui.viewport;
        });
        s.select({ kind: "journey", id: j.id });
      },
    })),
    ...(["services", "frictions", "capabilities", "steps"] as const).map(
      (v) => ({
        id: `view-${v}`,
        label: `Open ${t(v)} view`,
        run: () => {
          setView("data");
          setDrawer(v);
        },
      }),
    ),
    {
      id: "view-overview",
      label: `Open ${t("overview")} view`,
      run: () => setView("overview"),
    },
    {
      id: "view-canvas",
      label: `Open ${t("canvas")} view`,
      run: () => setView("canvas"),
    },
    ...(j?.lanes.flatMap((l) => [
      {
        id: `lane-${l.id}`,
        label: `Edit lane: ${l.name}`,
        run: () => s.select({ kind: "lane", id: l.id }),
      },
      {
        id: `hide-${l.id}`,
        label: `${l.hidden ? t("show") : t("hide")} lane: ${l.name}`,
        run: () =>
          s.editJourney((j) => {
            const x = j.lanes.find((x) => x.id === l.id)!;
            x.hidden = !x.hidden;
          }),
      },
    ]) || []),
    ...(j?.phases.map((p) => ({
      id: `phase-${p.id}`,
      label: `Edit phase: ${p.name}`,
      run: () => s.select({ kind: "phase", id: p.id }),
    })) || []),
    ...(j?.services.map((c) => ({
      id: `edit-service-${c.id}`,
      label: `Edit service: ${c.name}`,
      run: () => select({ kind: "service", id: c.id }),
    })) || []),
    ...(j?.steps.map((c) => ({
      id: `edit-step-${c.id}`,
      label: `Edit step: ${c.text}`,
      run: () => select({ kind: "step", id: c.id }),
    })) || []),
    ...(j?.frictions.map((c) => ({
      id: `edit-friction-${c.id}`,
      label: `Edit friction: ${c.title}`,
      run: () => select({ kind: "friction", id: c.id }),
    })) || []),
    ...(j?.feeds.map((c) => ({
      id: `edit-feed-${c.id}`,
      label: `Edit feed: ${c.text}`,
      run: () => select({ kind: "feed", id: c.id }),
    })) || []),
    ...(j?.notes.map((c) => ({
      id: `edit-note-${c.id}`,
      label: `Edit note: ${c.text}`,
      run: () => select({ kind: "note", id: c.id }),
    })) || []),
    ...(j?.laneGroups.map((g) => ({
      id: `group-${g.id}`,
      label: `Collapse / expand ${g.name}`,
      run: () => toggleGroup(g.id),
    })) || []),
  ];
  function toggleGroup(id: string) {
    setUI((ui) => {
      ui.collapsedGroups = ui.collapsedGroups.includes(id)
        ? ui.collapsedGroups.filter((x) => x !== id)
        : [...ui.collapsedGroups, id];
    });
  }
  function revealLane(id: string) {
    const state = useStore.getState(),
      journey = currentJourney(state);
    if (!journey) return;
    const row = layout(journey, state.workspace.ui, null).rows.find(
      (r) => r.id === id,
    );
    if (!row) return;
    const current = flow.getViewport(),
      top = laneTop + 8,
      bottom = canvasSize.height - 72;
    const rowTop = current.y + row.y * current.zoom,
      rowBottom = rowTop + row.height * current.zoom;
    const y =
      rowTop < top
        ? top - row.y * current.zoom
        : rowBottom > bottom
          ? Math.max(
              top - row.y * current.zoom,
              bottom - (row.y + row.height) * current.zoom,
            )
          : current.y;
    if (y !== current.y)
      void flow.setViewport({ ...current, y }, { duration: 180 });
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLButtonElement>(
          `[data-lane-label="${CSS.escape(id)}"]`,
        )
        ?.focus({ preventScroll: true }),
    );
  }
  function contextAt(element: Element) {
    if (
      element.closest(
        'input, textarea, select, [contenteditable], a, [role="menu"], [role="dialog"]',
      )
    )
      return null;
    const edgeId = element.closest<SVGElement>(".react-flow__edge")?.dataset.id,
      edge = edgeId ? flow.getEdge(edgeId) : undefined;
    if (edge?.data?.connection)
      return {
        selection: {
          kind: "connection",
          id: edge.id,
          connection: edge.data.connection as ConnectionRef,
        } as Selection,
      };
    const structure = element.closest<HTMLElement>(
      "[data-context-lane], [data-context-phase], [data-context-group]",
    );
    if (structure) {
      const kind = structure.dataset.contextLane
        ? "lane"
        : structure.dataset.contextPhase
          ? "phase"
          : "group";
      return {
        selection: {
          kind,
          id:
            structure.dataset.contextLane ||
            structure.dataset.contextPhase ||
            structure.dataset.contextGroup!,
        } as Selection,
      };
    }
    const nodeId =
        element.closest<HTMLElement>(".react-flow__node")?.dataset.id,
      node = nodeId ? flow.getNode(nodeId) : undefined;
    if (node?.type === "card") {
      const data = node.data as CardData;
      return {
        nodeId,
        selection: {
          kind: data.kind,
          id: data.entityId,
          lane: data.lane,
          phase: data.phase,
        },
      };
    }
    if (node?.type === "cell") {
      const data = node.data as CellData;
      return {
        nodeId,
        selection: {
          kind: "cell",
          id: node.id,
          lane: data.lane,
          phase: data.phase,
        } as Selection,
      };
    }
    if (node?.type === "sketch")
      return {
        nodeId,
        selection: { kind: "sketch", id: String(node.data.id) } as Selection,
      };
    if (
      element.closest(".react-flow__renderer") &&
      !element.closest(
        ".react-flow__panel, .lb-island, .lb-dock, .lb-canvas-ui",
      )
    )
      return { selection: null };
    return null;
  }
  function openContext(
    element: Element,
    x: number,
    y: number,
    keyboard = false,
  ) {
    if (!j || view !== "canvas" || present !== null || dialog) return false;
    const target = contextAt(element);
    if (!target) return false;
    s.select(target.selection ? { ...target.selection, inline: true } : null);
    setPicker(null);
    setContextMenu({
      ...target,
      x,
      y,
      keyboard,
      focus:
        element.closest<HTMLElement>("button, [tabindex]") ||
        editorRef.current!,
    });
    return true;
  }
  const contextSelection = contextMenu?.selection,
    contextLane = j?.lanes.find(
      (lane) =>
        lane.id ===
        (contextSelection?.kind === "lane"
          ? contextSelection.id
          : contextSelection?.lane),
    ),
    contextPhase = j?.phases.find(
      (phase) =>
        phase.id ===
        (contextSelection?.kind === "phase"
          ? contextSelection.id
          : contextSelection?.phase),
    ),
    contextGroup = j?.laneGroups.find(
      (group) => group.id === contextSelection?.id,
    ),
    contextNode = contextMenu?.nodeId
      ? flow.getNode(contextMenu.nodeId)
      : undefined,
    contextTitle =
      contextSelection?.kind === "connection"
        ? t("connectionControls")
        : contextSelection?.kind === "cell"
          ? `${contextLane?.name} · ${contextPhase?.name}`
          : contextSelection?.kind === "lane"
            ? contextLane?.name
            : contextSelection?.kind === "phase"
              ? contextPhase?.name
              : contextSelection?.kind === "group"
                ? contextGroup?.name
                : (contextNode?.data.text as string | undefined) ||
                  (contextSelection?.kind === "sketch"
                    ? t("sketch")
                    : undefined);
  const clickControl = (selector: string) =>
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(selector)?.click(),
    );
  const contextCommands: ContextCommand[] = [];
  if (contextMenu && j) {
    const selection = contextMenu.selection,
      blocked =
        j.readOnly ||
        contextLane?.locked ||
        (s.workspace.ui.mode === "target" && targetState(j) === "not-started"),
      card =
        selection &&
        ["service", "step", "friction", "feed", "note", "sketch"].includes(
          selection.kind,
        );
    if (selection && selection.kind !== "connection")
      contextCommands.push({
        label: t("editDetails"),
        restoreFocus: false,
        run: () => {
          s.select({ ...selection, inline: false });
          if (narrow) setSheet("details");
        },
      });
    if (j.readOnly)
      contextCommands.push({
        label: t("duplicate"),
        restoreFocus: false,
        run: () => {
          s.duplicateJourney();
          if (selection) s.select({ ...selection, inline: true });
        },
      });
    if (selection?.kind === "connection" && selection.connection) {
      const disabled = !canEditConnection(
        j,
        selection.connection,
        s.workspace.ui.mode,
      );
      for (const end of ["source", "target"] as const)
        contextCommands.push({
          label: t(end === "source" ? "changeSource" : "changeDestination"),
          disabled,
          restoreFocus: false,
          run: () =>
            clickControl(
              `[data-edge-controls="${CSS.escape(selection.id)}"] [data-edge-action="${end}"]`,
            ),
        });
      contextCommands.push({
        label: t("deleteConnection"),
        disabled,
        destructive: true,
        separator: true,
        run: deleteSelection,
      });
    } else if (card && selection) {
      if (
        selection.kind === "service" ||
        selection.kind === "feed" ||
        selection.kind === "step"
      )
        contextCommands.push({
          label: t("connectCard"),
          disabled: blocked,
          restoreFocus: false,
          run: () =>
            clickControl(
              `[data-id="${CSS.escape(contextMenu.nodeId!)}"] .lb-link-handle button`,
            ),
        });
      contextCommands.push(
        { label: t("copy"), run: copyCards },
        { label: t("duplicateItem"), disabled: blocked, run: duplicateCards },
        {
          label: t("delete"),
          disabled: blocked,
          destructive: true,
          separator: true,
          run: deleteSelection,
        },
      );
    } else if (selection?.kind === "cell") {
      for (const kind of [
        "step",
        ...(contextLane?.channel?.type === "digital" ? ["service"] : []),
        "friction",
        "note",
        ...(j.steps.length ? ["feed"] : []),
      ] as Selection["kind"][])
        contextCommands.push({
          label: t(
            {
              step: "toolStep",
              service: "toolService",
              friction: "toolFriction",
              note: "toolNote",
              feed: "toolFeed",
            }[kind as "step"],
          ),
          disabled: blocked,
          restoreFocus: false,
          run: () => addCard(kind, selection.lane!, selection.phase!),
        });
    } else if (selection?.kind === "lane" && contextLane) {
      contextCommands.push(
        {
          label: t("editLane"),
          restoreFocus: false,
          run: () =>
            clickControl(`[data-lane-label="${CSS.escape(selection.id)}"]`),
        },
        {
          label: t(contextLane.locked ? "unlockLane" : "lockLane"),
          disabled: j.readOnly,
          run: () =>
            s.editJourney((journey) => {
              const lane = journey.lanes.find(
                (lane) => lane.id === selection.id,
              );
              if (lane) lane.locked = !lane.locked;
            }),
        },
        {
          label: t("hideLane"),
          disabled: j.readOnly,
          run: () => setLaneHidden(selection.id, true),
        },
      );
    } else if (selection?.kind === "group") {
      contextCommands.push(
        {
          label: t(
            s.workspace.ui.collapsedGroups.includes(selection.id)
              ? "expandGroup"
              : "collapseGroup",
          ),
          run: () => toggleGroup(selection.id),
        },
        {
          label: t("addLane"),
          disabled: j.readOnly || j.lanes.length >= 100,
          restoreFocus: false,
          run: () =>
            clickControl(
              `[data-context-group="${CSS.escape(selection.id)}"] .lb-inline-add`,
            ),
        },
      );
    } else if (!selection) {
      contextCommands.push(
        {
          label: t("paste"),
          disabled: j.readOnly,
          run: () => void pasteCards().catch((e) => notify(e.message)),
        },
        {
          label: t("addLane"),
          disabled: j.readOnly || j.lanes.length >= 100,
          restoreFocus: false,
          run: () => clickControl(".lb-canvas-actions [data-add-lane]"),
        },
        {
          label: t("addPhase"),
          disabled: j.readOnly,
          restoreFocus: false,
          run: addPhase,
        },
        { label: t("fit"), separator: true, run: fit },
        {
          label: t("openPalette"),
          restoreFocus: false,
          run: () => setDialog("palette"),
        },
      );
    }
    const history = useStore.temporal.getState();
    contextCommands.push(
      {
        label: t("undo"),
        separator: true,
        disabled: !history.pastStates.length,
        run: () => history.undo(),
      },
      {
        label: t("redo"),
        disabled: !history.futureStates.length,
        run: () => history.redo(),
      },
    );
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setDialog("palette");
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === "s" || key === "o") {
          e.preventDefault();
          if (dialog || present !== null) return;
          if (key === "o") openLaneboard();
          else save(e.shiftKey);
          return;
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setLeftCollapsed((v) => !v);
        return;
      }
      const active = document.activeElement;
      if (
        e.target instanceof HTMLElement &&
        e.target.closest('[role="dialog"], [role="menu"]')
      )
        return;
      if (active instanceof HTMLElement && active.closest(".lb-lane-popover"))
        return;
      if (
        active instanceof HTMLElement &&
        (active.isContentEditable ||
          ["INPUT", "SELECT", "TEXTAREA"].includes(active.tagName))
      ) {
        if (e.key === "Escape" && !dialog) (active as HTMLElement).blur();
        return;
      }
      if (dialog) return;
      if (present !== null) {
        if (["ArrowRight", "ArrowDown", " "].includes(e.key)) {
          e.preventDefault();
          setPresent((v) => Math.min(sequence.length - 1, (v || 0) + 1));
        }
        if (["ArrowLeft", "ArrowUp"].includes(e.key)) {
          e.preventDefault();
          setPresent((v) => Math.max(0, (v || 0) - 1));
        }
        if (e.key === "Escape") finishPresent();
        return;
      }
      const mod = e.metaKey || e.ctrlKey,
        k = e.key.toLowerCase();
      if (mod) {
        if (view !== "canvas" && !["z", "k", "\\"].includes(k)) return;
        if (k === "z") {
          e.preventDefault();
          if (e.shiftKey) useStore.temporal.getState().redo();
          else useStore.temporal.getState().undo();
        }
        if (k === "k") {
          e.preventDefault();
          setDialog("palette");
        }
        if (k === "d") {
          e.preventDefault();
          duplicateCards();
        }
        if (k === "c") {
          e.preventDefault();
          copyCards();
        }
        if (k === "v") {
          e.preventDefault();
          void pasteCards().catch((e) => notify(e.message));
        }
        if (k === "\\") {
          e.preventDefault();
          setLeftCollapsed((v) => !v);
        }
        return;
      }
      if (k === "m" && e.shiftKey) {
        e.preventDefault();
        s.setMode(s.workspace.ui.mode === "now" ? "target" : "now");
        return;
      }
      if (view !== "canvas") {
        if (e.key === "?") setDialog("help");
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        setSpace(true);
      }
      if (e.key === "?") setDialog("help");
      if (e.key === "Escape") {
        setTool("select");
        setPicker(null);
        s.select(null);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelection();
      }
      if (k === "q") setKeepTool((v) => !v);
      if (e.key === "+" || e.key === "=") void flow.zoomIn();
      if (e.key === "-") void flow.zoomOut();
      const spec = (editorMode === "map" ? toolSpec : sketchSpec).find(
        (x) => x.key.toLowerCase() === k,
      );
      if (spec) setTool(spec.id);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " ") setSpace(false);
    };
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", up);
    };
  });
  const backupAge =
    Date.now() -
    new Date(
      s.workspace.settings.lastExport || s.workspace.settings.createdAt,
    ).getTime();
  return (
    <main
      ref={editorRef}
      tabIndex={-1}
      className="lb-editor"
      data-view={view}
      data-present={present !== null}
      aria-label="Laneboard editor"
      style={
        { "--lb-reconnect-radius": `${10 / viewport.zoom}px` } as CSSProperties
      }
      onContextMenuCapture={(e) => {
        if (e.shiftKey) {
          setContextMenu(null);
          return;
        }
        if (
          e.target instanceof Element &&
          openContext(e.target, e.clientX, e.clientY)
        ) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onKeyDownCapture={(e) => {
        if (e.key !== "ContextMenu" && !(e.shiftKey && e.key === "F10")) return;
        if (!(e.target instanceof Element)) return;
        const rect = e.target.getBoundingClientRect();
        if (
          openContext(
            e.target,
            rect.left + rect.width / 2,
            rect.top + Math.min(rect.height / 2, 40),
            true,
          )
        ) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          void readFile(e.dataTransfer.files[0]);
        }
      }}
    >
      {contextMenu ? (
        <CanvasContextMenu
          target={contextMenu}
          title={contextTitle || t("contextCanvas")}
          hint={
            j?.readOnly
              ? t("readOnly")
              : contextLane?.locked
                ? t("lockedLaneHint")
                : undefined
          }
          commands={contextCommands}
          close={() => setContextMenu(null)}
        />
      ) : null}
      <input
        ref={fileRef}
        type="file"
        hidden
        accept=".json"
        onChange={(e) => void readFile(e.target.files?.[0])}
      />
      <ReactFlow
        nodes={nodes}
        edges={graph?.edges || []}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onEdgesChange={(changes) => {
          for (const change of changes)
            if (change.type === "select") {
              const state = useStore.getState();
              if (change.selected && state.selection?.id !== change.id) {
                const edge = flow.getEdge(change.id);
                if (edge?.data?.connection)
                  state.select({
                    kind: "connection",
                    id: edge.id,
                    connection: edge.data.connection as ConnectionRef,
                    inline: true,
                  });
              } else if (
                !change.selected &&
                state.selection?.kind === "connection" &&
                state.selection.id === change.id
              )
                state.select(null);
            }
        }}
        onEdgeClick={(_, edge) => {
          if (present === null && view === "canvas")
            s.select({
              kind: "connection",
              id: edge.id,
              connection: edge.data?.connection as ConnectionRef,
              inline: true,
            });
        }}
        edgesReconnectable={false}
        elementsSelectable={present === null && view === "canvas"}
        edgesFocusable={present === null && view === "canvas"}
        reconnectRadius={10 / viewport.zoom}
        onReconnectStart={(_, edge) => {
          reconnecting.current = edge.data?.connection as ConnectionRef;
        }}
        onReconnect={(edge, connection) => {
          const original = edge.data?.connection as ConnectionRef | undefined,
            source = cardSource(
              flow.getNode(connection.source)?.data as CardData | undefined,
            ),
            target = cardTarget(
              flow.getNode(connection.target)?.data as CardData | undefined,
            );
          if (
            original &&
            source &&
            target &&
            reconnectCardLink(original, source, target)
          ) {
            const ref = { source, target };
            s.select({
              kind: "connection",
              id: connectionEdgeId(connection.source, connection.target, ref),
              connection: ref,
              inline: true,
            });
            notify(t("linkUpdated"));
          }
        }}
        onReconnectEnd={() => {
          reconnecting.current = null;
        }}
        onNodesChange={onChanges}
        onNodeDragStop={onDragStop}
        nodesDraggable={
          present === null &&
          view === "canvas" &&
          !!j &&
          !j.readOnly &&
          tool !== "hand" &&
          !space
        }
        nodesConnectable={
          present === null && view === "canvas" && !!j && !j.readOnly && !space
        }
        connectOnClick={false}
        connectionLineType={ConnectionLineType.SmoothStep}
        connectionLineStyle={{ stroke: "var(--accent)", strokeWidth: 2 }}
        connectionRadius={24}
        isValidConnection={validConnection}
        onConnect={(connection) => {
          const source = cardSource(
            flow.getNode(connection.source)?.data as CardData | undefined,
          );
          const target = cardTarget(
            flow.getNode(connection.target)?.data as CardData | undefined,
          );
          if (source && target && setCardLink(source, target))
            notify(t(source.kind === "feed" ? "linkUpdated" : "linkAdded"));
        }}
        panOnDrag={tool === "hand" || space ? [0, 1] : [1]}
        onMoveStart={() => setContextMenu(null)}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        zoomActivationKeyCode={["Meta", "Control"]}
        selectionOnDrag={tool === "select" && !space}
        selectionKeyCode="Shift"
        multiSelectionKeyCode={["Meta", "Control"]}
        deleteKeyCode={null}
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={
          s.workspace.ui.viewport || { x: columnLeft + 8, y: 156, zoom: 0.68 }
        }
        onMoveEnd={(_, v) => {
          if (present === null) {
            // Moving the camera must not consume the undo for a lane edit.
            const history = useStore.temporal.getState(),
              wasTracking = history.isTracking;
            history.pause();
            try {
              setUI((ui) => {
                ui.viewport = v;
              });
            } finally {
              if (wasTracking) history.resume();
            }
          }
        }}
        onNodeClick={(_, node) => {
          if (node.type === "cell") {
            const c = node.data as CellData;
            if (tool !== "select" && tool !== "hand")
              place(
                tool,
                { lane: c.lane, phase: c.phase },
                flow.screenToFlowPosition({ x: _.clientX, y: _.clientY }),
              );
            else
              s.select({
                kind: "cell",
                id: node.id,
                lane: c.lane,
                phase: c.phase,
              });
          } else if (node.type === "card") {
            if (narrow) setSheet("details");
            const c = node.data as CardData;
            s.select({
              kind: c.kind,
              id: c.entityId,
              lane: c.lane,
              phase: c.phase,
            });
          } else if (node.type === "sketch")
            s.select({ kind: "sketch", id: String(node.data.id) });
        }}
        onNodeDoubleClick={(_, node) => {
          if (node.type === "cell") {
            const c = node.data as CellData;
            if (j?.readOnly) notify(t("duplicate"));
            else setPicker({ lane: c.lane, phase: c.phase });
          }
        }}
        onPaneClick={(e) => {
          if (editorMode === "sketch" && !["select", "hand"].includes(tool))
            place(
              tool,
              defaultCell(),
              flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }),
            );
          else s.select(null);
        }}
        onSelectionChange={onSelectionChange}
        aria-label="Journey canvas"
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={20} size={1} />
        {j && graph && view === "canvas" ? (
          <>
            <div
              className="lb-phase-overlay"
              style={{ left: columnLeft, right: rightInset, top: phaseTop }}
            >
              {graph.columns.map((p, i) => (
                <div
                  key={p.id}
                  className="lb-phase lb-sticky-phase"
                  data-context-phase={p.id}
                  style={{
                    left: viewport.x - columnLeft + p.x * viewport.zoom,
                    width: p.width * viewport.zoom,
                  }}
                >
                  <button
                    className="lb-phase-title"
                    onClick={() => s.select({ kind: "phase", id: p.id })}
                  >
                    <span className="lb-phase__index">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {p.name}
                  </button>
                  <button
                    className="lb-iconbtn"
                    aria-label={`Edit phase ${p.name}`}
                    onClick={() => s.select({ kind: "phase", id: p.id })}
                  >
                    <MoreHorizontal />
                  </button>
                  <div
                    className="lb-phase-resize"
                    role="separator"
                    aria-label={`Resize phase ${p.name}`}
                    aria-orientation="vertical"
                    tabIndex={0}
                    aria-valuenow={p.width}
                    aria-valuemin={220}
                    aria-valuemax={1600}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight")
                        s.editJourney((j) => {
                          j.phases[i].width = Math.min(1600, p.width + 20);
                        });
                      if (e.key === "ArrowLeft")
                        s.editJourney((j) => {
                          j.phases[i].width = Math.max(220, p.width - 20);
                        });
                    }}
                    onPointerDown={(e) => {
                      if (e.button !== 0 || e.ctrlKey) return;
                      e.preventDefault();
                      if (j.readOnly) return;
                      const start = e.clientX,
                        width = p.width;
                      const move = (ev: PointerEvent) =>
                        s.editJourney((j) => {
                          j.phases[i].width = Math.max(
                            220,
                            Math.min(
                              1600,
                              width + (ev.clientX - start) / viewport.zoom,
                            ),
                          );
                        });
                      const end = () => {
                        window.removeEventListener("pointermove", move);
                        window.removeEventListener("pointerup", end);
                      };
                      window.addEventListener("pointermove", move);
                      window.addEventListener("pointerup", end);
                    }}
                  />
                </div>
              ))}
            </div>
            <div
              className="lb-lane-overlay"
              style={{
                left: leftX,
                width: labelWidth,
                top: laneTop,
                bottom: present !== null ? guideHeight + 24 : 64,
              }}
            >
              {graph.rows.map((row) => (
                <div
                  key={`${row.kind}-${row.id}`}
                  className={`lb-sticky-row lb-sticky-row--${row.kind}`}
                  data-context-lane={row.kind === "lane" ? row.id : undefined}
                  style={{
                    top: viewport.y - laneTop + row.y * viewport.zoom,
                    height: row.height * viewport.zoom,
                  }}
                >
                  {row.kind === "group" ? (
                    <div
                      className="lb-inline-group"
                      data-context-group={row.id}
                    >
                      <button
                        className="lb-sticky-group"
                        title={row.name}
                        aria-expanded={
                          !s.workspace.ui.collapsedGroups.includes(row.id)
                        }
                        onClick={() => toggleGroup(row.id)}
                      >
                        <ChevronDown size={12} />
                        <span>{row.name}</span>
                      </button>
                      {present === null ? (
                        <AddLaneButton
                          key={j.id}
                          journey={j}
                          group={row.id}
                          compact
                          reveal={revealLane}
                        />
                      ) : null}
                    </div>
                  ) : row.kind === "line" ? (
                    <span
                      className="lb-sticky-line"
                      data-kind={row.lineKind}
                      title={row.name}
                    >
                      {row.lineKind === "boundary"
                        ? "Self-service boundary"
                        : "Line of visibility"}
                    </span>
                  ) : row.kind === "curve" ? (
                    <span className="lb-micro">{t("experience")}</span>
                  ) : (
                    <>
                      {present === null ? (
                        <LaneLabel
                          key={`${j.id}-${row.id}`}
                          journey={j}
                          lane={j.lanes.find((l) => l.id === row.id)!}
                          reveal={revealLane}
                        />
                      ) : (
                        <button
                          className="lb-lane-title"
                          onClick={() => s.select({ kind: "lane", id: row.id })}
                        >
                          {row.name}
                        </button>
                      )}
                      <span className="lb-lane-label__sub">{row.sub}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : null}
        <Panel
          position="top-left"
          className="lb-topbar"
          data-search-open={searchOpen && view === "canvas"}
        >
          <div className="lb-island lb-filepill">
            <div className="lb-filepill__logo">
              {s.workspace.settings.logo ? (
                <img src={s.workspace.settings.logo} alt="Workspace logo" />
              ) : (
                <Layers size={18} />
              )}
            </div>
            {j ? (
              <button
                className="lb-filepill__journey"
                aria-label={t("editJourney")}
                title={j.title}
                onClick={() => {
                  setView("canvas");
                  s.select({ kind: "journey", id: j.id });
                  if (narrow) setSheet("details");
                }}
              >
                <span className="lb-filepill__context">
                  Laneboard{" "}
                  <span>
                    · {j.segment} · {t(s.workspace.ui.mode)}
                  </span>
                </span>
                <span className="lb-filepill__title">{j.title}</span>
              </button>
            ) : (
              <>
                <span className="lb-filepill__name">Laneboard</span>
                <span className="lb-filepill-workspace">
                  {s.workspace.settings.name}
                </span>
              </>
            )}
            <span className="lb-saved" data-state={s.saveState} role="status">
              {t(
                s.saveState === "saved"
                  ? "saved"
                  : s.saveState === "saving"
                    ? "saving"
                    : "saveError",
              )}
            </span>
            {file.name ? (
              <button
                type="button"
                className="lb-filestate"
                data-dirty={file.dirty}
                onClick={() => save()}
                title={`${file.name} · ${t(file.dirty ? "unsavedChanges" : "savedToFile")} · ${t("saveFile")} (Ctrl+S)`}
                aria-label={`${file.name}, ${t(file.dirty ? "unsavedChanges" : "savedToFile")}. ${t("saveFile")}`}
                data-testid="file-state"
              >
                <FileText size={14} aria-hidden />
                <span className="lb-filestate__name">
                  {file.name.replace(/\.laneboard\.json$|\.json$/, "")}
                </span>
              </button>
            ) : null}
            <Menu.Root>
              <Menu.Trigger
                className="lb-iconbtn"
                aria-label={t("workspaceMenu")}
              >
                <ChevronDown />
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Content className="lb-popover lb-menu" sideOffset={8}>
                  {[
                    { label: t("openFile"), run: openLaneboard },
                    { label: t("saveFile"), run: () => save() },
                    { label: t("saveFileAs"), run: () => save(true) },
                    { label: t("newLaneboard"), run: startNewLaneboard },
                    { label: t("newJourney"), run: () => setDialog("new") },
                    { label: t("import"), run: () => setDialog("import") },
                    {
                      label: t("export"),
                      run: () => {
                        setView("canvas");
                        setDialog("export");
                      },
                    },
                    { label: t("backup"), run: () => exportJSON(true) },
                    { label: t("settings"), run: () => setDialog("settings") },
                    {
                      label: t(leftCollapsed ? "expandUI" : "toggleUI"),
                      run: () => setLeftCollapsed((v) => !v),
                    },
                  ].map((a) => (
                    <Menu.Item
                      key={t(a.label)}
                      className="lb-menu__item"
                      onSelect={a.run}
                    >
                      {t(a.label)}
                    </Menu.Item>
                  ))}
                </Menu.Content>
              </Menu.Portal>
            </Menu.Root>
          </div>
          {j && present === null ? (
            <div className="lb-island lb-view-switch">
              <div
                className="lb-segmented"
                role="group"
                aria-label={t("journeyViews")}
              >
                {(["canvas", "data", "overview"] as const).map((name) => (
                  <button
                    key={name}
                    aria-pressed={view === name}
                    onClick={() => setView(name)}
                  >
                    {t(name)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {j && present === null && view === "canvas" ? (
            <div
              className="lb-island lb-searchbar"
              data-open={searchOpen}
              data-active={!!(search || owner || severity || laneFilter)}
            >
              <button
                ref={searchTriggerRef}
                className="lb-iconbtn lb-search-trigger"
                aria-label={t("search")}
                title={t("search")}
                aria-expanded={searchOpen}
                aria-controls="journey-search"
                onClick={() => {
                  setSearchOpen(true);
                  requestAnimationFrame(() => searchRef.current?.focus());
                }}
              >
                <Search size={18} />
              </button>
              <div className="lb-search-content" hidden={!searchOpen}>
                <input
                  ref={searchRef}
                  id="journey-search"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      closeSearch();
                    }
                  }}
                  aria-label={t("search")}
                  placeholder={t("search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Menu.Root>
                  <Menu.Trigger className="lb-iconbtn" aria-label={t("filter")}>
                    <SlidersHorizontal />
                  </Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Content className="lb-popover lb-filter-menu">
                      <label>
                        {t("owner")}
                        <select
                          className="lb-select"
                          value={owner}
                          onChange={(e) => setOwner(e.target.value)}
                        >
                          <option value="">{t("all")}</option>
                          {s.workspace.owners.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t("frictions")}
                        <select
                          className="lb-select"
                          value={severity}
                          onChange={(e) => setSeverity(e.target.value)}
                        >
                          <option value="">{t("all")}</option>
                          {["high", "medium", "none"].map((x) => (
                            <option key={x} value={x}>
                              {t(x as Key)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t("lane")}
                        <select
                          className="lb-select"
                          value={laneFilter}
                          onChange={(e) => setLaneFilter(e.target.value)}
                        >
                          <option value="">{t("all")}</option>
                          {j.lanes.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="lb-btn"
                        onClick={() => {
                          setSearch("");
                          setOwner("");
                          setSeverity("");
                          setLaneFilter("");
                        }}
                      >
                        {t("clearFilters")}
                      </button>
                    </Menu.Content>
                  </Menu.Portal>
                </Menu.Root>
                <button
                  className="lb-iconbtn"
                  aria-label={t("closeSearch")}
                  title={t("closeSearch")}
                  onClick={closeSearch}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : null}
          <div className="lb-island lb-cluster">
            <div
              className="lb-segmented"
              role="group"
              aria-label="Journey mode"
            >
              {(["now", "target"] as const).map((mode) => (
                <button
                  key={mode}
                  aria-pressed={s.workspace.ui.mode === mode}
                  onClick={() => {
                    s.setMode(mode);
                    if (
                      mode === "target" &&
                      j &&
                      targetState(j) === "not-started"
                    )
                      setDialog("target");
                  }}
                >
                  {t(mode)}
                </button>
              ))}
            </div>
            <button
              className="lb-btn lb-btn--ghost lb-btn--icon"
              aria-label={t("present")}
              title={t("present")}
              disabled={!j}
              onClick={startPresent}
            >
              <Play size={18} aria-hidden="true" />
            </button>
            <button
              className="lb-btn lb-btn--primary lb-btn--icon"
              aria-label={t("export")}
              title={t("export")}
              onClick={() => {
                setView("canvas");
                setDialog("export");
              }}
            >
              <Download size={18} aria-hidden="true" />
            </button>
          </div>
        </Panel>
        {j && present === null && view === "canvas" ? (
          <Panel
            position="top-left"
            className="lb-island lb-canvas-actions"
            style={{ left: leftX, top: phaseTop }}
          >
            <AddLaneButton journey={j} reveal={revealLane} />
            <HiddenLanesControl journey={j} reveal={revealLane} />
            <button
              className="lb-iconbtn"
              aria-label={t("editDetails")}
              onClick={() => {
                if (!s.selection) s.select({ kind: "journey", id: j.id });
                if (narrow) setSheet("details");
              }}
            >
              {<SlidersHorizontal size={16} />}
            </button>
          </Panel>
        ) : null}
        {present === null && view === "canvas" ? (
          <>
            <nav
              className="lb-island lb-rail lb-rail-position"
              aria-label="Workspace tools"
            >
              {[
                {
                  id: "journeys",
                  key: "journeys",
                  icon: Layers,
                  run: () => {
                    setRail("journeys");
                    setLeftCollapsed(false);
                    if (narrow) setSheet("tools");
                  },
                },
                {
                  id: "library",
                  key: "library",
                  icon: Library,
                  run: () => {
                    setRail("library");
                    setLeftCollapsed(false);
                    if (narrow) setSheet("tools");
                  },
                },
                {
                  id: "definitions",
                  key: "definitions",
                  icon: SlidersHorizontal,
                  run: () => setDialog("definitions"),
                },
                {
                  id: "ai",
                  key: "ai",
                  icon: Sparkles,
                  run: () => setDialog("ai"),
                },
                {
                  id: "settings",
                  key: "settings",
                  icon: Settings,
                  run: () => setDialog("settings"),
                },
              ].map((a) => (
                <button
                  className="lb-rail__btn"
                  key={a.id}
                  aria-pressed={!leftCollapsed && rail === a.id}
                  aria-label={t(a.key as Key)}
                  onClick={a.run}
                >
                  <a.icon />
                  {a.id === "ai" ? "AI" : t(a.key as Key)}
                </button>
              ))}
              <div className="lb-rail__sep" />
              <button
                className="lb-rail__btn"
                aria-label={t(leftCollapsed ? "expandUI" : "toggleUI")}
                aria-expanded={!leftCollapsed}
                onClick={() => {
                  setLeftCollapsed((value) => !value);
                  if (narrow && leftCollapsed) setSheet("tools");
                }}
              >
                {leftCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                {t(leftCollapsed ? "expand" : "close")}
              </button>
            </nav>
            {j && !leftCollapsed ? (
              <ResponsivePanel
                narrow={narrow}
                open={sheet === "tools"}
                title={t(rail)}
                onClose={() => setSheet(null)}
              >
                <aside
                  className="lb-island lb-leftpanel lb-left-position"
                  aria-label="Journeys and layers"
                >
                  {rail === "library" ? (
                    <>
                      <div className="lb-section">
                        <div className="lb-section__head">{t("library")}</div>
                        <div className="lb-library-grid">
                          {toolSpec.slice(2).map((a) => (
                            <button
                              key={a.id}
                              className="lb-library-item"
                              disabled={j.readOnly}
                              onClick={() => place(a.id)}
                            >
                              <a.icon size={18} />
                              {t(a.label)}
                              <kbd className="lb-kbd">{a.key}</kbd>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="lb-section">
                        <div className="lb-section__head">{t("structure")}</div>
                        <button
                          className="lb-menu__item"
                          onClick={addLane}
                          disabled={j.readOnly}
                        >
                          <Plus size={14} />
                          {t("addLane")}
                        </button>
                        <button
                          className="lb-menu__item"
                          onClick={addPhase}
                          disabled={j.readOnly}
                        >
                          <Plus size={14} />
                          {t("addPhase")}
                        </button>
                        <button
                          className="lb-menu__item"
                          onClick={addGroup}
                          disabled={j.readOnly}
                        >
                          <Plus size={14} />
                          {t("addGroup")}
                        </button>
                      </div>
                      <div className="lb-section">
                        <div className="lb-section__head">{t("templates")}</div>
                        <button
                          className="lb-menu__item"
                          onClick={() => s.newJourney("bank")}
                        >
                          {t("startBank")}
                        </button>
                        <button
                          className="lb-menu__item"
                          onClick={() => s.newJourney("blank")}
                        >
                          {t("startBlank")}
                        </button>
                        <button
                          className="lb-menu__item"
                          onClick={() => loadExample("mortgage")}
                        >
                          {t("loadMortgage")}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="lb-section">
                        <div className="lb-section__head">
                          {t("journeys")}
                          <button
                            className="lb-iconbtn"
                            aria-label={t("newJourney")}
                            onClick={() => setDialog("new")}
                          >
                            <Plus />
                          </button>
                        </div>
                        <div
                          className="lb-tree"
                          role="list"
                          aria-label={t("journeys")}
                        >
                          {s.workspace.journeys.map((x) => (
                            <div
                              className="lb-tree__row lb-journey-row"
                              key={x.id}
                              role="listitem"
                              data-selected={x.id === j.id}
                            >
                              <button
                                className="lb-tree__label lb-tree-button"
                                title={x.title}
                                onClick={() => {
                                  setUI((ui) => {
                                    ui.selectedJourney = x.id;
                                    delete ui.viewport;
                                  });
                                  s.select({ kind: "journey", id: x.id });
                                  if (narrow) setSheet("details");
                                }}
                              >
                                {x.title}
                              </button>
                              {x.readOnly ? <Lock size={12} /> : null}
                              <Menu.Root>
                                <Menu.Trigger
                                  className="lb-iconbtn"
                                  aria-label={`Actions for ${x.title}`}
                                >
                                  <MoreHorizontal />
                                </Menu.Trigger>
                                <Menu.Portal>
                                  <Menu.Content className="lb-popover lb-menu">
                                    <Menu.Item
                                      className="lb-menu__item"
                                      onSelect={() => {
                                        setUI((ui) => {
                                          ui.selectedJourney = x.id;
                                        });
                                        s.duplicateJourney();
                                      }}
                                    >
                                      Duplicate
                                    </Menu.Item>
                                    <Menu.Item
                                      className="lb-menu__item"
                                      disabled={x.readOnly}
                                      onSelect={() => {
                                        setUI((ui) => {
                                          ui.selectedJourney = x.id;
                                        });
                                        s.select({ kind: "journey", id: x.id });
                                      }}
                                    >
                                      Rename
                                    </Menu.Item>
                                    <Menu.Item
                                      className="lb-menu__item lb-danger-text"
                                      onSelect={() =>
                                        confirm(
                                          `${t("delete")} “${x.title}”`,
                                          () =>
                                            s.edit((w) => {
                                              w.journeys = w.journeys.filter(
                                                (j) => j.id !== x.id,
                                              );
                                              if (w.ui.selectedJourney === x.id)
                                                w.ui.selectedJourney =
                                                  w.journeys[0]?.id || "";
                                            }),
                                        )
                                      }
                                    >
                                      {t("delete")}
                                    </Menu.Item>
                                  </Menu.Content>
                                </Menu.Portal>
                              </Menu.Root>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="lb-section lb-section--grow">
                        <div className="lb-section__head">
                          {t("lanes")}
                          <div className="lb-section__actions">
                            <button
                              className="lb-iconbtn"
                              disabled={j.readOnly}
                              aria-label={t("addGroup")}
                              onClick={addGroup}
                            >
                              <Layers />
                            </button>
                            <button
                              className="lb-iconbtn"
                              disabled={j.readOnly}
                              aria-label={t("addLane")}
                              onClick={addLane}
                            >
                              <Plus />
                            </button>
                          </div>
                        </div>
                        <div className="lb-tree">
                          {[null, ...j.laneGroups.map((g) => g.id)].map(
                            (group) => (
                              <div key={group || "ungrouped"}>
                                {group ? (
                                  <div
                                    className="lb-tree__row"
                                    data-expanded={
                                      !s.workspace.ui.collapsedGroups.includes(
                                        group,
                                      )
                                    }
                                  >
                                    <button
                                      className="lb-tree-button lb-tree-group-button"
                                      onClick={() => toggleGroup(group)}
                                    >
                                      <ChevronDown className="lb-tree__caret" />
                                      <span className="lb-tree__group">
                                        {
                                          j.laneGroups.find(
                                            (g) => g.id === group,
                                          )?.name
                                        }
                                      </span>
                                    </button>
                                    <AddLaneButton
                                      key={j.id}
                                      journey={j}
                                      group={group}
                                      reveal={revealLane}
                                    />
                                    <button
                                      className="lb-iconbtn"
                                      aria-label={`Edit group ${group}`}
                                      onClick={() =>
                                        s.select({ kind: "group", id: group })
                                      }
                                    >
                                      <MoreHorizontal />
                                    </button>
                                  </div>
                                ) : null}
                                {!s.workspace.ui.collapsedGroups.includes(
                                  group || "",
                                )
                                  ? j.lanes
                                      .filter((l) => l.group === group)
                                      .map((l) => (
                                        <div
                                          key={l.id}
                                          className="lb-tree__row"
                                          style={
                                            {
                                              "--depth": group ? 1 : 0,
                                            } as CSSProperties
                                          }
                                          data-hidden={l.hidden}
                                          draggable={!j.readOnly}
                                          onDragStart={() => {
                                            dragId.current = l.id;
                                          }}
                                          onDragOver={(e) => e.preventDefault()}
                                          onDrop={() =>
                                            s.editJourney((j) => {
                                              const moved = j.lanes.find(
                                                (x) => x.id === dragId.current,
                                              );
                                              if (moved) moved.group = l.group;
                                              reorder(
                                                j.lanes,
                                                j.lanes.findIndex(
                                                  (x) =>
                                                    x.id === dragId.current,
                                                ),
                                                j.lanes.findIndex(
                                                  (x) => x.id === l.id,
                                                ),
                                              );
                                            })
                                          }
                                        >
                                          <span
                                            className="lb-tree__swatch"
                                            style={
                                              {
                                                "--tint": `var(--tint-${l.tint || l.group || l.kind})`,
                                              } as CSSProperties
                                            }
                                          />
                                          <button
                                            className="lb-tree__label lb-tree-button"
                                            onClick={() =>
                                              s.select({
                                                kind: "lane",
                                                id: l.id,
                                              })
                                            }
                                          >
                                            {l.name}
                                          </button>
                                          <div className="lb-tree__toggles">
                                            <button
                                              className="lb-iconbtn"
                                              aria-label={`${l.hidden ? t("show") : t("hide")} ${l.name}`}
                                              disabled={j.readOnly}
                                              onClick={() =>
                                                s.editJourney((j) => {
                                                  const x = j.lanes.find(
                                                    (x) => x.id === l.id,
                                                  )!;
                                                  x.hidden = !x.hidden;
                                                })
                                              }
                                            >
                                              {l.hidden ? <EyeOff /> : <Eye />}
                                            </button>
                                            <button
                                              className="lb-iconbtn"
                                              aria-label={`${t("locked")} ${l.name}`}
                                              disabled={j.readOnly}
                                              onClick={() =>
                                                s.editJourney((j) => {
                                                  const x = j.lanes.find(
                                                    (x) => x.id === l.id,
                                                  )!;
                                                  x.locked = !x.locked;
                                                })
                                              }
                                            >
                                              <Lock />
                                            </button>
                                          </div>
                                        </div>
                                      ))
                                  : null}
                              </div>
                            ),
                          )}
                        </div>
                        <div className="lb-section__head">
                          {t("phases")}
                          <button
                            className="lb-iconbtn"
                            disabled={j.readOnly}
                            aria-label={t("addPhase")}
                            onClick={addPhase}
                          >
                            <Plus />
                          </button>
                        </div>
                        {j.phases.map((p, i) => (
                          <div
                            className="lb-tree__row"
                            key={p.id}
                            draggable={!j.readOnly}
                            onDragStart={() => {
                              dragId.current = p.id;
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() =>
                              s.editJourney((j) =>
                                reorderPhase(
                                  j,
                                  j.phases.findIndex(
                                    (x) => x.id === dragId.current,
                                  ),
                                  i,
                                ),
                              )
                            }
                          >
                            <span className="lb-tree__meta">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <button
                              className="lb-tree__label lb-tree-button"
                              onClick={() =>
                                s.select({ kind: "phase", id: p.id })
                              }
                            >
                              {p.name}
                            </button>
                            <GripVertical size={12} />
                          </div>
                        ))}
                      </div>
                      <div className="lb-section">
                        <button
                          className="lb-btn lb-btn--ghost"
                          onClick={() => {
                            setDrawer("services");
                            setView("data");
                            setSheet(null);
                          }}
                        >
                          <Table2 size={15} />
                          {t("viewData")}
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </aside>
              </ResponsivePanel>
            ) : null}
            {j && s.selection && s.selection.kind !== "connection" ? (
              <ResponsivePanel
                narrow={narrow}
                open={sheet === "details"}
                title={t("editDetails")}
                onClose={() => setSheet(null)}
              >
                <Inspector
                  confirm={confirm}
                  ownerFilter={owner}
                  onOwnerFilter={setOwner}
                />
              </ResponsivePanel>
            ) : null}
          </>
        ) : null}
        {j && present === null && view === "canvas" ? (
          <>
            <Panel position="bottom-center" className="lb-island lb-dock">
              {(editorMode === "map" ? toolSpec : sketchSpec).map((a) => (
                <button
                  key={a.id}
                  className="lb-tool"
                  title={`${t(a.label)} (${a.key})`}
                  aria-label={`${t(a.label)} tool`}
                  aria-pressed={tool === a.id}
                  onClick={() => setTool(a.id)}
                >
                  <a.icon />
                  <span className="lb-tool__key">{a.key}</span>
                </button>
              ))}
              <button
                className="lb-tool"
                aria-label={t("keepTool")}
                title={t("keepTool")}
                aria-pressed={keepTool}
                onClick={() => setKeepTool((v) => !v)}
              >
                <Pin size={16} />
                <span className="lb-tool__key">Q</span>
              </button>
              <span className="lb-dock__sep" />
              <div className="lb-modes">
                <button
                  aria-pressed={editorMode === "map"}
                  onClick={() => {
                    setEditorMode("map");
                    setTool("select");
                  }}
                >
                  {t("map")}
                </button>
                <button
                  aria-pressed={editorMode === "sketch"}
                  onClick={() => {
                    setEditorMode("sketch");
                    setTool("select");
                  }}
                >
                  {t("sketch")}
                </button>
              </div>
            </Panel>
          </>
        ) : null}
        {j && present === null && view === "canvas" ? (
          <>
            <Panel position="bottom-left" className="lb-island lb-zoombar">
              <button
                className="lb-tool"
                aria-label={t("zoomOut")}
                onClick={() => void flow.zoomOut()}
              >
                <Minus />
              </button>
              <button
                className="lb-zoombar__value lb-tree-button"
                onClick={fit}
              >
                {Math.round(viewport.zoom * 100)}%
              </button>
              <button
                className="lb-tool"
                aria-label={t("zoomIn")}
                onClick={() => void flow.zoomIn()}
              >
                <Plus />
              </button>
              <button className="lb-tool" aria-label={t("fit")} onClick={fit}>
                <Maximize />
              </button>
              <span className="lb-dock__sep" />
              <button
                className="lb-tool"
                aria-label={t("undo")}
                onClick={() => useStore.temporal.getState().undo()}
              >
                <Undo2 />
              </button>
              <button
                className="lb-tool"
                aria-label={t("redo")}
                onClick={() => useStore.temporal.getState().redo()}
              >
                <Redo2 />
              </button>
            </Panel>
            <Panel position="bottom-right">
              <button
                className="lb-btn lb-roundbtn lb-island"
                aria-label={t("help")}
                onClick={() => setDialog("help")}
              >
                <HelpCircle size={18} />
              </button>
            </Panel>
            <MiniMap
              position="bottom-right"
              className="lb-minimap"
              pannable
              zoomable
              nodeColor={(n) =>
                n.type === "card" ? "var(--accent)" : "var(--bg-muted)"
              }
              nodeStrokeColor="var(--border)"
            />
          </>
        ) : null}
        {present !== null && slide ? (
          <Panel
            position="bottom-center"
            className="lb-island lb-guide"
            ref={guideRef}
          >
            <span className="lb-guide__step">
              {present + 1} / {sequence.length}
            </span>
            <div>
              <div className="lb-guide__title">{slide.title}</div>
              <p className="lb-guide__text">{slide.text}</p>
            </div>
            <div className="lb-dialog-actions">
              <button
                className="lb-btn lb-btn--icon"
                disabled={present === 0}
                aria-label={t("previousSlide")}
                onClick={() => setPresent((p) => Math.max(0, (p || 0) - 1))}
              >
                <ChevronLeft />
              </button>
              <button
                className="lb-btn lb-btn--icon"
                disabled={present === sequence.length - 1}
                aria-label={t("nextSlide")}
                onClick={() =>
                  setPresent((p) => Math.min(sequence.length - 1, (p || 0) + 1))
                }
              >
                <ChevronRight />
              </button>
              <button className="lb-btn" onClick={finishPresent}>
                {t("exitPresent")}
              </button>
            </div>
          </Panel>
        ) : null}
      </ReactFlow>
      {j && view === "overview" && present === null ? (
        <Overview onSelect={select} onEdit={() => setDialog("setup")} />
      ) : null}
      {!j ? (
        <div className="lb-welcome">
          <div className="lb-welcome__center">
            <div className="lb-welcome__mark">
              <div className="lb-welcome-symbol">
                <Layers size={30} />
              </div>
              Laneboard
            </div>
            <h1>{t("welcome")}</h1>
            <p className="lb-welcome-description">{t("welcomeText")}</p>
            <div className="lb-welcome__menu">
              <button
                className="lb-welcome__item lb-welcome-primary"
                onClick={() => loadExample("investing")}
              >
                <Route size={18} />
                {t("loadExample")}
                <span className="lb-menu__shortcut">Business</span>
              </button>
              <button
                className="lb-welcome__item"
                onClick={() => loadExample("mortgage")}
              >
                <Route size={18} />
                {t("loadMortgage")}
                <span className="lb-menu__shortcut">Private</span>
              </button>
              <button
                className="lb-welcome__item"
                onClick={() => s.newJourney("bank")}
              >
                <Plus size={18} />
                {t("startBank")}
              </button>
              <button className="lb-welcome__item" onClick={openLaneboard}>
                <FileText size={18} />
                {t("openFile")}
                <span className="lb-menu__shortcut">Ctrl O</span>
              </button>
              <button
                className="lb-welcome__item"
                onClick={() => setDialog("import")}
              >
                <Upload size={18} />
                {t("import")}
              </button>
              <button
                className="lb-welcome__item"
                onClick={() => setDialog("ai")}
              >
                <Sparkles size={18} />
                {t("ai")}
              </button>
            </div>
            <div className="lb-local-notice">
              <ShieldCheck size={16} />
              <p>{t("localNotice")}</p>
            </div>
            <p className="lb-field__hint">{t("noCustomer")}</p>
            <span className="lb-welcome__notice">
              Start with an example. Make it your own.
            </span>
          </div>
          <span className="lb-hint lb-welcome-hint">
            A whole journey, beyond one channel
          </span>
        </div>
      ) : null}
      {j && present === null && view === "data" ? (
        <Drawer
          fullPage
          tab={drawer || "steps"}
          setTab={setDrawer}
          onClose={() => setView("canvas")}
          onSelect={select}
        />
      ) : null}
      {backupAge > 14 * 86400000 && j && present === null ? (
        <div className="lb-backup-reminder lb-island">
          <span>{t("backupDue")}</span>
          <button
            className="lb-btn lb-btn--sm"
            onClick={() => exportJSON(true)}
          >
            {t("backup")}
          </button>
        </div>
      ) : null}
      {toast ? (
        <div className="lb-toast" role="status">
          <Check size={14} />
          {toast}
        </div>
      ) : null}
      {picker ? (
        <Modal title={t("placeCard")} onClose={() => setPicker(null)}>
          <div className="lb-picker">
            {toolSpec.slice(2).map((a) => (
              <button key={a.id} onClick={() => place(a.id, picker)}>
                <a.icon size={20} />
                {t(a.label)}
              </button>
            ))}
          </div>
          <p className="lb-field__hint">
            {j?.lanes.find((l) => l.id === picker.lane)?.name} ·{" "}
            {j?.phases.find((p) => p.id === picker.phase)?.name}
          </p>
        </Modal>
      ) : null}
      {dialog === "setup" ? (
        <JourneySetup key={j?.id} onClose={closeDialog} />
      ) : null}
      {dialog === "target" && j ? (
        <Modal
          title={t("comparison")}
          onClose={() => {
            if (targetState(j) === "not-started") s.setMode("now");
            closeDialog();
          }}
        >
          <TargetReview j={j} />
        </Modal>
      ) : null}
      {dialog === "import" ? (
        <ImportDialog
          initial={importRaw}
          onClose={closeDialog}
          notify={notify}
        />
      ) : null}
      {dialog === "export" ? (
        <ExportDialog onClose={closeDialog} notify={notify} />
      ) : null}
      {dialog === "ai" ? (
        <AIDialog onClose={closeDialog} notify={notify} />
      ) : null}
      {dialog === "settings" ? (
        <SettingsDialog
          onClose={closeDialog}
          onClear={() => confirm(t("clearWorkspace"), clearWorkspace)}
        />
      ) : null}
      {dialog === "definitions" ? (
        <DefinitionsDialog onClose={closeDialog} />
      ) : null}
      {dialog === "new" ? (
        <NewDialog
          onClose={closeDialog}
          onExample={() => loadExample("investing")}
        />
      ) : null}
      {dialog === "help" ? <HelpDialog onClose={closeDialog} /> : null}
      {dialog === "confirm" && confirmAction ? (
        <ConfirmDialog
          title={confirmAction.title}
          description={confirmAction.description}
          confirmLabel={confirmAction.confirmLabel}
          onClose={closeDialog}
          onConfirm={confirmAction.run}
        />
      ) : null}
      {dialog === "palette" ? (
        <Palette actions={actions} onClose={closeDialog} />
      ) : null}
    </main>
  );
}
