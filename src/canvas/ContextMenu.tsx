import { useEffect, useMemo, useRef } from "react";
import * as Menu from "@radix-ui/react-menu";
import type { Selection } from "../store";
import { useT } from "../i18n";

export type ContextTarget = {
  selection: Selection | null;
  nodeId?: string;
  x: number;
  y: number;
  keyboard: boolean;
  focus: HTMLElement;
};
export type ContextCommand = {
  label: string;
  run: () => void;
  disabled?: boolean;
  destructive?: boolean;
  separator?: boolean;
  restoreFocus?: boolean;
};

export function CanvasContextMenu({
  target,
  title,
  hint,
  commands,
  close,
}: {
  target: ContextTarget;
  title: string;
  hint?: string;
  commands: ContextCommand[];
  close: () => void;
}) {
  const t = useT(),
    content = useRef<HTMLDivElement>(null),
    restoreFocus = useRef(true);
  const anchor = useMemo(
    () => ({
      current: {
        getBoundingClientRect: () => new DOMRect(target.x, target.y, 0, 0),
      },
    }),
    [target.x, target.y],
  );
  useEffect(() => {
    if (!target.keyboard) return;
    const frame = requestAnimationFrame(() =>
      content.current
        ?.querySelector<HTMLElement>('[role="menuitem"]:not([data-disabled])')
        ?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return (
    <Menu.Root open modal={false} onOpenChange={(open) => !open && close()}>
      <Menu.Anchor virtualRef={anchor} />
      <Menu.Portal>
        <Menu.Content
          ref={content}
          className="lb-popover lb-menu lb-context-menu"
          aria-label={`${t("contextCommands")} · ${title}`}
          side="right"
          align="start"
          collisionPadding={12}
          loop
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => e.stopPropagation()}
          onInteractOutside={() => {
            restoreFocus.current = false;
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (restoreFocus.current) {
              const element = target.focus.isConnected
                ? target.focus
                : document.querySelector<HTMLElement>(".lb-editor");
              element?.focus({ preventScroll: true });
            }
          }}
        >
          <Menu.Label className="lb-context-menu__title">{title}</Menu.Label>
          {hint ? <p className="lb-context-menu__hint">{hint}</p> : null}
          {commands.map((command, index) => (
            <Menu.Group key={`${index}-${command.label}`}>
              {command.separator ? (
                <Menu.Separator className="lb-menu__sep" />
              ) : null}
              <Menu.Item
                className="lb-menu__item"
                data-destructive={command.destructive || undefined}
                disabled={command.disabled}
                onSelect={() => {
                  restoreFocus.current = command.restoreFocus !== false;
                  command.run();
                }}
              >
                {command.label}
              </Menu.Item>
            </Menu.Group>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
