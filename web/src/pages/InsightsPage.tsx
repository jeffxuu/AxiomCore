import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { toggleTheme } from '../store/uiSlice';
import { InsightCard } from '../components/InsightCard';
import { useT } from '../lib/i18nConfig';

export const InsightsPage: React.FC = () => {
  const t = useT();
  const dispatch = useDispatch();
  const theme = useSelector((state: RootState) => state.ui.theme);
  const [hoveredData, setHoveredData] = useState<{ x: number; y: number; val: string } | null>(null);

  const mockMetrics = [
    { label: t('insights.governance.metric.net'), val: '1,482,904.52', unit: 'USD', change: '+2.41%' },
    { label: t('insights.governance.metric.audit'), val: '99.84', unit: '%', change: t('insights.governance.metric.stable') },
    { label: t('insights.governance.metric.velocity'), val: '4,209', unit: 'T/S', change: '-0.12%' },
  ];

  const mockLogs = [
    { id: '01', scope: 'NEXITALLY', status: 'SYS_OK', desc: t('insights.governance.log.01') },
    { id: '02', scope: 'SURGE_IOS', status: 'NET_ALIVE', desc: t('insights.governance.log.02') },
    { id: '03', scope: 'WPS_OFFICE', status: 'LIC_SYNC', desc: t('insights.governance.log.03') },
    { id: '04', scope: 'POE_API', status: 'QUOTA_OK', desc: t('insights.governance.log.04') },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-180 ease-in-out font-sans antialiased selection:bg-[var(--text)] selection:text-[var(--bg)]">
      <header className="w-full h-11 border-b border-[var(--border)] px-6 flex items-center justify-between bg-[var(--card)]">
        <div className="flex items-center space-x-3">
          <span className="text-[10px] uppercase tracking-wider font-semibold font-mono bg-[var(--text)] text-[var(--bg)] px-1.5 py-0.5">
            AXIOM CORE v3.0
          </span>
          <span className="text-xs font-normal opacity-40">/</span>
          <span className="text-xs font-normal opacity-60 tracking-tight">{t('insights.governance.status')}</span>
        </div>
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={() => dispatch(toggleTheme())}
            className="text-[10px] uppercase tracking-wider font-semibold opacity-70 hover:opacity-100 font-mono transition-opacity"
          >
            {t('insights.governance.theme', { mode: t(theme === 'dark' ? 'insights.governance.dark' : 'insights.governance.light') })}
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 flex flex-col lg:flex-row gap-6">
        {/* 左侧主干栏 (65% 空间拓扑) */}
        <section className="w-full lg:w-[65%] flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mockMetrics.map((m, idx) => (
              <InsightCard key={idx} badge={m.unit}>
                <div className="text-[10px] uppercase tracking-wider font-semibold opacity-50 font-mono mb-1">
                  {m.label}
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-light font-mono tnum tracking-tighter">
                    {m.val}
                  </span>
                </div>
                <div className="text-[10px] font-mono opacity-40 mt-1 flex items-center justify-between">
                  <span>{t('insights.governance.metric.descriptor')}</span>
                  <span className={m.change.startsWith('+') ? 'text-emerald-500' : 'opacity-60'}>{m.change}</span>
                </div>
              </InsightCard>
            ))}
          </div>

          <InsightCard title={t('insights.governance.chart')} badge={t('insights.governance.realtimeGraph')}>
            <div className="relative w-full h-64 mt-2">
              <svg className="w-full h-full overflow-visible">
                <line x1="0" y1="220" x2="100%" y2="220" stroke="currentColor" strokeWidth={0.5} strokeOpacity={0.2} />
                <line x1="0" y1="20" x2="0" y2="220" stroke="currentColor" strokeWidth={0.5} strokeOpacity={0.2} />
                <line x1="0" y1="120" x2="100%" y2="120" stroke="currentColor" strokeWidth={0.5} strokeOpacity={0.1} strokeDasharray="2 2" />

                <path
                  d="M 0 160 Q 150 60, 300 140 T 600 40 T 900 110"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={0.75}
                  strokeOpacity={0.8}
                  className="transition-all duration-300"
                />

                <circle
                  cx="300"
                  cy="140"
                  r="2.5"
                  className="fill-[var(--bg)] stroke-[var(--text)] cursor-pointer"
                  strokeWidth={1}
                  onMouseEnter={() => setHoveredData({ x: 300, y: 140, val: t('insights.governance.tooltip') })}
                  onMouseLeave={() => setHoveredData(null)}
                />
              </svg>

              {hoveredData && (
                <div
                  className="absolute bg-[var(--card)] border border-[var(--text)] px-3 py-1.5 shadow-none transition-opacity duration-150"
                  style={{ left: `${hoveredData.x + 10}px`, top: `${hoveredData.y - 20}px` }}
                >
                  <p className="text-[10px] font-mono uppercase tracking-wider font-semibold opacity-80">
                    {hoveredData.val}
                  </p>
                </div>
              )}
            </div>
          </InsightCard>

          <InsightCard title={t('insights.governance.register')} badge={t('insights.governance.live')}>
            <div className="overflow-x-auto mt-2">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-wider font-semibold opacity-50 font-mono">
                    <th className="pb-2 font-normal">{t('insights.governance.column.index')}</th>
                    <th className="pb-2 font-normal">{t('insights.governance.column.node')}</th>
                    <th className="pb-2 font-normal">{t('insights.governance.column.code')}</th>
                    <th className="pb-2 font-normal text-right">{t('insights.governance.column.latency')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] font-mono text-xs text-[var(--text)] opacity-90">
                  <tr className="hover:bg-[var(--border)] hover:bg-opacity-20 transition-colors">
                    <td className="py-2.5 font-light">#092A</td>
                    <td className="py-2.5">FastAPI_Tencent_Cloud</td>
                    <td className="py-2.5 text-emerald-500">{"{\"ok\":true}"}</td>
                    <td className="py-2.5 text-right font-light tnum">12.04 ms</td>
                  </tr>
                  <tr className="hover:bg-[var(--border)] hover:bg-opacity-20 transition-colors">
                    <td className="py-2.5 font-light">#092B</td>
                    <td className="py-2.5">SQLite_Embedded_DB</td>
                    <td className="py-2.5 text-blue-400">SQLITE_OK</td>
                    <td className="py-2.5 text-right font-light tnum">0.45 ms</td>
                  </tr>
                  <tr className="hover:bg-[var(--border)] hover:bg-opacity-20 transition-colors">
                    <td className="py-2.5 font-light">#092C</td>
                    <td className="py-2.5">Gateway_4SAPI_Router</td>
                    <td className="py-2.5 opacity-60">FP_MATCHED</td>
                    <td className="py-2.5 text-right font-light tnum">31.89 ms</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </InsightCard>
        </section>

        {/* 右侧审计栏 (35% 空间拓扑) */}
        <section className="w-full lg:w-[35%] flex flex-col gap-6">
          <InsightCard title={t('insights.governance.audit')} badge={t('insights.governance.realtime')}>
            <div className="space-y-4 mt-2">
              <div>
                <div className="flex justify-between text-[11px] mb-1 font-mono opacity-70">
                  <span>{t('insights.governance.integrity')}</span>
                  <span className="font-light tnum">{t('insights.governance.secure')}</span>
                </div>
                <div className="w-full bg-[var(--border)] h-[2px]">
                  <div className="bg-[var(--text)] h-[2px] w-full transition-all duration-500" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1 font-mono opacity-70">
                  <span>{t('insights.governance.isolation')}</span>
                  <span className="font-light tnum">{t('insights.governance.active')}</span>
                </div>
                <div className="w-full bg-[var(--border)] h-[2px]">
                  <div className="bg-[var(--text)] h-[2px] w-[84%] transition-all duration-500" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1 font-mono opacity-70">
                  <span>{t('insights.governance.sync')}</span>
                  <span className="font-light tnum">{t('insights.governance.hold')}</span>
                </div>
                <div className="w-full bg-[var(--border)] h-[2px]">
                  <div className="bg-[var(--text)] h-[2px] w-[92%] transition-all duration-500" />
                </div>
              </div>
            </div>
          </InsightCard>

          <InsightCard title={t('insights.governance.journal.title')} badge={t('insights.governance.journal.badge')}>
            <div className="space-y-3 font-mono text-[11.5px] mt-2">
              {mockLogs.map((log) => (
                <div key={log.id} className="flex items-start space-x-2.5 border-b border-[var(--border)] pb-2 last:border-none last:pb-0">
                  <span className="opacity-30 select-none">{log.id}</span>
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[10px] tracking-wider opacity-85">
                        {log.scope}
                      </span>
                      <span className="text-[9px] px-1 bg-[var(--border)] opacity-70 scale-90 origin-right">
                        {log.status}
                      </span>
                    </div>
                    <p className="opacity-60 leading-normal text-xs font-sans">
                      {log.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </InsightCard>
        </section>
      </main>
    </div>
  );
};
