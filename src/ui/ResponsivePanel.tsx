import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useT } from "../i18n";
export function ResponsivePanel({
  narrow,
  open,
  title,
  onClose,
  children,
}: {
  narrow: boolean;
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useT();
  if (!narrow) return <>{children}</>;
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="lb-scrim" />
        <Dialog.Content
          className="lb-tools-sheet"
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => e.stopPropagation()}
        >
          <div className="lb-sheet-header">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="lb-iconbtn" aria-label={t("close")}>
                <X />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
