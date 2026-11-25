"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import styles from "./DropArea.module.css";

/**
 * A dashed box to drop files on, saying so (`hint`), with a button that
 * opens the file picker instead (`choose`), pending while what was given is
 * on its way (`pending`). It lights up while a file is over it. `accept`
 * narrows the picker to kinds of file; `multiple` lets it take several.
 */
export default function DropArea({
  hint,
  choose,
  onFiles,
  pending = false,
  multiple = false,
  accept,
}: {
  hint: string;
  choose: string;
  onFiles: (files: File[]) => void;
  pending?: boolean;
  multiple?: boolean;
  accept?: string;
}) {
  const said = useId();
  const picker = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={styles.drop}
      data-over={over || undefined}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        onFiles([...event.dataTransfer.files]);
      }}
    >
      <span id={said}>{hint}</span>
      <Button
        variant="ghost"
        size="small"
        fit
        aria-describedby={said}
        pending={pending}
        onClick={() => picker.current!.click()}
      >
        {choose}
      </Button>
      <input
        ref={picker}
        type="file"
        multiple={multiple}
        accept={accept}
        hidden
        onChange={(event) => {
          const chosen = [...event.target.files!];
          event.target.value = "";
          onFiles(chosen);
        }}
      />
    </div>
  );
}
