"use client";
import { useEffect, useState } from "react";

type DiagnosticsData = {
  paths: {
    cwd: string;
    DATA_DIR: string;
    DB_PATH: string;
    env_DATA_DIR: string | null;
    env_RAILWAY_VOLUME_MOUNT_PATH: string | null;
    data_dir_exists: boolean;
    db_file_exists: boolean;
    db_size_bytes: number;
    db_modified_at: string | null;
  };
  tables: Record<string, number>;
  meta: Record<string, string>;
  deployed_at: string;
};

export default function Diagnostics() {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/diagnostics", { cache: "no-store" });
    const json = await res.json();
    if (json.ok) setData(json);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (!data) return <p className="text-sm text-red-600">Could not load diagnostics.</p>;

  const usingExplicitDataDir = data.paths.env_DATA_DIR !== null;
  const usingRailwayVolume = data.paths.env_RAILWAY_VOLUME_MOUNT_PATH !== null;
  const persistenceLikelyOK = usingExplicitDataDir || usingRailwayVolume;

  const dbSizeKB = (data.paths.db_size_bytes / 1024).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Health status card */}
      <div className={`rounded-xl border p-5 ${persistenceLikelyOK ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
        <h2 className="font-semibold">{persistenceLikelyOK ? "✅ Persistence configured" : "⚠️ Persistence not explicitly configured"}</h2>
        <p className="text-sm mt-1">
          {persistenceLikelyOK
            ? "DATA_DIR or RAILWAY_VOLUME_MOUNT_PATH is set — the DB lives at a path Railway should be persisting."
            : "Neither DATA_DIR nor RAILWAY_VOLUME_MOUNT_PATH is set. The DB is at a default path which may not be on the persistent volume. Set DATA_DIR=/app/data in Railway env vars (and confirm your volume is mounted there)."}
        </p>
      </div>

      {/* DB file info */}
      <Block title="Database file">
        <Row label="Path"      value={data.paths.DB_PATH}             mono />
        <Row label="Exists"    value={data.paths.db_file_exists ? "yes" : "no"} />
        <Row label="Size"      value={`${dbSizeKB} KB`} />
        <Row label="Last modified" value={data.paths.db_modified_at ?? "—"} />
      </Block>

      {/* Path resolution */}
      <Block title="Path resolution">
        <Row label="Working dir"    value={data.paths.cwd}        mono />
        <Row label="DATA_DIR"       value={data.paths.DATA_DIR}   mono />
        <Row label="env DATA_DIR"   value={data.paths.env_DATA_DIR ?? "(not set)"} mono />
        <Row label="env RAILWAY_VOLUME_MOUNT_PATH" value={data.paths.env_RAILWAY_VOLUME_MOUNT_PATH ?? "(not set)"} mono />
      </Block>

      {/* Table counts */}
      <Block title="Row counts (refresh to see live values)">
        {Object.entries(data.tables).map(([t, n]) => (
          <Row key={t} label={t} value={String(n)} />
        ))}
      </Block>

      {/* Meta markers */}
      {Object.keys(data.meta).length > 0 && (
        <Block title="Seed markers">
          {Object.entries(data.meta).map(([k, v]) => (
            <Row key={k} label={k} value={v} mono />
          ))}
        </Block>
      )}

      <button
        onClick={load}
        className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50"
      >
        Refresh
      </button>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs text-slate-600 space-y-2">
        <h3 className="font-semibold text-sm text-slate-900">How to verify persistence</h3>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Note the <strong>DB Path</strong> and <strong>Size</strong> above.</li>
          <li>Add a card or user.</li>
          <li>Push any code change to GitHub. Wait for Railway to redeploy.</li>
          <li>Refresh this page. <strong>Size should be larger</strong> (or at least the same), and <strong>row counts must include your new entries</strong>.</li>
          <li>If the DB is "new" or counts dropped, the volume isn't persisting — check Railway → Service → Settings → Volumes that one is attached at the path shown above.</li>
        </ol>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h2 className="font-semibold text-slate-900 mb-3">{title}</h2>
      <div className="space-y-1.5 text-sm">{children}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-slate-500 w-44 flex-shrink-0">{label}</span>
      <span className={`text-slate-900 break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
