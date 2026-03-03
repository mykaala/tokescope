import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { ResponsiveContainer, AreaChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import './App.css';

const API_BASE = 'http://localhost:8000';

function formatUsdSmart(x) {
	if (x == null || Number.isNaN(Number(x))) return '$0.00';
	const n = Number(x);
	const abs = Math.abs(n);
	const decimals = abs >= 1 ? 2 : abs >= 0.1 ? 3 : abs >= 0.01 ? 4 : 6;
	return `$${n.toFixed(decimals)}`;
}

function formatUsdFixed6(x) {
	if (x == null || Number.isNaN(Number(x))) return '$0.000000';
	return `$${Number(x).toFixed(6)}`;
}

function formatMs(x) {
	if (x == null || Number.isNaN(Number(x))) return '0 ms';
	return `${Math.round(Number(x))} ms`;
}

function formatInt(x) {
	const n = Number(x || 0);
	return `${Math.round(n)}`;
}

function cx(...parts) {
	return parts.filter(Boolean).join(' ');
}

function normalizeProvider(p) {
	const s = String(p || 'unknown').toLowerCase();
	if (s.includes('openai')) return 'openai';
	if (s.includes('anthropic')) return 'anthropic';
	if (s.includes('ollama')) return 'ollama';
	return 'other';
}

function normalizeStatus(s) {
	const v = String(s || 'ok').toLowerCase();
	if (v.includes('err') || v.includes('fail')) return 'error';
	return 'ok';
}

function isSlowCall(latencyMs, thresholdMs = 1500) {
	const n = Number(latencyMs || 0);
	return n >= thresholdMs;
}

function useAnimatedNumber(value, { durationMs = 360 } = {}) {
	const [display, setDisplay] = useState(Number(value || 0));
	const rafRef = useRef(null);

	useEffect(() => {
		const from = display;
		const to = Number(value || 0);
		const start = performance.now();

		if (rafRef.current) cancelAnimationFrame(rafRef.current);

		const tick = (now) => {
			const t = Math.min(1, (now - start) / durationMs);
			const eased = 1 - Math.pow(1 - t, 3);
			const next = from + (to - from) * eased;
			setDisplay(next);
			if (t < 1) rafRef.current = requestAnimationFrame(tick);
		};

		rafRef.current = requestAnimationFrame(tick);
		return () => rafRef.current && cancelAnimationFrame(rafRef.current);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [value]);

	return display;
}

function ProviderBadge({ provider }) {
	const kind = normalizeProvider(provider);
	const label = String(provider || 'unknown');
	return (
		<span className={cx('providerBadge', `provider-${kind}`)}>
			<span className='providerDot' />
			<span className='providerText'>{label}</span>
		</span>
	);
}

function StatusPill({ status, latencyMs }) {
	const norm = normalizeStatus(status);
	const slow = norm === 'ok' && isSlowCall(latencyMs);
	const cls = slow ? 'slow' : norm;
	const label = slow ? 'slow' : norm;
	return (
		<span className={cx('statusPill', `status-${cls}`)}>
			<span className='statusDot' />
			{label}
		</span>
	);
}

function CustomTooltip({ active, payload }) {
	if (!active || !payload?.length) return null;
	const { t, cost } = payload[0].payload || {};
	return (
		<div className='tooltipCard'>
			<div className='tooltipTop'>
				<div className='tooltipTitle'>Cost</div>
				<div className='tooltipMeta'>{t}</div>
			</div>
			<div className='tooltipValue fontMono'>{formatUsdSmart(cost)}</div>
		</div>
	);
}

export default function App() {
	const [apiKey, setApiKey] = useState(localStorage.getItem('tokescope_key') || 'test');

	const [summary, setSummary] = useState(null);
	const [prevSummary, setPrevSummary] = useState(null);

	const [calls, setCalls] = useState([]);
	const [selected, setSelected] = useState(null);

	const [error, setError] = useState('');
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

	const [showRaw, setShowRaw] = useState(false);

	const headers = useMemo(() => ({ 'X-API-Key': apiKey }), [apiKey]);

	async function load() {
		setError('');
		setIsRefreshing(true);
		try {
			const [s, c] = await Promise.all([
				axios.get(`${API_BASE}/metrics/summary`, { headers }),
				axios.get(`${API_BASE}/metrics/calls?limit=100`, { headers })
			]);

			setPrevSummary(summary);
			setSummary(s.data);

			setCalls(c.data || []);
			setSelected((c.data || [])?.[0] || null);

			setLastUpdatedAt(new Date());
		} catch (e) {
			setError(e?.response?.data?.detail || e.message || 'Request failed');
		} finally {
			setIsRefreshing(false);
		}
	}

	useEffect(() => {
		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const spendSeries = useMemo(() => {
		return [...calls].reverse().map((c) => ({
			t: new Date(c.created_at).toLocaleTimeString(),
			cost: Number(c.cost_usd || 0)
		}));
	}, [calls]);

	const deltaCalls = useMemo(() => {
		if (!summary || !prevSummary) return null;
		return Number(summary.total_calls || 0) - Number(prevSummary.total_calls || 0);
	}, [summary, prevSummary]);

	const avgCostPerCall = useMemo(() => {
		const tc = Number(summary?.total_calls || 0);
		const cost = Number(summary?.total_cost_usd || 0);
		return tc > 0 ? cost / tc : 0;
	}, [summary]);

	const animTotalCalls = useAnimatedNumber(summary?.total_calls ?? 0);
	const animTotalCost = useAnimatedNumber(summary?.total_cost_usd ?? 0);
	const animAvgLatency = useAnimatedNumber(summary?.avg_latency_ms ?? 0);

	return (
		<div className='page'>
			<div className='topbar'>
				<div>
					<h1 className='title'>TokeScope</h1>
					<div className='contextBar'>
						<div className='contextChip'>
							<span className='contextLabel'>Workspace</span>
							<span className='contextSep'>•</span>
							<span className='contextValue fontMono'>{apiKey}</span>
						</div>

						<div className='contextChip'>
							<span className='contextLabel'>Environment</span>
							<span className='contextSep'>•</span>
							<span className='contextValue fontMono'>local</span>
							<span className='envDot' />
						</div>

						{lastUpdatedAt && (
							<div className='contextChip mutedChip'>
								<span className='contextLabel'>Updated</span>
								<span className='contextSep'>•</span>
								<span className='contextValue'>{lastUpdatedAt.toLocaleTimeString()}</span>
							</div>
						)}
					</div>
				</div>

				<div className='controls'>
					<input className='input' value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder='X-API-Key' />
					<button
						className='btn btnPrimary'
						onClick={() => {
							localStorage.setItem('tokescope_key', apiKey);
							load();
						}}
						disabled={isRefreshing}
					>
						{isRefreshing ? <span className='spinner' /> : null}
						Load
					</button>
					<button className='btn' onClick={load} disabled={isRefreshing}>
						{isRefreshing ? <span className='spinner' /> : null}
						Refresh
					</button>
				</div>
			</div>

			{error && <div className='error'>{error}</div>}

			<div className='fadeIn' key={lastUpdatedAt?.getTime() || 'init'}>
				<div className='metrics'>
					<MetricCard
						variant='calls'
						title='Total Calls'
						value={formatInt(animTotalCalls)}
						subLeft={deltaCalls == null ? null : `${deltaCalls >= 0 ? '+' : ''}${deltaCalls} since refresh`}
						subTone={deltaCalls != null && deltaCalls < 0 ? 'bad' : 'good'}
					/>
					<MetricCard
						variant='cost'
						title='Total Cost'
						value={formatUsdSmart(animTotalCost)}
						mono
						subLeft='Avg per call'
						subRight={formatUsdFixed6(avgCostPerCall)}
					/>
					<MetricCard
						variant='latency'
						title='Avg Latency'
						value={formatMs(animAvgLatency)}
						mono
						subLeft='Rolling average'
					/>
				</div>

				<div className='card'>
					<div className='cardHeader'>
						<div className='cardTitle'>Cost by Provider</div>
					</div>

					<div className='tableWrap'>
						<table className='table'>
							<thead>
								<tr>
									<Th>Provider</Th>
									<Th className='num'>Calls</Th>
									<Th className='num'>Cost</Th>
								</tr>
							</thead>
							<tbody>
								{(summary?.by_provider || []).map((p, idx) => (
									<tr key={idx} className='row'>
										<Td>
											<ProviderBadge provider={p.provider} />
										</Td>
										<Td className='num fontMono'>{formatInt(p.calls)}</Td>
										<Td className='num fontMono'>{formatUsdSmart(p.cost_usd)}</Td>
									</tr>
								))}
								{(summary?.by_provider || []).length === 0 && (
									<tr className='row'>
										<Td colSpan={3} className='muted'>
											No provider breakdown available.
										</Td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>

				<div className='grid'>
					<div className='card'>
						<div className='cardHeader cardHeaderBetween'>
							<div className='cardTitle'>Cost (last 100 calls)</div>
							<div className='pill'>USD</div>
						</div>

						<div className='chartWrap'>
							<ResponsiveContainer>
								<AreaChart data={spendSeries}>
									<CartesianGrid stroke='rgba(255,255,255,0.06)' strokeDasharray='0' />
									<XAxis dataKey='t' hide />
									<YAxis
										width={84}
										tickFormatter={(v) => formatUsdSmart(v)}
										axisLine={false}
										tickLine={false}
										tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 12 }}
									/>
									<Tooltip content={<CustomTooltip />} />
									<Area
										type='monotone'
										dataKey='cost'
										dot={false}
										stroke='rgba(59,130,246,0.85)'
										strokeWidth={2}
										fill='rgba(59,130,246,0.18)'
									/>
									<Line type='monotone' dataKey='cost' dot={false} stroke='rgba(237,237,237,0.75)' strokeWidth={1} />
								</AreaChart>
							</ResponsiveContainer>
						</div>
					</div>

					<div className='card'>
						<div className='cardHeader'>
							<div className='cardTitle'>Recent Calls</div>
						</div>

						<div className='tableWrap'>
							<table className='table'>
								<thead>
									<tr>
										<Th>Time</Th>
										<Th>Provider</Th>
										<Th>Model</Th>
										<Th className='num'>Cost</Th>
										<Th className='num'>Latency</Th>
										<Th>Status</Th>
									</tr>
								</thead>
								<tbody>
									{calls.map((c, idx) => {
										const isSelected = selected?.created_at === c.created_at;
										return (
											<tr
												key={idx}
												className={cx('row', isSelected && 'selected')}
												onClick={() => {
													setSelected(c);
													setShowRaw(false);
												}}
											>
												<Td className='fontMono'>{new Date(c.created_at).toLocaleTimeString()}</Td>
												<Td>
													<ProviderBadge provider={c.provider} />
												</Td>
												<Td className='muted'>{c.model}</Td>
												<Td className='num fontMono'>{formatUsdSmart(c.cost_usd)}</Td>
												<Td className='num fontMono'>{formatMs(c.latency_ms)}</Td>
												<Td>
													<StatusPill status={c.status} latencyMs={c.latency_ms} />
												</Td>
											</tr>
										);
									})}
									{calls.length === 0 && (
										<tr className='row'>
											<Td colSpan={6} className='muted'>
												No calls yet.
											</Td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
					</div>
				</div>

				<div className='card details'>
					<div className='cardHeader cardHeaderBetween'>
						<div className='cardTitle'>Selected Call</div>
						<button className='btn btnGhost' onClick={() => setShowRaw((v) => !v)} disabled={!selected}>
							{showRaw ? 'Hide Raw JSON' : 'View Raw JSON'}
						</button>
					</div>

					<div className='detailsBody'>
						{!selected ? (
							<div className='muted'>Click a row to view details.</div>
						) : (
							<>
								<div className='detailsTop'>
									<div className='detailsLeft'>
										<ProviderBadge provider={selected.provider} />
										<div className='detailsModel'>{selected.model || '—'}</div>
										<div className='detailsMeta muted'>
											<span className='fontMono'>{selected.request_id || '—'}</span>
										</div>
									</div>
									<div className='detailsRight'>
										<StatusPill status={selected.status} latencyMs={selected.latency_ms} />
										<div className='pill pillSoft fontMono'>{formatUsdSmart(selected.cost_usd)}</div>
										<div className='pill pillSoft fontMono'>{formatMs(selected.latency_ms)}</div>
									</div>
								</div>

								<div className='detailsGrid'>
									<DetailRow
										label='Tokens'
										value={formatInt(selected.total_tokens ?? selected.tokens_total ?? 0)}
										mono
									/>
									<DetailRow label='Prompt tokens' value={formatInt(selected.prompt_tokens ?? 0)} mono />
									<DetailRow label='Completion tokens' value={formatInt(selected.completion_tokens ?? 0)} mono />
									<DetailRow label='Time' value={new Date(selected.created_at).toLocaleString()} />
								</div>

								{showRaw && <pre className='jsonBlock'>{JSON.stringify(selected, null, 2)}</pre>}
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

function MetricCard({ variant, title, value, subLeft, subRight, subTone, mono }) {
	return (
		<div className={cx('card', 'metricCard', variant && `metric-${variant}`)}>
			<div className='metricHead'>
				<div className='metricTitle'>{title}</div>
				<div className='metricAccentDot' />
			</div>

			<div className={cx('metricValue', mono && 'fontMono')}>{value}</div>

			{subLeft || subRight ? (
				<div className={cx('metricSubRow', subTone && `tone-${subTone}`)}>
					<div className='metricSubLeft'>{subLeft}</div>
					{subRight ? <div className='metricSubRight fontMono'>{subRight}</div> : null}
				</div>
			) : null}
		</div>
	);
}

function DetailRow({ label, value, mono }) {
	return (
		<div className='detailRow'>
			<div className='detailLabel'>{label}</div>
			<div className={cx('detailValue', mono && 'fontMono')}>{value}</div>
		</div>
	);
}

function Th({ children, className }) {
	return <th className={cx('th', className)}>{children}</th>;
}

function Td({ children, className, colSpan }) {
	return (
		<td className={cx('td', className)} colSpan={colSpan}>
			{children}
		</td>
	);
}
