#!/usr/bin/env python3
"""Draw the README charts from the published study data. No packages needed.

  python3 docs/charts/make_charts.py [--out DIR]

Reads ab-study/results/2026-09-replication/runs.csv and writes light and dark SVGs to
docs/images/. The README shows them with <picture>, so GitHub picks the one that matches
the reader's theme.
"""
import argparse
import csv
import statistics as st
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
RUNS = REPO / 'ab-study' / 'results' / '2026-09-replication' / 'runs.csv'
OUT = REPO / 'docs' / 'images'

APPS = [('todo', 'Todo'), ('calculator', 'Calculator'), ('tetris', 'Tetris')]
FONT = '-apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Helvetica, Arial, sans-serif'

# Validated with the dataviz palette validator (adjacent CVD and normal-vision separation,
# contrast vs surface) in both modes. Plain Claude Code is the baseline, drawn in neutral gray.
THEMES = {
    'light': dict(ink='#1f2328', secondary='#59636e', muted='#818b98', grid='#e1e4e8', axis='#c9d1d9',
                  full='#2a78d6', light='#eb6834', control='#9aa1a9'),
    'dark': dict(ink='#f0f6fc', secondary='#9198a1', muted='#7d8590', grid='#262c34', axis='#3d444d',
                 full='#3987e5', light='#d95926', control='#6e7681'),
}
SERIES = [('v2', 'Product Traceability', 'full'), ('rules-only', 'Product Traceability Light', 'light')]


def load():
    rows = list(csv.DictReader(open(RUNS)))
    mean = lambda app, arm, key: st.mean(float(r[key]) for r in rows if r['app'] == app and r['arm'] == arm)
    return mean


def bar(x, y, length, thickness, color, radius=4):
    """Horizontal bar from x, square at the baseline, rounded at the data end."""
    if length <= 0:
        return ''
    r = min(radius, length, thickness / 2)
    x2 = x + length
    return (f'<path d="M{x:.1f},{y:.1f} H{x2 - r:.1f} Q{x2:.1f},{y:.1f} {x2:.1f},{y + r:.1f} '
            f'V{y + thickness - r:.1f} Q{x2:.1f},{y + thickness:.1f} {x2 - r:.1f},{y + thickness:.1f} '
            f'H{x:.1f} Z" fill="{color}"/>')


def text(x, y, s, color, size=13, weight=400, anchor='start'):
    return (f'<text x="{x:.1f}" y="{y:.1f}" fill="{color}" font-size="{size}" font-weight="{weight}" '
            f'text-anchor="{anchor}" font-family="{FONT}">{s}</text>')


def legend(t, x, y, items):
    out = []
    for label, color in items:
        out.append(f'<rect x="{x}" y="{y - 10}" width="12" height="12" rx="3" fill="{color}"/>')
        out.append(text(x + 18, y, label, t['secondary'], 13))
        x += 18 + len(label) * 7.2 + 26
    return ''.join(out)


def svg(width, height, title, desc, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
            f'viewBox="0 0 {width} {height}" role="img" aria-labelledby="t d">'
            f'<title id="t">{title}</title><desc id="d">{desc}</desc>{body}</svg>\n')


def savings_chart(mean, mode):
    """Two panels: % cheaper and % faster than plain Claude Code, per app and on average."""
    t = THEMES[mode]
    width, panel_w, label_w, gap = 880, 300, 92, 48
    top, row_h, thick = 70, 44, 14
    rows = APPS + [('avg', 'Average')]
    height = top + row_h * len(rows) + 24
    metrics = [('cost', 'Cost', 'cheaper'), ('wall_min', 'Build time', 'faster')]

    def reduction(app, arm, key):
        if app == 'avg':
            return st.mean(reduction(a, arm, key) for a, _ in APPS)
        return 100 * (1 - mean(app, arm, key) / mean(app, 'control', key))

    body = [legend(t, 0, 18, [(name, t[c]) for _, name, c in SERIES])]
    desc = []
    for p, (key, name, word) in enumerate(metrics):
        x0 = label_w + p * (panel_w + gap + label_w)
        body.append(text(x0 - label_w, 52, f'{name}: % {word} than plain Claude Code', t['ink'], 14, 600))
        scale = panel_w / 60.0
        for tick in (0, 20, 40, 60):
            gx = x0 + tick * scale
            body.append(f'<line x1="{gx:.1f}" y1="{top - 8}" x2="{gx:.1f}" y2="{top + row_h * len(rows) - 6}" '
                        f'stroke="{t["axis"] if tick == 0 else t["grid"]}" stroke-width="1"/>')
            body.append(text(gx, top + row_h * len(rows) + 12, f'{tick}%', t['muted'], 12, anchor='middle'))
        for i, (app, label) in enumerate(rows):
            y = top + i * row_h
            if app == 'avg':
                body.append(f'<line x1="{x0 - label_w}" y1="{y - 5}" x2="{x0 + panel_w + 36}" y2="{y - 5}" '
                            f'stroke="{t["grid"]}" stroke-width="1"/>')
            body.append(text(x0 - 12, y + thick + 5, label, t['ink'] if app == 'avg' else t['secondary'],
                             13, 600 if app == 'avg' else 400, 'end'))
            for s, (arm, sname, color) in enumerate(SERIES):
                v = reduction(app, arm, key)
                by = y + s * (thick + 2)
                body.append(bar(x0, by, v * scale, thick, t[color]))
                body.append(text(x0 + v * scale + 6, by + thick - 3, f'{v:.0f}%', t['ink'], 12,
                                 600 if app == 'avg' else 400))
                if app == 'avg':
                    desc.append(f'{sname} {v:.1f}% {word}')
    return svg(width, height, 'Savings vs plain Claude Code',
               'Average over three apps: ' + '; '.join(desc) + '.', ''.join(body))


def round_trips_chart(mean, mode):
    """API round trips per build, for all three setups, per app."""
    t = THEMES[mode]
    width, label_w, plot_w = 880, 92, 700
    top, row_h, thick = 78, 64, 14
    height = top + row_h * len(APPS) + 16
    setups = [('control', 'Plain Claude Code', 'control')] + SERIES
    body = [legend(t, 0, 18, [(name, t[c]) for _, name, c in setups]),
            text(0, 52, 'API round trips per build (fewer is better)', t['ink'], 14, 600)]
    scale = plot_w / 100.0
    for tick in (0, 25, 50, 75, 100):
        gx = label_w + tick * scale
        body.append(f'<line x1="{gx:.1f}" y1="{top - 6}" x2="{gx:.1f}" y2="{top + row_h * len(APPS) - 14}" '
                    f'stroke="{t["axis"] if tick == 0 else t["grid"]}" stroke-width="1"/>')
        body.append(text(gx, top + row_h * len(APPS) + 4, str(tick), t['muted'], 12, anchor='middle'))
    desc = []
    for i, (app, label) in enumerate(APPS):
        y = top + i * row_h
        body.append(text(label_w - 12, y + thick * 1.5 + 8, label, t['secondary'], 13, anchor='end'))
        parts = []
        for s, (arm, name, color) in enumerate(setups):
            v = mean(app, arm, 'round_trips')
            by = y + s * (thick + 2)
            body.append(bar(label_w, by, v * scale, thick, t[color]))
            body.append(text(label_w + v * scale + 6, by + thick - 3, f'{v:.0f}', t['ink'], 12))
            parts.append(f'{name} {v:.0f}')
        desc.append(f'{label}: ' + ', '.join(parts))
    return svg(width, height, 'API round trips per build',
               'Mean API round trips per ten-session build. ' + '; '.join(desc) + '.', ''.join(body))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=str(OUT), help='where to write the SVGs (default: docs/images)')
    out = Path(ap.parse_args().out)
    mean = load()
    out.mkdir(parents=True, exist_ok=True)
    for mode in THEMES:
        (out / f'savings-{mode}.svg').write_text(savings_chart(mean, mode))
        (out / f'round-trips-{mode}.svg').write_text(round_trips_chart(mean, mode))
    print('wrote', ', '.join(sorted(p.name for p in out.glob('*.svg'))), 'to', out)


if __name__ == '__main__':
    main()
