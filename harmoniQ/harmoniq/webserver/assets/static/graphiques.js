$('button[data-bs-target="#sankey"]').on('shown.bs.tab', function () {
    if (typeof demandeSankey === 'undefined' || demandeSankey === null) {
        return;
    }

    Plotly.Plots.resize('sankey-plot');
    Plotly.relayout('sankey-plot', { 'yaxis.autorange': true });
});

$('button[data-bs-target="#temporal"]').on('shown.bs.tab', function () {
    if (typeof demandeTemporal === 'undefined' || demandeTemporal === null) {
        return;
    }

    Plotly.Plots.resize('temporal-plot');
    Plotly.relayout('temporal-plot', { 'yaxis.autorange': true });
});


function generateSankey() {
    // Generate Sankey diagram
    const sectorLabels = Object.values(demandeSankey.sector);
    const energyLabels = ["Electricity", "Gaz"];
    const allLabels = energyLabels.concat(sectorLabels);

    const electricitySourceIndex = 0; // Electricité
    const gazSourceIndex = 1;         // Gaz

    const sources = [];
    const targets = [];
    const values = [];

    for (let i = 0; i < sectorLabels.length; i++) {
        const targetIndex = i + energyLabels.length;

        // Electricity to sector
        sources.push(electricitySourceIndex);
        targets.push(targetIndex);
        values.push(demandeSankey.total_electricity[i] / 1_000_000); // kWh → GWh

        // Gaz to sector
        sources.push(gazSourceIndex);
        targets.push(targetIndex);
        values.push(demandeSankey.total_gaz[i] / 1_000_000); // kWh → GWh
    }

    const sankeyData = [{
        type: "sankey",
        orientation: "h",
        node: {
            pad: 15,
            thickness: 20,
            label: allLabels
        },
        link: {
            source: sources,
            target: targets,
            value: values,
            hovertemplate: "%{source.label} → %{target.label}<br>%{value:.2f} GWh<extra></extra>"
        }
    }];

    const layout = {
        title: "Flux d'énergie vers les secteurs pour scénario " + $("#scenario-actif option:selected").text() + " (en GWh)",
        font: { size: 10 }
    };

    Plotly.newPlot("sankey-plot", sankeyData, layout);
}


function generateTemporalPlot() {
    const xval = Object.keys(demandeTemporal.total_electricity);
    const yval = Object.values(demandeTemporal.total_electricity).map(value => value/1000000);

    const layout = {
        title: "Demande pour scénario " + $("#scenario-actif option:selected").text(),
        xaxis: {
            title: "Date",
            tickformat: "%d %b %Y"
        },
        yaxis: {
            title: "Demande (GW)",
            autorange: true
        },
        legend: {
            orientation: "h",
            yanchor: "bottom",
            y: 1.02,
            xanchor: "right",
            x: 1
        },
    };

    const trace = {
        x: xval,
        y: yval,
        type: 'scatter',
        mode: 'lines',
        marker: { color: 'blue' },
        line: { shape: 'spline' },
        hovertemplate: "%{x}<br>%{y:.2f} GW<extra></extra>"
    };

    Plotly.newPlot("temporal-plot", [trace], layout);
}

function updateTemporalGraph() {
    const productionData = production.production;
    const x = productionData.map(d => d["snapshot"]);

    // Convertit MW → GW. Chaque snapshot hebdomadaire = puissance moyenne sur 168h.
    const toGW = key => productionData.map(d => ((d[key] ?? 0) / 1000));

    const traces = [
        { key: "total_hydro_reservoir", name: "Hydro (réservoir)", color: "#1565C0" },
        { key: "total_hydro_fil",        name: "Hydro (fil de l'eau)", color: "#2ECAD0" },
        { key: "total_eolien",           name: "Éolien",               color: "#FF9800" },
        { key: "total_solaire",          name: "Solaire",               color: "#FDD835" },
        { key: "total_nucleaire",        name: "Nucléaire",             color: "#E53935" },
        { key: "total_thermique",        name: "Thermique",             color: "#795548" },
        { key: "total_import",           name: "Importations",          color: "#9C27B0" },
        { key: "total_export",           name: "Exportations",          color: "#43A047", dash: "dash" },
        { key: "totale",                 name: "Production totale",     color: "#212121", dash: "dot" },
    ];

    const productionTraces = traces.map(t => ({
        x: x,
        y: toGW(t.key),
        type: "scatter",
        mode: "lines",
        name: t.name,
        line: { shape: "spline", color: t.color, dash: t.dash || "solid" },
        hovertemplate: "%{x}<br>%{y:.2f} GW<extra></extra>"
    }));

    // Superposer la demande si disponible (chargée via charger_demande)
    if (typeof demandeTemporal !== "undefined" && demandeTemporal && demandeTemporal.total_electricity) {
        productionTraces.unshift({
            x: Object.keys(demandeTemporal.total_electricity),
            // kWh/h → GW : kWh ÷ 1 000 = MWh, ÷ 1 000 = GWh ≡ GW (puissance moyenne horaire)
            y: Object.values(demandeTemporal.total_electricity).map(v => v / 1e6),
            type: "scatter",
            mode: "lines",
            name: "Demande",
            line: { shape: "spline", color: "#000000", width: 2 },
            hovertemplate: "%{x}<br>%{y:.2f} GW<extra></extra>"
        });
    }

    Plotly.purge("temporal-plot");
    Plotly.newPlot("temporal-plot", productionTraces, {
        title: "Production et Demande — " + $("#scenario-actif option:selected").text(),
        xaxis: { title: "Date", tickformat: "%d %b %Y" },
        yaxis: { title: "Puissance (GW)", autorange: true },
        legend: { orientation: "h", yanchor: "bottom", y: 1.02, xanchor: "right", x: 1 }
    });
}

function updateResultsPanel(data) {
    const summary    = data.summary    || {};
    const violations = data.violations || [];
    const infraReport = data.infra_report || [];
    const linkFlows  = data.link_flows  || [];

    // --- KPI cards ---
    const fmtTWh = v => (v != null) ? (v / 1e6).toFixed(2) + " TWh" : "—";
    const fmtPct = v => (v != null) ? v.toFixed(2) + " %" : "—";

    document.getElementById("kpi-energie").textContent   = fmtTWh(summary.total_energy_mwh);
    document.getElementById("kpi-imports").textContent   = fmtTWh(summary.total_import_mwh);
    document.getElementById("kpi-exports").textContent   = fmtTWh(summary.total_export_mwh);
    document.getElementById("kpi-pertes").textContent    = fmtPct(summary.losses_percent);
    document.getElementById("kpi-buses").textContent     = summary.n_buses  ?? "—";
    document.getElementById("kpi-lignes").textContent    = summary.n_lines  ?? "—";
    document.getElementById("kpi-violations").textContent = violations.length;
    document.getElementById("kpi-infra").textContent     = infraReport.length;

    document.getElementById("resultats-vide").style.display  = "none";
    document.getElementById("resultats-panel").style.display = "";

    // --- Flux d'interconnexions ---
    const lfBody = document.getElementById("linkflows-body");
    lfBody.innerHTML = "";
    linkFlows.forEach(lf => {
        lfBody.insertAdjacentHTML("beforeend", `<tr>
            <td>${lf.link}</td>
            <td>${(lf.total_export_mwh / 1e3).toFixed(1)}</td>
            <td>${(lf.total_import_mwh / 1e3).toFixed(1)}</td>
            <td>${(lf.max_export_mw ?? 0).toFixed(0)}</td>
            <td>${Math.abs(lf.max_import_mw ?? 0).toFixed(0)}</td>
        </tr>`);
    });
    document.getElementById("linkflows-section").style.display = linkFlows.length ? "" : "none";

    // --- Violations ---
    const vBody = document.getElementById("violations-body");
    vBody.innerHTML = "";
    violations.forEach(v => {
        vBody.insertAdjacentHTML("beforeend", `<tr>
            <td>${v.line}</td>
            <td>${(v.max_flow_mw ?? 0).toFixed(0)}</td>
            <td>${(v.s_nom_mva ?? 0).toFixed(0)}</td>
            <td class="text-danger fw-bold">${(v.loading_percent ?? 0).toFixed(1)} %</td>
        </tr>`);
    });
    document.getElementById("violations-section").style.display = violations.length ? "" : "none";

    // --- Renforcements ---
    const iBody = document.getElementById("infra-body");
    iBody.innerHTML = "";
    infraReport.forEach(r => {
        iBody.insertAdjacentHTML("beforeend", `<tr>
            <td>${r.line}</td>
            <td class="small">${r.bus0} → ${r.bus1}</td>
            <td>${r.voltage_kv ?? "—"}</td>
            <td>${r.nb_circuits_current}</td>
            <td>${r.nb_circuits_needed}</td>
            <td class="fw-bold text-warning">+${r.nb_circuits_to_add}</td>
            <td>${(r.s_nom_current_mva ?? 0).toFixed(0)}</td>
            <td>${(r.s_nom_needed_mva ?? 0).toFixed(0)}</td>
            <td>${(r.overload_pct ?? 0).toFixed(1)} %</td>
        </tr>`);
    });
    document.getElementById("infra-section").style.display = infraReport.length ? "" : "none";

    // Basculer automatiquement sur l'onglet Résultats
    const tab = document.getElementById("resultats-tab");
    if (tab) bootstrap.Tab.getOrCreateInstance(tab).show();
}