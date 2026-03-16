import { useCallback, useEffect, useState } from 'react';
import { useDebounce } from './hooks';
import { runPipeline, runTool, healthCheck, type PipelineResult, type BridgeResponse } from './bridge-client';
import { IntentInput } from './components/IntentInput';
import { Selectors } from './components/Selectors';
import { PreviewPanel } from './components/PreviewPanel';
import { CodePanel } from './components/CodePanel';
import { StatusBar } from './components/StatusBar';
import { StarterPrompts } from './components/StarterPrompts';

type Framework = 'react' | 'vue' | 'html';
type Styling = 'inline' | 'tokens' | 'tailwind';
type Brand = 'default' | 'A' | 'B';

export default function App() {
  const [intent, setIntent] = useState('');
  const [framework, setFramework] = useState<Framework>('react');
  const [styling, setStyling] = useState<Styling>('tokens');
  const [brand, setBrand] = useState<Brand>('default');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);

  const debouncedIntent = useDebounce(intent, 400);

  useEffect(() => {
    healthCheck().then((h) => setBridgeOk(h.ok));
  }, []);

  const run = useCallback(async () => {
    if (!debouncedIntent.trim()) return;
    setLoading(true);
    setError(null);

    const resp: BridgeResponse<PipelineResult> = await runPipeline({
      intent: debouncedIntent,
      framework,
      styling,
      options: { compact: false, showConfidence: true, confidenceThreshold: 0.5 },
    });

    setLoading(false);

    if ('error' in resp && resp.error) {
      setError(resp.error.message);
      setResult(null);
    } else if ('ok' in resp && resp.ok && resp.result) {
      if (resp.result.error) {
        setError(`[${resp.result.error.step}] ${resp.result.error.message}`);
      }
      setResult(resp.result);
    }
  }, [debouncedIntent, framework, styling]);

  useEffect(() => {
    if (debouncedIntent.trim()) {
      run();
    }
  }, [debouncedIntent, run]);

  const handleStarterSelect = useCallback((starterIntent: string) => {
    setIntent(starterIntent);
  }, []);

  const handleSaveSchema = useCallback(async () => {
    if (!result?.schemaRef) return;
    const name = `playground-${Date.now()}`;
    const resp = await runTool('schema_save', {
      name,
      schemaRef: result.schemaRef,
    });
    if ('ok' in resp && resp.ok) {
      setError(null);
    } else if ('error' in resp && resp.error) {
      setError(resp.error.message);
    }
  }, [result?.schemaRef]);

  const handleDownloadHtml = useCallback(() => {
    const html = result?.render?.html;
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oods-preview.html';
    a.click();
    URL.revokeObjectURL(url);
  }, [result?.render?.html]);

  return (
    <div className="flex flex-col h-screen bg-[#0f1117] text-gray-200">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-white">OODS Playground</h1>
          <span className="text-xs text-gray-500 font-mono">v0.1</span>
        </div>
        <div className="flex items-center gap-3">
          {result?.render?.html && (
            <button
              onClick={handleDownloadHtml}
              className="text-xs px-2.5 py-1 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              Download HTML
            </button>
          )}
          {result?.schemaRef && (
            <button
              onClick={handleSaveSchema}
              className="text-xs px-2.5 py-1 rounded border border-indigo-600 text-indigo-300 hover:bg-indigo-600/20 transition-colors"
            >
              Save Schema
            </button>
          )}
          <Selectors
            framework={framework}
            styling={styling}
            brand={brand}
            theme={theme}
            onFrameworkChange={setFramework}
            onStylingChange={setStyling}
            onBrandChange={setBrand}
            onThemeChange={setTheme}
          />
        </div>
      </header>

      {/* Intent input + starters */}
      <div className="px-5 py-3 border-b border-gray-800 shrink-0 space-y-2">
        <IntentInput value={intent} onChange={setIntent} loading={loading} />
        <StarterPrompts onSelect={handleStarterSelect} />
      </div>

      {/* Main content: preview + code side by side */}
      <div className="flex flex-1 min-h-0">
        <PreviewPanel
          html={result?.render?.html ?? null}
          theme={theme}
          loading={loading}
        />
        <CodePanel
          code={result?.code?.output ?? null}
          framework={result?.code?.framework ?? framework}
          loading={loading}
        />
      </div>

      {/* Status bar */}
      <StatusBar
        bridgeOk={bridgeOk}
        loading={loading}
        error={error}
        metrics={result?.metrics ?? null}
        pipeline={result?.pipeline ?? null}
        summary={result?.summary ?? null}
      />
    </div>
  );
}
