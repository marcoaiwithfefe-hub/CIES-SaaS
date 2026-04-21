import { readRecentLogs } from '@/lib/capture-log';

export const dynamic = 'force-dynamic';

export default async function LogsPage() {
  const entries = await readRecentLogs(200);

  return (
    <main
      className="min-h-screen p-6"
      style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}
    >
      <header className="mb-6">
        <h1 className="headline-section mb-1">Capture Log</h1>
        <p className="text-sm" style={{ color: 'var(--color-on-surface-var)' }}>
          Last 200 entries · read-only.{' '}
          Copy rows where <code className="font-mono">ok: false</code> and paste to Claude for diagnosis.
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-on-surface-var)' }}>
          No captures yet — run a capture to populate the log.
        </p>
      ) : (
        <div className="table-scroll">
          <table
            className="audit-table"
            aria-label="Capture log"
          >
            <thead>
              <tr>
                <th>Time</th>
                <th>Tool</th>
                <th>Query</th>
                <th>OK</th>
                <th>ms</th>
                <th>Stage</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i}>
                  <td
                    className="font-mono"
                    style={{ color: e.ok ? 'var(--color-on-surface)' : 'var(--color-error)' }}
                  >
                    {e.t.replace('T', ' ').slice(0, 19)}
                  </td>
                  <td style={{ color: 'var(--color-on-surface-var)' }}>{e.tool}</td>
                  <td
                    className="font-mono"
                    style={{ color: e.ok ? 'var(--color-on-surface)' : 'var(--color-error)' }}
                  >
                    {e.query}
                  </td>
                  <td
                    style={{
                      color: e.ok ? 'var(--color-primary)' : 'var(--color-error)',
                      fontWeight: 600,
                    }}
                  >
                    {e.ok ? '✓' : '✗'}
                  </td>
                  <td style={{ color: 'var(--color-on-surface-var)' }}>{e.ms}</td>
                  <td style={{ color: 'var(--color-on-surface-var)' }}>{e.stage ?? ''}</td>
                  <td
                    className="font-mono"
                    style={{
                      color: 'var(--color-error)',
                      maxWidth: '320px',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                    }}
                  >
                    {e.err ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
