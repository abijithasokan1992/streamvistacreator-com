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

// Extensions we care about, covering the requested professional formats.
const MEDIA_EXT_RE =
  /\.(ari|arx|r3d|braw|crm|dng|mov|mp4|mxf|m4v|avi|wav|aif|aiff|xml|xmp|cdl|3dl|cube|rmd|nfo|sidecar)$/i;

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
  // @ts-expect-error — .values() is standard but not yet in every TS lib.dom
  for await (const entry of dirHandle.values()) {
    if (entry.kind === "file") {
      if (!MEDIA_EXT_RE.test(entry.name)) continue;
      const file = await entry.getFile();
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
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
    // @ts-expect-error webkitRelativePath is present on directory-picked inputs.
    const rel: string = f.webkitRelativePath || f.name;
    if (!MEDIA_EXT_RE.test(f.name)) continue;
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
