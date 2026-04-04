"""Visualisation interactive des résultats reseau_bis.

Produit un dashboard HTML autonome (plotly, zéro serveur) depuis les objets
PyPSA network + result dict issus de `InfraReseauBis.calculer_production()`.

Usage minimal (depuis n'importe quel fichier de test) :
    from harmoniq.modules.reseau_bis.viz import ReseauBisViz
    viz = ReseauBisViz(infra.network, result, label="Hiver 2035")
    viz.show()                          # ouvre dans le navigateur
    viz.save("resultats_hiver.html")    # fichier HTML autonome

Ou en une ligne :
    ReseauBisViz(infra.network, result).show()

Graphiques inclus (8 panneaux) :
  1. Dispatch par carrier (stacked area, MW/h)
  2. Demande totale vs Production totale (lignes)
  3. Répartition de l'énergie par carrier (donut)
  4. Top 15 générateurs dispatché (barres horizontales)
  5. Distribution des chargements de lignes (histogramme)
  6. Flux imports/exports (stacked area, MW/h)
  7. Prix marginal hydro-réservoir au fil du temps
  8. Heatmap horaire de la demande totale (24h × jours)
"""

from __future__ import annotations

import logging
import os
import webbrowser
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

log = logging.getLogger("ReseauBisViz")

# ---------------------------------------------------------------------------
# Constantes esthétiques
# ---------------------------------------------------------------------------
CARRIER_COLORS: Dict[str, str] = {
    "eolien":          "#4DA6FF",
    "solaire":         "#FFD700",
    "hydro_fil":       "#2ECAD0",
    "hydro_reservoir": "#1565C0",
    "thermique":       "#FF6347",
    "nucleaire":       "#9B59B6",
    "import":          "#27AE60",
    "export":          "#E67E22",
}

CARRIER_LABELS: Dict[str, str] = {
    "eolien":          "Éolien",
    "solaire":         "Solaire",
    "hydro_fil":       "Hydro fil de l'eau",
    "hydro_reservoir": "Hydro réservoir",
    "thermique":       "Thermique",
    "nucleaire":       "Nucléaire",
    "import":          "Importation",
    "export":          "Exportation",
}

_CARRIER_ORDER = [
    "hydro_reservoir", "hydro_fil", "nucleaire",
    "eolien", "solaire", "thermique", "import",
]

PLOTLY_TEMPLATE = "plotly_white"

# ---------------------------------------------------------------------------
# Classe principale
# ---------------------------------------------------------------------------

class ReseauBisViz:
    """Dashboard plotly pour un résultat reseau_bis.

    Parameters
    ----------
    network : pypsa.Network
        Réseau résolu (après calculer_production()).
    result : dict
        Dictionnaire retourné par calculer_production()
        (clés : summary, production, violations, link_flows, was_relaxed).
    label : str, optional
        Titre de la période simulée (ex: "Hiver 2035 — Jan 13-26").
    downsample : int
        Pas de sous-échantillonnage pour les séries longues.
        1 = toutes les heures, 4 = toutes les 4h, etc.
        Réglé automatiquement si non fourni.
    """

    def __init__(
        self,
        network: Any,
        result: Dict[str, Any],
        label: str = "",
        downsample: Optional[int] = None,
    ) -> None:
        self.network  = network
        self.result   = result
        self.label    = label
        self.summary  = result.get("summary", {})

        # Sous-échantillonnage automatique selon la durée
        n = len(network.snapshots) if hasattr(network, "snapshots") else 0
        if downsample is None:
            if n > 5000:
                self.ds = 6
            elif n > 1000:
                self.ds = 2
            else:
                self.ds = 1
        else:
            self.ds = max(1, int(downsample))

        self._fig: Any = None   # figure plotly (lazy)

    # ------------------------------------------------------------------
    # API publique
    # ------------------------------------------------------------------

    def show(self) -> Path:
        """Ouvre le dashboard dans le navigateur par défaut.

        Sauvegarde dans <projet>/outputs/viz/ avec un nom horodaté
        pour retrouver facilement le fichier après coup.
        Retourne le chemin du fichier créé.
        """
        from datetime import datetime as _dt

        # Dossier de sortie : racine du projet / outputs / viz /
        # viz.py est dans harmoniq/modules/reseau_bis/ → remonter 4 niveaux
        _project_root = Path(__file__).parent.parent.parent.parent
        _out_dir = _project_root / "outputs" / "viz"
        _out_dir.mkdir(parents=True, exist_ok=True)

        # Nom de fichier : harmoniq_viz_<label_safe>_<timestamp>.html
        ts = _dt.now().strftime("%Y%m%d_%H%M%S")
        safe = (self.label or "result").replace(" ", "_").replace("—", "-")
        safe = "".join(c for c in safe if c.isalnum() or c in "_-.")[:40]
        fname = f"harmoniq_viz_{safe}_{ts}.html"
        out_path = _out_dir / fname

        fig = self._get_fig()
        fig.write_html(str(out_path), include_plotlyjs="cdn")

        print(f"\n{'='*60}")
        print(f"  📊 Dashboard sauvegardé :")
        print(f"     {out_path}")
        print(f"{'='*60}\n")
        log.info("Dashboard : %s", out_path)
        webbrowser.open(f"file:///{out_path.as_posix()}")
        return out_path

    def save(self, path: str | Path = "reseau_bis_results.html") -> Path:
        """Sauvegarde le dashboard en fichier HTML autonome.

        Le fichier inclut plotly.js (CDN) — peut être ouvert sans Python.
        """
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        fig = self._get_fig()
        fig.write_html(str(path), include_plotlyjs="cdn")
        log.info("Dashboard sauvegardé : %s (%.0f KB)", path, path.stat().st_size / 1024)
        return path

    def figures(self) -> list:
        """Retourne la liste des sous-figures individuelles (pour intégration Jupyter)."""
        return self._build_individual_figures()

    # ------------------------------------------------------------------
    # Construction des figures
    # ------------------------------------------------------------------

    def _get_fig(self) -> Any:
        if self._fig is None:
            self._fig = self._build_dashboard()
        return self._fig

    def _build_dashboard(self) -> Any:
        """Assemble le dashboard principal (8 sous-graphiques, 2 colonnes)."""
        try:
            from plotly.subplots import make_subplots
            import plotly.graph_objects as go
        except ImportError as e:
            raise ImportError("plotly est requis : pip install plotly") from e

        period_label = self.label or _infer_label(self.network)

        fig = make_subplots(
            rows=4, cols=2,
            subplot_titles=[
                "Dispatch par carrier (MW)",
                "Demande vs Production totale (MW)",
                "Répartition de l'énergie par carrier",
                "Top 15 générateurs dispatché (GWh)",
                "Chargement des lignes — distribution",
                "Flux imports / exports (MW)",
                "Coûts marginaux hydro-réservoir ($/MWh)",
                "Heatmap demande totale (MW)",
            ],
            specs=[
                [{"type": "xy"},     {"type": "xy"}],
                [{"type": "domain"}, {"type": "xy"}],
                [{"type": "xy"},     {"type": "xy"}],
                [{"type": "xy"},     {"type": "xy"}],
            ],
            vertical_spacing=0.10,
            horizontal_spacing=0.08,
        )

        # ── Panneau 1 : Dispatch stacked area ─────────────────────────
        _add_dispatch_area(fig, self.network, self.ds, row=1, col=1)

        # ── Panneau 2 : Demande vs Production ─────────────────────────
        _add_demand_vs_supply(fig, self.network, self.ds, row=1, col=2)

        # ── Panneau 3 : Donut carriers ────────────────────────────────
        _add_carrier_donut(fig, self.network, row=2, col=1)

        # ── Panneau 4 : Top 15 générateurs ───────────────────────────
        _add_top_generators(fig, self.network, row=2, col=2)

        # ── Panneau 5 : Histogramme chargement lignes ─────────────────
        _add_line_loading_hist(fig, self.network, row=3, col=1)

        # ── Panneau 6 : Flux imports/exports ─────────────────────────
        _add_link_flows(fig, self.network, self.ds, row=3, col=2)

        # ── Panneau 7 : Coûts marginaux hydro-réservoir ───────────────
        _add_reservoir_costs(fig, self.network, self.ds, row=4, col=1)

        # ── Panneau 8 : Heatmap demande horaire ──────────────────────
        _add_demand_heatmap(fig, self.network, row=4, col=2)

        # ── Layout global ─────────────────────────────────────────────
        energie_gwh  = self.summary.get("total_energy_mwh", 0) / 1000
        pertes_pct   = self.summary.get("losses_percent", 0)
        import_gwh   = self.summary.get("total_import_mwh", 0) / 1000
        export_gwh   = self.summary.get("total_export_mwh", 0) / 1000
        was_relaxed  = self.result.get("was_relaxed", False)
        n_snap       = len(self.network.snapshots)
        n_gen        = len(self.network.generators)
        n_bus        = len(self.network.buses)
        n_line       = len(self.network.lines)

        subtitle = (
            f"{n_snap} snapshots | {n_gen} générateurs | {n_bus} bus | {n_line} lignes | "
            f"Énergie={energie_gwh:.0f} GWh | Pertes={pertes_pct:.2f}% | "
            f"Import={import_gwh:.0f} GWh | Export={export_gwh:.0f} GWh"
            + (" | ⚠ contraintes relâchées" if was_relaxed else "")
        )

        fig.update_layout(
            title={
                "text": f"<b>HarmoniQ — reseau_bis</b><br>"
                        f"<span style='font-size:14px'>{period_label}</span><br>"
                        f"<span style='font-size:11px;color:#666'>{subtitle}</span>",
                "x": 0.5,
                "xanchor": "center",
                "y": 0.98,
                "yanchor": "top",
            },
            template=PLOTLY_TEMPLATE,
            height=1800,
            showlegend=True,
            legend=dict(
                orientation="h",
                yanchor="top",
                y=1.09,
                xanchor="center",
                x=0.5,
                font=dict(size=11),
                itemwidth=30,
            ),
            margin=dict(t=320, b=60, l=60, r=60),
        )

        return fig

    def _build_individual_figures(self) -> list:
        """Retourne les figures individuelles (utile pour Jupyter / embedding)."""
        import plotly.graph_objects as go
        figs = []
        builders = [
            ("Dispatch par carrier",      lambda: _standalone_fig(_add_dispatch_area,    self.network, self.ds)),
            ("Demande vs Production",     lambda: _standalone_fig(_add_demand_vs_supply, self.network, self.ds)),
            ("Répartition carriers",      lambda: _standalone_donut(self.network)),
            ("Top 15 générateurs",        lambda: _standalone_fig(_add_top_generators,   self.network, None)),
            ("Chargement lignes",         lambda: _standalone_fig(_add_line_loading_hist,self.network, None)),
            ("Flux interconnexions",      lambda: _standalone_fig(_add_link_flows,       self.network, self.ds)),
            ("Coûts marginaux hydro",     lambda: _standalone_fig(_add_reservoir_costs,  self.network, self.ds)),
            ("Heatmap demande",           lambda: _standalone_fig(_add_demand_heatmap,   self.network, None)),
        ]
        for name, builder in builders:
            try:
                figs.append((name, builder()))
            except Exception as exc:
                log.warning("Figure '%s' ignorée : %s", name, exc)
        return figs


# ---------------------------------------------------------------------------
# Fonctions de construction des sous-graphiques
# ---------------------------------------------------------------------------

def _add_dispatch_area(fig: Any, network: Any, ds: int, row: int, col: int) -> None:
    """Stacked area du dispatch par carrier au fil du temps."""
    import plotly.graph_objects as go

    if not hasattr(network, "generators_t") or "p" not in network.generators_t:
        return
    p = network.generators_t.p
    if p.empty:
        return

    timestamps = network.snapshots[::ds]

    carriers_present = []
    for carrier in _CARRIER_ORDER:
        gens = network.generators.index[network.generators.carrier == carrier]
        gens_in_p = [g for g in gens if g in p.columns]
        if not gens_in_p:
            continue
        series = p[gens_in_p].sum(axis=1).reindex(timestamps).fillna(0) / 1e3  # MW → GW
        if series.sum() < 0.001:
            continue
        carriers_present.append(carrier)
        fig.add_trace(
            go.Scatter(
                x=timestamps,
                y=series.values,
                mode="lines",
                stackgroup="dispatch",
                name=CARRIER_LABELS.get(carrier, carrier),
                line=dict(width=0, color=CARRIER_COLORS.get(carrier, "#999")),
                fillcolor=CARRIER_COLORS.get(carrier, "#999"),
                legendgroup=carrier,
                showlegend=True,
                hovertemplate=f"<b>{CARRIER_LABELS.get(carrier, carrier)}</b><br>%{{x}}<br>%{{y:.2f}} GW<extra></extra>",
            ),
            row=row, col=col,
        )

    # Export : zone sous zéro (convention dispatch : production positive, export négatif)
    # Les générateurs export ont p < 0 (ils absorbent du surplus HQ).
    export_gens = network.generators.index[network.generators.carrier == "export"]
    export_in_p = [g for g in export_gens if g in p.columns]
    if export_in_p:
        export_series = p[export_in_p].sum(axis=1).reindex(timestamps).fillna(0) / 1e3  # négatif
        if export_series.abs().sum() > 0.001:
            fig.add_trace(
                go.Scatter(
                    x=timestamps,
                    y=export_series.values,
                    mode="lines",
                    fill="tozeroy",
                    name=CARRIER_LABELS.get("export", "Export"),
                    line=dict(width=0, color=CARRIER_COLORS.get("export", "#E67E22")),
                    fillcolor="rgba(230, 126, 34, 0.4)",
                    legendgroup="export",
                    showlegend=True,
                    hovertemplate="<b>Exportation</b><br>%{x}<br>%{y:.2f} GW<extra></extra>",
                ),
                row=row, col=col,
            )

    fig.update_yaxes(title_text="GW", row=row, col=col)


def _add_demand_vs_supply(fig: Any, network: Any, ds: int, row: int, col: int) -> None:
    """Courbe demande totale vs production totale."""
    import plotly.graph_objects as go

    timestamps = network.snapshots[::ds]

    # Demande totale
    if hasattr(network, "loads_t") and "p_set" in network.loads_t and not network.loads_t.p_set.empty:
        demand = network.loads_t.p_set.sum(axis=1).reindex(timestamps).fillna(0) / 1e3
        fig.add_trace(
            go.Scatter(
                x=timestamps, y=demand.values, mode="lines",
                name="Demande", line=dict(color="#E74C3C", width=2, dash="dot"),
                legendgroup="demand_supply", showlegend=True,
                hovertemplate="<b>Demande</b><br>%{x}<br>%{y:.2f} GW<extra></extra>",
            ),
            row=row, col=col,
        )

    # Production totale (tous générateurs)
    if hasattr(network, "generators_t") and "p" in network.generators_t and not network.generators_t.p.empty:
        supply = network.generators_t.p.sum(axis=1).reindex(timestamps).fillna(0) / 1e3
        fig.add_trace(
            go.Scatter(
                x=timestamps, y=supply.values, mode="lines",
                name="Production", line=dict(color="#27AE60", width=2),
                legendgroup="demand_supply", showlegend=True,
                hovertemplate="<b>Production</b><br>%{x}<br>%{y:.2f} GW<extra></extra>",
            ),
            row=row, col=col,
        )

    fig.update_yaxes(title_text="GW", row=row, col=col)


def _add_carrier_donut(fig: Any, network: Any, row: int, col: int) -> None:
    """Donut de répartition de l'énergie par carrier."""
    import plotly.graph_objects as go

    if not hasattr(network, "generators_t") or "p" not in network.generators_t:
        return
    p = network.generators_t.p
    if p.empty:
        return

    snap_weights = network.snapshot_weightings.generators if hasattr(network, "snapshot_weightings") else None
    labels, values, colors = [], [], []
    for carrier in _CARRIER_ORDER:
        gens = [g for g in network.generators.index[network.generators.carrier == carrier] if g in p.columns]
        if not gens:
            continue
        if snap_weights is not None:
            gwh = p[gens].multiply(snap_weights, axis=0).sum().sum() / 1e3
        else:
            gwh = p[gens].sum().sum() / 1e3
        if gwh < 0.01:
            continue
        labels.append(CARRIER_LABELS.get(carrier, carrier))
        values.append(round(gwh, 1))
        colors.append(CARRIER_COLORS.get(carrier, "#999"))

    if not labels:
        return

    fig.add_trace(
        go.Pie(
            labels=labels,
            values=values,
            hole=0.45,
            marker=dict(colors=colors, line=dict(color="white", width=2)),
            textinfo="label+percent",
            hovertemplate="<b>%{label}</b><br>%{value:.1f} GWh<br>%{percent}<extra></extra>",
            showlegend=False,
        ),
        row=row, col=col,
    )


def _add_top_generators(fig: Any, network: Any, row: int, col: int) -> None:
    """Barres horizontales : top 15 générateurs par GWh dispatché."""
    import plotly.graph_objects as go

    if not hasattr(network, "generators_t") or "p" not in network.generators_t:
        return
    p = network.generators_t.p
    if p.empty:
        return

    snap_weights = network.snapshot_weightings.generators if hasattr(network, "snapshot_weightings") else None
    if snap_weights is not None:
        dispatch_total = p.multiply(snap_weights, axis=0).sum().sort_values(ascending=False).head(15) / 1e3
    else:
        dispatch_total = p.sum().sort_values(ascending=False).head(15) / 1e3  # GWh
    if dispatch_total.empty:
        return

    carriers = [
        network.generators.at[g, "carrier"] if g in network.generators.index else "?"
        for g in dispatch_total.index
    ]
    colors = [CARRIER_COLORS.get(c, "#999") for c in carriers]
    labels = [CARRIER_LABELS.get(c, c) for c in carriers]

    fig.add_trace(
        go.Bar(
            x=dispatch_total.values,
            y=dispatch_total.index.tolist(),
            orientation="h",
            marker=dict(color=colors),
            text=[f"{v:.1f} GWh" for v in dispatch_total.values],
            textposition="outside",
            customdata=list(zip(carriers, labels)),
            hovertemplate="<b>%{y}</b><br>Carrier: %{customdata[1]}<br>%{x:.1f} GWh<extra></extra>",
            showlegend=False,
        ),
        row=row, col=col,
    )
    fig.update_xaxes(title_text="GWh", row=row, col=col)
    fig.update_yaxes(autorange="reversed", row=row, col=col)


def _add_line_loading_hist(fig: Any, network: Any, row: int, col: int) -> None:
    """Histogramme de la distribution du chargement des lignes (%)."""
    import plotly.graph_objects as go

    if not hasattr(network, "lines_t") or "p0" not in network.lines_t or network.lines_t.p0.empty:
        return
    if network.lines.empty or "s_nom" not in network.lines.columns:
        return

    p0 = network.lines_t.p0.abs()
    s_nom = network.lines["s_nom"]
    loading_pct = (p0.div(s_nom, axis=1) * 100).values.ravel()
    loading_pct = loading_pct[np.isfinite(loading_pct) & (loading_pct >= 0)]

    if len(loading_pct) == 0:
        return

    # Calcul des seuils pour annotation
    pct_over_80  = (loading_pct > 80).sum() / len(loading_pct) * 100
    pct_over_100 = (loading_pct > 100).sum() / len(loading_pct) * 100

    fig.add_trace(
        go.Histogram(
            x=loading_pct,
            nbinsx=50,
            marker=dict(
                color=np.where(loading_pct > 100, "#E74C3C", "#27AE60"),
                colorscale=[[0, "#27AE60"], [0.8, "#F39C12"], [1.0, "#E74C3C"]],
                cmin=0, cmax=loading_pct.max(),
            ),
            name="Chargement lignes",
            showlegend=False,
            hovertemplate="Chargement: %{x:.1f}%<br>Nb occurrences: %{y}<extra></extra>",
        ),
        row=row, col=col,
    )
    # Ligne à 100% et 80% (add_shape évite le bug xaxis sur le subplot Pie)
    for xval, color in [(100, "red"), (80, "orange")]:
        fig.add_shape(
            type="line", x0=xval, x1=xval, y0=0, y1=1,
            yref="y domain",
            line=dict(color=color, dash="dash", width=1.5 if xval == 100 else 1),
            row=row, col=col,
        )

    fig.update_xaxes(title_text="Chargement (%)", row=row, col=col)
    fig.update_yaxes(title_text="Nb mesures", row=row, col=col)


def _add_link_flows(fig: Any, network: Any, ds: int, row: int, col: int) -> None:
    """Stacked area des flux d'import/export via les interconnexions."""
    import plotly.graph_objects as go

    if not hasattr(network, "links_t") or "p0" not in network.links_t:
        return
    p0 = network.links_t.p0
    if p0.empty or network.links.empty:
        return

    timestamps = network.snapshots[::ds]

    # Convention PyPSA : p0 = puissance au bus0 du Link (= bus Interco, côté HQ)
    #   p0 > 0  → flux sort de HQ vers Étranger = EXPORT
    #   p0 < 0  → flux entre dans HQ depuis Étranger = IMPORT
    export_series = p0.clip(lower=0).sum(axis=1).reindex(timestamps).fillna(0) / 1e3
    import_series = (-p0.clip(upper=0)).sum(axis=1).reindex(timestamps).fillna(0) / 1e3

    if import_series.sum() > 0.001:
        fig.add_trace(
            go.Scatter(
                x=timestamps, y=import_series.values, mode="lines",
                name="Import",
                line=dict(width=0, color=CARRIER_COLORS["import"]),
                fillcolor=CARRIER_COLORS["import"],
                stackgroup="links", fill="tozeroy",
                legendgroup="import_export", showlegend=True,
                hovertemplate="<b>Import</b><br>%{x}<br>%{y:.2f} GW<extra></extra>",
            ),
            row=row, col=col,
        )
    if export_series.sum() > 0.001:
        fig.add_trace(
            go.Scatter(
                x=timestamps, y=-export_series.values, mode="lines",
                name="Export",
                line=dict(width=0, color=CARRIER_COLORS["export"]),
                fillcolor=CARRIER_COLORS["export"],
                stackgroup="links_exp", fill="tozeroy",
                legendgroup="import_export", showlegend=True,
                hovertemplate="<b>Export</b><br>%{x}<br>%{y:.2f} GW<extra></extra>",
            ),
            row=row, col=col,
        )

    fig.update_yaxes(title_text="GW (import>0, export<0)", row=row, col=col)


def _add_reservoir_costs(fig: Any, network: Any, ds: int, row: int, col: int) -> None:
    """Coûts marginaux hydro-réservoir + niveau estimé de remplissage.

    Affiche la courbe de water value ($/MWh) avec axe Y secondaire montrant
    le fill% estimé (inversé depuis la courbe de coût continue).
    """
    import plotly.graph_objects as go

    if not hasattr(network, "generators_t") or "marginal_cost" not in network.generators_t:
        return
    mc = network.generators_t.marginal_cost
    if mc.empty:
        return

    res_gens = network.generators.index[network.generators.carrier == "hydro_reservoir"]
    res_in_mc = [g for g in res_gens if g in mc.columns]
    if not res_in_mc:
        fig.add_annotation(
            text="Pas de données marginal_cost<br>hydro-réservoir",
            x=0.5, y=0.5, xref="x domain", yref="y domain",
            showarrow=False, font=dict(size=12, color="#888"),
            row=row, col=col,
        )
        return

    timestamps = network.snapshots[::ds]

    # Moyenne pondérée par p_nom
    pnoms = network.generators.loc[res_in_mc, "p_nom"]
    w = pnoms / pnoms.sum() if pnoms.sum() > 0 else pd.Series(1.0 / len(pnoms), index=pnoms.index)
    mc_weighted = (mc[res_in_mc] * w).sum(axis=1).reindex(timestamps).fillna(0)
    mc_min = mc[res_in_mc].min(axis=1).reindex(timestamps).fillna(0)
    mc_max = mc[res_in_mc].max(axis=1).reindex(timestamps).fillna(0)

    # Bande min-max
    fig.add_trace(
        go.Scatter(
            x=list(timestamps) + list(timestamps[::-1]),
            y=list(mc_max.values) + list(mc_min.values[::-1]),
            fill="toself", fillcolor="rgba(27,108,192,0.15)",
            line=dict(color="rgba(0,0,0,0)"),
            name="Plage min-max coût",
            legendgroup="res_cost", showlegend=False,
            hoverinfo="skip",
        ),
        row=row, col=col,
    )
    # Ligne coût moyen pondéré
    fig.add_trace(
        go.Scatter(
            x=timestamps, y=mc_weighted.values, mode="lines",
            name="Coût moyen réservoirs",
            line=dict(color="#1565C0", width=2),
            legendgroup="res_cost", showlegend=True,
            hovertemplate="<b>Water value</b><br>%{x}<br>%{y:.1f} $/MWh<extra></extra>",
        ),
        row=row, col=col,
    )

    # Seuil prix export (30 $/MWh) — au-dessus, le LP préfère importer
    fig.add_shape(
        type="line", x0=0, x1=1, y0=30, y1=30,
        xref="x domain",
        line=dict(color="#FF6347", dash="dot", width=1.5),
        row=row, col=col,
    )
    fig.add_annotation(
        x=timestamps[-1], y=30, text="Prix export (30 $/MWh)",
        showarrow=False, font=dict(size=9, color="#FF6347"),
        xanchor="right", yanchor="bottom",
        row=row, col=col,
    )

    fig.update_yaxes(title_text="$/MWh", row=row, col=col)


def _add_demand_heatmap(fig: Any, network: Any, row: int, col: int) -> None:
    """Panneau 8 : heatmap horaire OU profil hebdomadaire selon la résolution."""
    import plotly.graph_objects as go

    if not hasattr(network, "loads_t") or "p_set" not in network.loads_t:
        return
    demand = network.loads_t.p_set
    if demand.empty:
        return

    total_demand = demand.sum(axis=1) / 1e3  # GW
    if total_demand.empty:
        return

    n_snaps = len(network.snapshots)

    # --- Résolution hebdomadaire (≤ 53 snapshots) : barres par semaine ---
    if n_snaps <= 53:
        timestamps = network.snapshots
        fig.add_trace(
            go.Bar(
                x=timestamps,
                y=total_demand.values,
                marker=dict(
                    color=total_demand.values,
                    colorscale="Blues",
                    reversescale=True,
                    colorbar=dict(title="GW", x=1.02),
                ),
                name="Demande hebdo",
                showlegend=False,
                hovertemplate="Semaine: %{x}<br>Demande: %{y:.2f} GW<extra></extra>",
            ),
            row=row, col=col,
        )
        fig.update_xaxes(title_text="Semaine", row=row, col=col)
        fig.update_yaxes(title_text="GW", row=row, col=col)
        return

    # --- Résolution horaire : heatmap heures × jours ---
    df_ts = pd.DataFrame({"demand": total_demand.values}, index=network.snapshots)
    df_ts["date"] = df_ts.index.normalize()
    df_ts["hour"] = df_ts.index.hour

    pivot = df_ts.pivot_table(values="demand", index="date", columns="hour", aggfunc="mean")
    if pivot.empty:
        return

    if len(pivot) > 90:
        pivot = pivot.iloc[:90]

    fig.add_trace(
        go.Heatmap(
            z=pivot.values,
            x=[f"{h:02d}h" for h in pivot.columns],
            y=[str(d.date()) for d in pivot.index],
            colorscale="Blues",
            reversescale=True,
            colorbar=dict(title="GW", x=1.02),
            hovertemplate="Heure: %{x}<br>Jour: %{y}<br>Demande: %{z:.2f} GW<extra></extra>",
            showlegend=False,
        ),
        row=row, col=col,
    )
    fig.update_xaxes(title_text="Heure du jour", row=row, col=col)
    fig.update_yaxes(title_text="Jour", row=row, col=col)


# ---------------------------------------------------------------------------
# Helpers figures standalone (pour la méthode figures())
# ---------------------------------------------------------------------------

def _standalone_fig(add_fn, *args) -> Any:
    from plotly.subplots import make_subplots
    fig = make_subplots(rows=1, cols=1)
    add_fn(fig, *args, row=1, col=1)
    fig.update_layout(template=PLOTLY_TEMPLATE, height=400)
    return fig

def _standalone_donut(network) -> Any:
    from plotly.subplots import make_subplots
    fig = make_subplots(rows=1, cols=1, specs=[[{"type": "domain"}]])
    _add_carrier_donut(fig, network, row=1, col=1)
    fig.update_layout(template=PLOTLY_TEMPLATE, height=400)
    return fig


# ---------------------------------------------------------------------------
# Utilitaires
# ---------------------------------------------------------------------------

def _infer_label(network: Any) -> str:
    """Génère un label de période depuis les snapshots du réseau."""
    snaps = getattr(network, "snapshots", None)
    if snaps is None or len(snaps) == 0:
        return "Période inconnue"
    debut = snaps[0]
    fin   = snaps[-1]
    n = len(snaps)
    year = debut.year
    # Déterminer la résolution : si < 100 snapshots → hebdomadaire, sinon horaire
    if n <= 53:
        return f"Scénario #{1} — année {year} ({year})"
    else:
        return f"{debut.strftime('%d %b %Y')} → {fin.strftime('%d %b %Y')}  ({n} snapshots)"


# ---------------------------------------------------------------------------
# Fonction raccourci utilisable en une ligne
# ---------------------------------------------------------------------------

def plot_dispatch_results(
    network: Any,
    result: Dict[str, Any],
    label: str = "",
    output_path: Optional[str | Path] = None,
    show: bool = True,
) -> Path | None:
    """Raccourci one-liner pour générer et afficher le dashboard.

    Example
    -------
    >>> from harmoniq.modules.reseau_bis.viz import plot_dispatch_results
    >>> plot_dispatch_results(infra.network, result, label="Hiver 2035")

    Parameters
    ----------
    network : pypsa.Network résolu
    result  : dict retourné par calculer_production()
    label   : titre de la période (ex: "Hiver 2035 — Jan 13-26")
    output_path : si fourni, sauvegarde le HTML à cet emplacement
    show    : si True, ouvre le navigateur
    """
    viz = ReseauBisViz(network, result, label=label)
    saved_path = None
    if output_path:
        saved_path = viz.save(output_path)
    if show:
        viz.show()
    return saved_path
