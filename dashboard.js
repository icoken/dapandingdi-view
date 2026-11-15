"use strict";

const $ = (id) => document.getElementById(id);
const factors = [
  { name: "成交额", color: "#0c776b" },
  { name: "涨跌宽度", color: "#215f99" },
  { name: "涨停温度", color: "#a65a36" },
  { name: "均线偏离", color: "#765190" },
  { name: "股债比", color: "#557123" },
  { name: "新高动能", color: "#a74763" },
];

function marketZone(score) {
  if (score >= 80) return "顶部区";
  if (score >= 60) return "偏热";
  if (score >= 40) return "中性";
  if (score >= 20) return "偏冷";
  return "底部区";
}

function drawChart(chart, rows) {
  const { canvas, context, heading, column, cursor } = chart;
  const { width, height } = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  const canvasWidth = Math.round(width * pixelRatio);
  const canvasHeight = Math.round(height * pixelRatio);
  if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
  }
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  const left = 37;
  const right = width - 12;
  const top = 14;
  const bottom = height - 28;
  const plotWidth = right - left;
  const plotHeight = bottom - top;
  const xFor = (index) => left + index / Math.max(1, rows.length - 1) * plotWidth;
  const yFor = (score) => bottom - score / 100 * plotHeight;
  chart.geometry = { left, right, width };
  context.font = "11px Inter, 'Microsoft YaHei', sans-serif";
  context.textBaseline = "middle";

  if (heading === "温度") {
    context.fillStyle = "#eef6f1";
    context.fillRect(left, yFor(20), plotWidth, bottom - yFor(20));
    context.fillStyle = "#f8efea";
    context.fillRect(left, top, plotWidth, yFor(80) - top);
  }
  context.textAlign = "right";
  for (const tick of [0, 20, 40, 60, 80, 100]) {
    const y = yFor(tick);
    const reference = heading === "温度" && (tick === 20 || tick === 80);
    context.strokeStyle = reference ? (tick === 20 ? "#5c968c" : "#be8169") : "#e5ede9";
    context.setLineDash(reference ? [5, 4] : []);
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(right, y);
    context.stroke();
    context.fillStyle = "#586e68";
    context.fillText(String(tick), left - 8, y);
  }
  context.setLineDash([]);

  const tickCount = width < 480 ? 3 : 6;
  const positions = new Set();
  for (let i = 0; i < tickCount; i += 1) {
    positions.add(Math.round(i / (tickCount - 1) * (rows.length - 1)));
  }
  context.fillStyle = "#586e68";
  for (const i of positions) {
    let x = xFor(i);
    context.textAlign = "center";
    if (i === 0) {
      x = left;
      context.textAlign = "left";
    } else if (i === rows.length - 1) {
      x = right;
      context.textAlign = "right";
    }
    const date = rows[i][0];
    context.fillText(rows.length < 150 ? date.slice(5) : date.slice(0, 7), x, bottom + 17);
  }

  context.lineWidth = 1.7;
  context.strokeStyle = chart.color;
  context.lineJoin = "round";
  context.beginPath();
  rows.forEach((row, index) => {
    const x = xFor(index);
    const y = yFor(row[column]);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  context.lineWidth = 1;

  if (cursor === null) {
    chart.tip.hidden = true;
    return;
  }
  const row = rows[cursor];
  const x = xFor(cursor);
  const y = yFor(row[column]);
  context.strokeStyle = "#78918a";
  context.beginPath();
  context.moveTo(x, top);
  context.lineTo(x, bottom);
  context.stroke();
  context.fillStyle = chart.color;
  context.beginPath();
  context.arc(x, y, 4, 0, Math.PI * 2);
  context.fill();
  chart.tip.textContent = row[0] + "\n" + heading + " " + row[column].toFixed(1);
  chart.tip.hidden = false;
  const offset = Math.min(width - chart.tip.offsetWidth, x + 12);
  chart.tip.style.left = Math.max(0, offset) + "px";
}

function createChart(canvasId, tipId, heading, column, color, getRows) {
  const canvas = $(canvasId);
  const chart = {
    canvas,
    tip: $(tipId),
    context: canvas.getContext("2d"),
    cursor: null,
    heading,
    column,
    color,
  };
  function show(index) {
    if (chart.cursor === index) return;
    chart.cursor = index;
    drawChart(chart, getRows());
  }
  function selectPoint(event) {
    const { left, right } = chart.geometry;
    const x = event.clientX - canvas.getBoundingClientRect().left;
    const lastIndex = getRows().length - 1;
    const offset = Math.max(0, Math.min(1, (x - left) / (right - left)));
    show(Math.round(offset * lastIndex));
  }
  canvas.addEventListener("pointermove", selectPoint);
  canvas.addEventListener("pointerdown", selectPoint);
  canvas.addEventListener("pointerleave", () => show(null));
  canvas.addEventListener("blur", () => show(null));
  canvas.addEventListener("focus", () => show(getRows().length - 1));
  canvas.addEventListener("keydown", (event) => {
    const lastIndex = getRows().length - 1;
    let index = chart.cursor ?? lastIndex;
    switch (event.key) {
      case "ArrowLeft": index -= 1; break;
      case "ArrowRight": index += 1; break;
      case "Home": index = 0; break;
      case "End": index = lastIndex; break;
      default: return;
    }
    event.preventDefault();
    show(Math.max(0, Math.min(lastIndex, index)));
  });
  return chart;
}

function init(rows) {
  const latest = rows.at(-1);
  $("latest-date").dateTime = latest[0];
  $("latest-date").textContent = latest[0];
  $("latest-score").textContent = latest[1].toFixed(1);
  $("latest-zone").textContent = marketZone(latest[1]);
  $("all-dates").textContent = rows.length + " 个交易日 · " + rows[0][0] + " 至 " + latest[0];

  let visible = rows.slice(-250);
  const getRows = () => visible;
  const temperatureChart = createChart("temperature-chart", "temperature-tip", "温度", 1, "#087b70", getRows);
  const factorChart = createChart("factor-chart", "factor-tip", factors[0].name, 2, factors[0].color, getRows);
  const factorButtons = factors.map((factor, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-pressed", String(index === 0));
    button.style.setProperty("--factor", factor.color);
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.setAttribute("aria-hidden", "true");
    const value = document.createElement("span");
    value.className = "factor-value";
    value.textContent = latest[index + 2].toFixed(1);
    button.append(swatch, factor.name, value);
    button.addEventListener("click", () => {
      for (const item of factorButtons) {
        item.setAttribute("aria-pressed", String(item === button));
      }
      factorChart.heading = factor.name;
      factorChart.color = factor.color;
      factorChart.column = index + 2;
      factorChart.cursor = null;
      drawChart(factorChart, visible);
    });
    $("factors").append(button);
    return button;
  });

  function render() {
    $("visible-range").textContent = visible[0][0] + " 至 " + latest[0];
    drawChart(temperatureChart, visible);
    drawChart(factorChart, visible);
  }
  const periods = $("periods");
  periods.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-length]");
    if (!button) return;
    for (const item of periods.querySelectorAll("button")) {
      item.setAttribute("aria-pressed", String(item === button));
    }
    visible = button.dataset.length === "all" ? rows : rows.slice(-Number(button.dataset.length));
    temperatureChart.cursor = null;
    factorChart.cursor = null;
    render();
  });

  render();
  const observer = new ResizeObserver(render);
  observer.observe(temperatureChart.canvas);
  observer.observe(factorChart.canvas);
}

if (typeof marketTemperature !== "undefined" && marketTemperature.length) {
  init(marketTemperature);
} else {
  $("data-error").hidden = false;
}
