import { open } from "@tauri-apps/plugin-shell";
import { getAppVersion } from "./ipc";

const LATEST_RELEASE_URL =
  "https://api.github.com/repos/CarryDream/PyPDFSeal/releases?per_page=10";

const RELEASES_PAGE_URL = "https://github.com/CarryDream/PyPDFSeal/releases";

interface GitHubRelease {
  tag_name?: string;
  html_url?: string;
  draft?: boolean;
}

export interface UpdateCheckResult {
  current_version: string;
  latest_version: string;
  update_available: boolean;
  release_url: string;
}

function normalizeVersion(version: string) {
  return version.trim().replace(/^v/i, "");
}

function compareVersions(a: string, b: string) {
  const left = normalizeVersion(a).split(".").map(versionPartToNumber);
  const right = normalizeVersion(b).split(".").map(versionPartToNumber);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

function versionPartToNumber(part: string) {
  const match = part.match(/^\d+/);
  return match ? Number(match[0]) : 0;
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = await getAppVersion();
  const response = await fetch(LATEST_RELEASE_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });

  if (!response.ok) {
    throw new Error(`GitHub releases request failed: ${response.status}`);
  }

  const releases = (await response.json()) as GitHubRelease[];
  const release = releases.find((item) => !item.draft);

  if (!release) {
    return {
      current_version: currentVersion,
      latest_version: "",
      update_available: false,
      release_url: RELEASES_PAGE_URL,
    };
  }

  const latestVersion = release.tag_name ?? "";
  const releaseUrl = release.html_url ?? RELEASES_PAGE_URL;

  if (!latestVersion) {
    throw new Error("GitHub latest release has no tag_name");
  }

  return {
    current_version: currentVersion,
    latest_version: latestVersion,
    update_available: compareVersions(latestVersion, currentVersion) > 0,
    release_url: releaseUrl,
  };
}

export function openReleasePage(url: string) {
  return open(url || RELEASES_PAGE_URL);
}
