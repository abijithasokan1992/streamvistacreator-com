/**
 * Device Scanner
 * ==============
 * Browser-side walker that turns a mounted camera card / SSD / HDD into a
 * flat list of media files plus a guess at which camera family produced
 * them. Uses the File System Access API when available, falls back to
 * `<input webkitdirectory>` otherwise.
 *
 * All reads are read-only — the source directory handle is never used in
 * write mode, so original camera files cannot be modified.
 */

export type ScannedFile = {
  file: File;
  relativePath: string; // full path relative to picked root
  subpath: string;      // directory only
};

export type CameraFamily =
  | "arri"
  | "red"
  | "blackmagic"
  | "canon"
  | "sony"
  | "panasonic"
  | "phantom"
  | "dslr_mirrorless"
  | "generic";

export type ScanResult = {
  rootLabel: string;
  files: ScannedFile[];
  totalBytes: number;
  topLevelFolders: string[];
  cameraFamily: CameraFamily;
  cameraFamilyLabel: string;
  mediaFormats: string[];
};

// Files we skip regardless of selection — OS metadata, thumbnails, trash.
// Everything else (any extension, or no extension at all) is ingested so
// that Ctrl+A on the picker really does grab every file in the folder.
const SKIP_NAME_RE = /^(\.DS_Store|Thumbs\.db|desktop\.ini|\._.*)$/i;
const SKIP_DIR_RE = /(^|\/)(\.Trashes|\.Spotlight-V100|\.fseventsd|System Volume Information|\$RECYCLE\.BIN)(\/|$)/i;
function isIngestable(name: string, relPath: string): boolean {
  if (SKIP_NAME_RE.test(name)) return false;
  if (SKIP_DIR_RE.test(relPath)) return false;
  return true;
}

const FAMILY_SIGNATURES: Array<{ family: CameraFamily; label: string; test: (p: string) => boolean }> = [
  { family: "arri", label: "ARRI", test: (p) => /(^|\/)a\d{3}[a-z]?_.*\.(ari|arx|mxf)$/i.test(p) || /(^|\/)Alexa/i.test(p) },
  { family: "red", label: "RED", test: (p) => /\.r3d$/i.test(p) || /(^|\/)[A-F0-9]{3,}_[A-F0-9]{3,}/i.test(p) },
  { family: "blackmagic", label: "Blackmagic", test: (p) => /\.braw$/i.test(p) },
  { family: "canon", label: "Canon Cinema", test: (p) => /\.crm$/i.test(p) || /(^|\/)PRIVATE\/M4ROOT/i.test(p) === false && /(^|\/)DCIM\/(\d+CANON|.*EOS)/i.test(p) },
  { family: "sony", label: "Sony", test: (p) => /(^|\/)PRIVATE\/M4ROOT/i.test(p) || /(^|\/)XDROOT/i.test(p) },
  { family: "panasonic", label: "Panasonic", test: (p) => /(^|\/)PRIVATE\/AVCHD/i.test(p) || /(^|\/)CONTENTS\/CLIP/i.test(p) },
  { family: "phantom", label: "Phantom", test: (p) => /\.cine$/i.test(p) || /Phantom/i.test(p) },
  { family: "dslr_mirrorless", label: "DSLR / Mirrorless", test: (p) => /(^|\/)DCIM\//i.test(p) },
];

function detectCameraFamily(paths: string[]): { family: CameraFamily; label: string } {
  for (const sig of FAMILY_SIGNATURES) {
    if (paths.some((p) => sig.test(p))) return { family: sig.family, label: sig.label };
  }
  return { family: "generic", label: "Generic media" };
}

function extractFormats(files: ScannedFile[]): string[] {
  const set = new Set<string>();
  for (const f of files) {
    const m = f.file.name.match(/\.([a-z0-9]+)$/i);
    if (m) set.add(m[1].toUpperCase());
  }
  return Array.from(set).sort();
}

async function walkHandle(
  dirHandle: FileSystemDirectoryHandle,
  prefix: string,
  acc: ScannedFile[],
): Promise<void> {
  const iter = (dirHandle as unknown as { values: () => AsyncIterableIterator<FileSystemHandle> }).values();
  for await (const entry of iter) {
    if (entry.kind === "file") {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (!isIngestable(entry.name, rel)) continue;
      const fileHandle = entry as FileSystemFileHandle;
      const file = await fileHandle.getFile();
      acc.push({ file, relativePath: rel, subpath: prefix });
    } else if (entry.kind === "directory") {
      await walkHandle(entry as FileSystemDirectoryHandle, prefix ? `${prefix}/${entry.name}` : entry.name, acc);
    }
  }
}

export async function scanDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<ScanResult> {
  const files: ScannedFile[] = [];
  await walkHandle(handle, "", files);
  return summarize(handle.name, files);
}

export function scanFileList(list: FileList): ScanResult {
  const files: ScannedFile[] = [];
  let rootLabel = "External media";
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    const rel: string = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    if (!isIngestable(f.name, rel)) continue;
    const parts = rel.split("/");
    if (parts.length > 1 && rootLabel === "External media") rootLabel = parts[0];
    files.push({
      file: f,
      relativePath: rel,
      subpath: parts.slice(0, -1).join("/"),
    });
  }
  return summarize(rootLabel, files);
}

function summarize(rootLabel: string, files: ScannedFile[]): ScanResult {
  const topLevelFolders = Array.from(
    new Set(files.map((f) => f.relativePath.split("/")[0]).filter(Boolean)),
  ).slice(0, 20);
  const totalBytes = files.reduce((s, f) => s + f.file.size, 0);
  const { family, label } = detectCameraFamily(files.map((f) => f.relativePath));
  return {
    rootLabel,
    files,
    totalBytes,
    topLevelFolders,
    cameraFamily: family,
    cameraFamilyLabel: label,
    mediaFormats: extractFormats(files),
  };
}

export function supportsDirectoryPicker(): boolean {
  return typeof window !== "undefined" && typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
