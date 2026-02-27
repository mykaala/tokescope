import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import './index.css';

const API_BASE = 'http://localhost:8000';

function formatUsd(x) {
	if (x == null) return '$0.00';
	return `$${Number(x).toFixed(6)}`;
}

function formatMs(x) {
	if (x == null) return '0 ms';
	return `${Math.round(Number(x))} ms`;
}

export default function App() {
	const [apiKey, setApiKey] = useState(localStorage.getItem('tokescope_key') || 'test');
	const [summary, setSummary] = useState(null);
	const [calls, setCalls] = useState([]);
	const [selected, setSelected] = useState(null);
	const [error, setError] = useState('');

	const headers = useMemo(() => ({ 'X-API-Key': apiKey }), [apiKey]);

	async function load() {
		setError('');
		try {
			const [s, c] = await Promise.all([
				axios.get(`${API_BASE}/metrics/summary`, { headers }),
				axios.get(`${API_BASE}/metrics/calls?limit=100`, { headers })
			]);
			setSummary(s.data);
			setCalls(c.data);
			setSelected(c.data?.[0] || null);
		} catch (e) {
			setError(e?.response?.data?.detail || e.message || 'Request failed');
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

	return (
		<div className='page'>
			<div className='topbar'>
				<div>
					<h1 className='title'>TokeScope</h1>
					<div className='subtitle'>
						Workspace: <code className='code'>{apiKey}</code>
					</div>
				</div>

				<div className='controls'>
					<input className='input' value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder='X-API-Key' />
					<button
						className='btn'
						onClick={() => {
							localStorage.setItem('tokescope_key', apiKey);
							load();
						}}
					>
						Load
					</button>
					<button className='btn' onClick={load}>
						Refresh
					</button>
				</div>
			</div>

			{error && <div className='error'>{error}</div>}

			<div className='metrics'>
				<MetricCard title='Total Calls' value={summary?.total_calls ?? 0} />
				<MetricCard title='Total Cost' value={formatUsd(summary?.total_cost_usd ?? 0)} />
				<MetricCard title='Avg Latency' value={formatMs(summary?.avg_latency_ms ?? 0)} />
			</div>

			<div className='grid'>
				<div className='card'>
					<div className='cardTitle'>Cost (last 100 calls)</div>
					<div className='chartWrap'>
						<ResponsiveContainer>
							<LineChart data={spendSeries}>
								<CartesianGrid strokeDasharray='3 3' />
								<XAxis dataKey='t' hide />
								<YAxis />
								<Tooltip />
								<Line type='monotone' dataKey='cost' dot={false} />
							</LineChart>
						</ResponsiveContainer>
					</div>
				</div>

				<div className='card'>
					<div className='cardTitle'>Recent Calls</div>
					<div className='tableWrap'>
						<table className='table'>
							<thead>
								<tr>
									<Th>Time</Th>
									<Th>Model</Th>
									<Th>Cost</Th>
									<Th>Latency</Th>
								</tr>
							</thead>
							<tbody>
								{calls.map((c, idx) => {
									const isSelected = selected?.created_at === c.created_at;
									return (
										<tr key={idx} className={isSelected ? 'row selected' : 'row'} onClick={() => setSelected(c)}>
											<Td>{new Date(c.created_at).toLocaleTimeString()}</Td>
											<Td>{c.model}</Td>
											<Td>{formatUsd(c.cost_usd)}</Td>
											<Td>{formatMs(c.latency_ms)}</Td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			<div className='card details'>
				<div className='cardTitle'>Selected Call</div>
				{!selected ? (
					<div className='muted'>Click a row to view details.</div>
				) : (
					<pre className='json'>{JSON.stringify(selected, null, 2)}</pre>
				)}
			</div>
		</div>
	);
}

function MetricCard({ title, value }) {
	return (
		<div className='card metricCard'>
			<div className='metricTitle'>{title}</div>
			<div className='metricValue'>{value}</div>
		</div>
	);
}

function Th({ children }) {
	return <th className='th'>{children}</th>;
}

function Td({ children }) {
	return <td className='td'>{children}</td>;
}
