
(() => {
  "use strict";
  /* =====================================================
     CONFIGURATION & CONSTANTS
  ====================================================== */
  const CONFIG = {
    API_BASE: "https://crypto-proxy-mu.vercel.app/api",
    DEFAULT_LIMIT: 10,
    REQUEST_TIMEOUT: 8000,
    RATE_LIMIT_MS: 1200,
    EPSILON: 0.01,
    COLORS: {
      POSITIVE: "#107bc8",
      NEGATIVE: "#f2230c",
      ROW_UP: "rgba(16,123,200,0.2)",
      ROW_DOWN: "rgba(242,35,12,0.4)"
    },
    COIN_IMAGES: {
      BTC: "https://cdn.prod.website-files.com/692da341208bd018ee68185c/694e6d8249d779dd2e3173f6_image.avif",
      ETH: "https://cdn.prod.website-files.com/692da341208bd018ee68185c/694e77ba3aa2a97d283e9cae_ETH.avif",
      TRX: "https://cdn.prod.website-files.com/692da341208bd018ee68185c/694e77b97aecd1c5ceed8058_TRX.avif",
      BNB: "https://cdn.prod.website-files.com/692da341208bd018ee68185c/694e77b903421834fdb4397f_BNB.avif",
      USDC: "https://cdn.prod.website-files.com/692da341208bd018ee68185c/694e77b97d17f86e6ce3f0d0_USDC.avif",
      STETH: "https://cdn.prod.website-files.com/692da341208bd018ee68185c/694e77b953dc981582339710_STETH.avif",
      USDT: "https://cdn.prod.website-files.com/692da341208bd018ee68185c/694e77b9046f51c69195bad2_USDT.avif",
      DOGE: "https://cdn.prod.website-files.com/692da341208bd018ee68185c/694e77b9e99c1c8b94abcc4d_DOGE.avif",
      XRP: "https://cdn.prod.website-files.com/692da341208bd018ee68185c/694e77b9cdb3d2a8296965c3_XRP.avif",
      SOL: "https://cdn.prod.website-files.com/692da341208bd018ee68185c/694e77b9fbd123da76fa9e4c_SOL.avif"
    }
  };

  /* =====================================================
     UTILITIES
  ====================================================== */
  const Utils = {
    usd: v => "$" + Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    usdCompact: v => {
      const n = Number(v || 0);
      if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "T";
      if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
      if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
      if (n >= 1e3) return "$" + (n / 1e3).toFixed(2) + "K";
      return "$" + n.toFixed(2);
    },
    percent: v => Number(v || 0).toFixed(2) + "%",
    color: v => v >= 0 ? CONFIG.COLORS.POSITIVE : CONFIG.COLORS.NEGATIVE,
    sleep: ms => new Promise(r => setTimeout(r, ms))
  };

  /* =====================================================
     STORE
  ====================================================== */
  const Store = {
    assets: [],
    prices: {},
    changes24h: {}
  };

  /* =====================================================
     API LAYER
  ====================================================== */
  const Api = (() => {
    let lastRequest = 0;

    const buildUrl = (endpoint, params = {}) => {
      const query = new URLSearchParams({ endpoint, ...params }).toString();
      return `${CONFIG.API_BASE}?${query}`;
    };

    const request = async (endpoint, params = {}) => {
      const now = Date.now();
      if (now - lastRequest < CONFIG.RATE_LIMIT_MS) await Utils.sleep(CONFIG.RATE_LIMIT_MS);
      lastRequest = Date.now();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

      try {
        const res = await fetch(buildUrl(endpoint, params), { signal: controller.signal });
        if (!res.ok) throw new Error("API error");
        const json = await res.json();
        return json.data || json.candles || null;
      } catch {
        return null;
      } finally {
        clearTimeout(timeout);
      }
    };

    return {
      assets: limit => request("assets", { limit }),
      priceBySymbol: symbol => request(`price/bysymbol/${symbol}`),
      assetBySlug: slug => request(`assets/${slug}`),
			assetSearch: query => request("agentFriendly/assets_search", { search: query, limit: 5, sortBy: "marketCap", sortOrder: "desc" }),
  // ---  CHART ENDPOINTS ---
      history: (slug, interval, start, end) => 
          request(`assets/${slug}/history`, { interval, start, end }),

      candles: (slug, interval, start, end) => 
          request(`ta/${slug}/candlesticks`, { interval, start, end })
    };
  })();

  /* =====================================================
     RENDERERS
  ====================================================== */
  const Renderer = (() => {
    const flashRow = (row, up) => {
      row.style.backgroundColor = up ? CONFIG.COLORS.ROW_UP : CONFIG.COLORS.ROW_DOWN;
      setTimeout(() => row.style.backgroundColor = "", 600);
    };

    const renderMarket = assets => {
      let totalCap = 0, totalVol = 0, weighted = 0;
      let btc, eth;
      assets.forEach(a => {
        const mc = +a.marketCapUsd || 0;
        const vol = +a.volumeUsd24Hr || 0;
        const chg = +a.changePercent24Hr || 0;
        totalCap += mc;
        totalVol += vol;
        weighted += mc * chg;
        if (a.id === "bitcoin") btc = a;
        if (a.id === "ethereum") eth = a;
      });

      document.getElementById("global-market-cap").textContent = Utils.usdCompact(totalCap);
      document.getElementById("global-volume-24h").textContent = Utils.usdCompact(totalVol);
      document.getElementById("btc-dominance").textContent = btc ? Utils.percent((btc.marketCapUsd / totalCap) * 100) : "0%";
      document.getElementById("eth-dominance").textContent = eth ? Utils.percent((eth.marketCapUsd / totalCap) * 100) : "0%";

      const change = totalCap ? weighted / totalCap : 0;
      const changeEl = document.getElementById("market-cap-change");
      changeEl.textContent = Utils.percent(change);
      changeEl.style.color = Utils.color(change);
    };

    const renderCards = assets => {
      document.querySelectorAll(".coin-card").forEach((card, i) => {
        const a = assets[i];
        if (!a) return;
        
        card.dataset.slug = a.id;
        
        card.querySelector(".coin-card__rank").textContent = `${i + 1}.`;
        card.querySelector(".coin-card__name").textContent = a.name;
        card.querySelector(".coin-card__symbol").textContent = `[ ${a.symbol} ]`;
        card.querySelector(".coin-card__price").textContent = Utils.usd(a.priceUsd);
        card.querySelector(".coin-card__marketcap").textContent = Utils.usdCompact(a.marketCapUsd);
        const chgEl = card.querySelector(".coin-card__change");
        chgEl.textContent = Utils.percent(a.changePercent24Hr);
        chgEl.style.color = Utils.color(a.changePercent24Hr);
        const img = card.querySelector(".coin-card__image");
        img.src = CONFIG.COIN_IMAGES[a.symbol] || `https://assets.coincap.io/assets/icons/${a.symbol.toLowerCase()}@2x.png`;
        img.alt = a.name;
        card.setAttribute("aria-label",
        `View details for ${a.name} (${a.symbol}), price ${Utils.usd(a.priceUsd)}`
      	);
      });
    };

    const renderTable = assets => {
      const tbody = document.querySelector(".data-table__body");
      assets.forEach((a, i) => {
        let row = tbody.children[i];
        const price = +a.priceUsd;
        const old = Number(tbody.dataset["p" + i] || price);
        if (!row) {
          row = document.createElement("tr");
          row.className = "data-table__row";
          row.innerHTML = `
            <th class="table_cell rank"></th>
            <td class="table_cell name"></td>
            <td class="table_cell price"></td>
            <td class="table_cell change"></td>
            <td class="table_cell marketcap"></td>
            <td class="table_cell volume"></td>
            <td class="table_cell vwap"></td>
            <td class="table_cell supply"></td>
          `;
          tbody.appendChild(row);
        }
        
				row.dataset.slug = a.id;
        
        row.children[0].textContent = `${i + 1}.`;
        row.children[1].textContent = `${a.name} [${a.symbol}]`;
        row.children[2].textContent = Utils.usd(price);
        row.children[3].textContent = Utils.percent(a.changePercent24Hr);
        row.children[3].style.color = Utils.color(a.changePercent24Hr);
        row.children[4].textContent = Utils.usdCompact(a.marketCapUsd);
        row.children[5].textContent = Utils.usdCompact(a.volumeUsd24Hr);
        row.children[6].textContent = Utils.usdCompact(a.vwap24Hr);
        row.children[7].textContent = Utils.usdCompact(a.supply);

        if (Math.abs(price - old) > CONFIG.EPSILON) flashRow(row, price > old);
        tbody.dataset["p" + i] = price;
      });
    };

    return { renderMarket, renderCards, renderTable };
    
  })();

/* =====================================================
   DASHBOARD MANAGER (centralized show/hide)
===================================================== */
const DashboardManager = (() => {
  const dashboard = document.querySelector(".dashboard");
  const hiddenClass = "hidden";

  const hide = () => {
    if (!dashboard) return;
    dashboard.classList.add(hiddenClass);
    dashboard.setAttribute("aria-hidden", "true");
  };

  const show = () => {
    if (!dashboard) return;
    dashboard.classList.remove(hiddenClass);
    dashboard.setAttribute("aria-hidden", "false");
  };

  return { hide, show };
})();


/* =====================================================
     CHART MANAGER (Final: With 'No Data' Alert)
 ====================================================== */
const ChartManager = (() => {

    // --- CONFIGURATION ---
    const CHART_CONFIG = {
        MAX_FETCH: 10,
        DEFAULT_TF: '1D',
        TIMEFRAMES: {
            '1D': { days: 1, interval: 'h1' },
            '7D': { days: 7, interval: 'h1' },
            '1M': { days: 30, interval: 'h6' },
            '3M': { days: 90, interval: 'h12' },
            '1Y': { days: 365, interval: 'd1' }
        },
        COLORS: {
            UP: '#107bc8',       
            DOWN: '#f2230c',     
            AREA_TOP: 'rgba(16, 123, 200, 0.4)',
            AREA_BOTTOM: 'rgba(16, 123, 200, 0.0)',
            GRID: 'rgba(42, 46, 57, 0.1)',
            TEXT: '#e4e5f2'
        }
    };

    // --- STATE ---
    const state = {
        slug: null,
        type: 'area', 
        timeframe: CHART_CONFIG.DEFAULT_TF,
        fetchCount: 0,
        cache: new Map(),
        chart: null,
        series: null
    };

    // --- DOM ELEMENTS ---
    const container = document.getElementById("coin-detail-chart");
    const loader = document.getElementById("chart-loader");
    
    // Selectors
    const tfBtns = document.querySelectorAll("[data-interval]"); 
    const toggleBtn = document.querySelector("[data-chart-type]");

    // --- HELPERS ---
    const getRange = (tfKey) => {
        const conf = CHART_CONFIG.TIMEFRAMES[tfKey];
        if (!conf) return null;
        const end = Date.now();
        const start = end - (conf.days * 24 * 60 * 60 * 1000);
        return { start, end, interval: conf.interval };
    };

    const getCacheKey = () => `${state.slug}-${state.timeframe}-${state.type}`;

    const toggleLoader = (show) => {
        if (!loader) return;
        loader.style.display = show ? "flex" : "none";
        if (container) container.setAttribute("aria-busy", show);
    };

    const updateStats = (data) => {
        if (!data || data.length === 0) return;
        let min = Infinity;
        let max = -Infinity;

        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            const h = item.high !== undefined ? +item.high : +item.value;
            const l = item.low !== undefined ? +item.low : +item.value;
            if (h > max) max = h;
            if (l < min) min = l;
        }

        const panel = document.querySelector('.coin-detail'); 
        if (!panel) return;
        const highEl = panel.querySelector('[data-range="high"]');
        const lowEl = panel.querySelector('[data-range="low"]');
        if (highEl) highEl.textContent = Utils.usd(max);
        if (lowEl) lowEl.textContent = Utils.usd(min);
    };

    // --- CHART LIFECYCLE ---
    const initChart = () => {
        if (state.chart) return;
        if (!container) return;

        state.chart = LightweightCharts.createChart(container, {
            layout: { background: { type: 'solid', color: '#030407' }, textColor: CHART_CONFIG.COLORS.TEXT },
            grid: { vertLines: { visible: false }, horzLines: { color: CHART_CONFIG.COLORS.GRID } },
            rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } },
            timeScale: { borderVisible: false, timeVisible: true, secondsVisible: true },
            crosshair: { vertLine: { labelVisible: true } },
            autoSize: false
        });

        const resizeObserver = new ResizeObserver(entries => {
            if (!entries.length || !state.chart) return;
            const newRect = entries[0].contentRect;
            if (newRect.width > 0 && newRect.height > 0) {
                state.chart.applyOptions({ width: newRect.width, height: newRect.height });
            }
        });
        resizeObserver.observe(container);
    };

    const createSeries = () => {
        if (state.series) state.chart.removeSeries(state.series);

        if (state.type === 'candle') {
            state.series = state.chart.addSeries(LightweightCharts.CandlestickSeries, {
                upColor: CHART_CONFIG.COLORS.UP,
                downColor: CHART_CONFIG.COLORS.DOWN,
                borderVisible: false,
                wickUpColor: CHART_CONFIG.COLORS.UP,
                wickDownColor: CHART_CONFIG.COLORS.DOWN
            });
        } else {
            state.series = state.chart.addSeries(LightweightCharts.AreaSeries, {
                topColor: CHART_CONFIG.COLORS.AREA_TOP,
                bottomColor: CHART_CONFIG.COLORS.AREA_BOTTOM,
                lineColor: CHART_CONFIG.COLORS.UP,
                lineWidth: 2
            });
        }
    };

    // --- DATA FETCHING ---
    const loadData = async () => {
        if (!state.slug) return;
        const key = getCacheKey();

        if (state.cache.has(key)) {
            const cached = state.cache.get(key);
            updateChart(cached);
            updateStats(cached);
            return;
        }

        if (state.fetchCount >= CHART_CONFIG.MAX_FETCH) {
            alert("API Limit Reached");
            toggleLoader(false);
            return;
        }

        toggleLoader(true);
        const range = getRange(state.timeframe);
        if (!range) { console.error("Invalid timeframe"); toggleLoader(false); return; }
        
        try {
            state.fetchCount++;
            let data = [];
            
            if (state.type === 'candle') {
                const res = await Api.candles(state.slug, range.interval, range.start, range.end);
                if (res && Array.isArray(res)) {
                    data = res.map(c => ({
                        time: c.time / 1000, 
                        open: +c.open, high: +c.high, low: +c.low, close: +c.close
                    }));
                }
            } else {
                const res = await Api.history(state.slug, range.interval, range.start, range.end);
                if (res && Array.isArray(res)) {
                    data = res.map(p => ({
                        time: p.time / 1000, 
                        value: parseFloat(p.priceUsd)
                    }));
                }
            }

            if (data.length > 0) {
                state.cache.set(key, data);
                updateChart(data);
                updateStats(data);
            } else {
                // --- FIX: ALERT USER IF NO DATA ---
                clean(); 
                alert("No chart data available for this selection."); 
            }
        } catch (err) {
            console.error(err);
            clean();
            alert("Error loading chart data."); // Optional error alert
        } finally {
            toggleLoader(false);
        }
    };

    const updateChart = (data) => {
        if (!state.chart) initChart();
        createSeries();
        state.series.setData(data);
        state.chart.timeScale().fitContent();
    };

    // --- UI METHODS ---
    const updateUI = () => {
        tfBtns.forEach(b => {
            const tf = b.dataset.interval;
            const isActive = tf === state.timeframe;
            b.classList.toggle("is-active", isActive);
            b.setAttribute("aria-pressed", isActive);
        });

        if (toggleBtn) {
            const isCandle = state.type === 'candle';
            toggleBtn.classList.toggle("is-active", isCandle);
            toggleBtn.setAttribute("aria-pressed", isCandle);
            
            const knob = toggleBtn.querySelector('.chart-type__knob');
            if (knob) {
                knob.style.marginLeft = isCandle ? "1.5rem" : "0";
            }
        }
    };

    const setSlug = (slug) => {
        state.slug = slug;
        state.timeframe = CHART_CONFIG.DEFAULT_TF; 
        state.type = 'area'; 
        updateUI();
        loadData();
    };

    const setTimeframe = (tf) => {
        if (state.timeframe === tf) return;
        state.timeframe = tf;
        updateUI();
        loadData();
    };

    const toggleType = () => {
        const newType = state.type === 'area' ? 'candle' : 'area';
        state.type = newType;
        
        updateUI();
        clean(); 
        loadData();
    };

    const clean = () => {
        if (state.series) state.series.setData([]); 
    };

    // --- EVENT LISTENERS ---
    tfBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const tf = btn.dataset.interval; 
            setTimeframe(tf);
        });
    });

    if (toggleBtn) {
        toggleBtn.addEventListener("click", toggleType);
    }

    return { setSlug, clean };
})();
/* ===================================================== 
============ COIN DETAIL PANEL MODULE ==================== */

const CoinDetail = (() => {
    const panel = document.querySelector(".coin-detail");
    const dashboard = document.querySelector(".dashboard");
    const visibleClass = "visible"; // animation class
    const hiddenClass = "hidden"; // display: none
    const fields = Array.from(panel.querySelectorAll("[data-key]"));

    // INITIAL STATE (VERY IMPORTANT)
    panel.classList.add(hiddenClass);
    panel.setAttribute("aria-hidden", "true");

    // PLACEHOLDERS
    const setPlaceholders = () => {
        fields.forEach(f => {
            f.textContent = "—";
            if (f.dataset.key === "changePercent24Hr") {
                f.style.color = "";
            }
        });
    };

    // MAP API DATA
    const mapData = (data) => {
        fields.forEach(f => {
            const key = f.dataset.key;
            const value = data[key];
            if (value == null || value === "") {
                f.textContent = "—";
                return;
            }
            switch (key) {
                case "priceUsd":
                    f.textContent = Utils.usd(value);
                    break;
                case "marketCapUsd":
                case "volumeUsd24Hr":
                case "supply":
                case "maxSupply":
                    f.textContent = Utils.usdCompact(value);
                    break;
                case "changePercent24Hr":
                    f.textContent = Utils.percent(value);
                    f.style.color = Utils.color(value);
                    break;
                case "rank":
                    f.textContent = `${value}.`;
                    break;
                case "symbol":
                    f.textContent = `[ ${value} ]`;
                    break;
                default:
                    f.textContent = value;
            }
        });
    };

    // SHOW PANEL
    const showPanel = () => {
        // Make panel participate in layout
        panel.classList.remove(hiddenClass);
        panel.setAttribute("aria-hidden", "false");

        // Hide dashboard completely
        DashboardManager.hide();

        // Trigger animation
        requestAnimationFrame(() => {
            panel.classList.add(visibleClass);
        });
    };

    // HIDE PANEL
    const hidePanel = () => {
        panel.classList.remove(visibleClass);
        panel.setAttribute("aria-hidden", "true");
				ChartManager.clean();
        // After animation ends → remove from layout
        panel.addEventListener(
            "transitionend",
            () => panel.classList.add(hiddenClass),
            { once: true }
        );

        // Restore dashboard
        DashboardManager.show();
    };

    // OPEN PANEL
    const open = async (slug) => {
        if (!slug) return;
        setPlaceholders();
        showPanel();
        ChartManager.setSlug(slug);
        try {
            const coin = await Api.assetBySlug(slug);
            if (!coin) {
                console.error("Coin not found:", slug);
                return;
            }
            mapData(coin);
        } catch (err) {
            console.error("Coin detail error:", err);
        }
    };

    // CLOSE PANEL
    const close = () => hidePanel();
    const closeBtn = panel.querySelector(".coin-detail__close");
    if (closeBtn) closeBtn.addEventListener("click", close);

    // CENTRALIZED CLICK BINDING
    const bindCoinDetailClick = (selector) => {
        document.querySelectorAll(selector).forEach(el => {
            el.addEventListener("click", () => {
                const slug = el.dataset.slug;
                if (slug) open(slug);
            });
        });
    };

    return { open, close, bindCoinDetailClick };
})();



 /* =====================================================
     SEARCH
  ====================================================== */
const searchInput = document.querySelector('#coin-search');
const suggestionsList = document.querySelector('#search-suggestions');
let searchTimeout = null;

searchInput.addEventListener('input', e => {
  const query = e.target.value.trim();
  if (searchTimeout) clearTimeout(searchTimeout);

  if (!query) {
    suggestionsList.innerHTML = '';
    suggestionsList.setAttribute('aria-hidden', 'true');
    return;
  }

  searchTimeout = setTimeout(async () => {
    try {
      const data = await Api.assetSearch(query); 
 			if (!data) return;
 			suggestionsList.innerHTML = '';

      data.forEach(item => {
        const li = document.createElement('li');
        li.className = 'coin-search__suggestions-item';
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'coin-search__suggestions-link';
        a.textContent = `${item.name} [${item.symbol}]`;
        a.dataset.slug = item.slug;
        li.appendChild(a);
        suggestionsList.appendChild(li);
      });

      suggestionsList.setAttribute('aria-hidden', 'false');

    } catch (err) {
      console.error("Search error:", err);
    }
  }, 300); // debounce
});

suggestionsList.addEventListener('click', e => {
  const link = e.target.closest('.coin-search__suggestions-link');
  if (!link) return;
  e.preventDefault();

  const slug = link.dataset.slug;
  if (!slug) return;

  CoinDetail.open(slug);
  suggestionsList.innerHTML = '';
  suggestionsList.setAttribute('aria-hidden', 'true');
  searchInput.value = '';
});  
const searchWrapper = document.querySelector('#search-suggestion-wrapper');
document.addEventListener('click', e => {
  if (!searchWrapper.contains(e.target)) {
    suggestionsList.innerHTML = '';
    suggestionsList.setAttribute('aria-hidden', 'true');
    searchInput.value = '';
  }
});

  /* =====================================================
     PORTFOLIO
  ====================================================== */
  const Portfolio = (() => {
    const items = [];
    const priceCache = {};

    const add = async (symbol, qty, cost) => {
      symbol = symbol.toUpperCase();
      let price = Store.prices[symbol] || priceCache[symbol];

      if (!price) {
        const res = await Api.priceBySymbol(symbol);
        price = Number(res?.[0]);
        if (!price) return alert("Coin not found");
        priceCache[symbol] = price;
      }

      items.push({
        symbol, qty, price, cost,
        change24h: Store.changes24h[symbol] || 0
      });
      render();
    };

    const render = () => {
      const body = document.getElementById("portfolio-table-body");
      const defaultRow = body.querySelector(".default-row");
      body.querySelectorAll("tr:not(.default-row)").forEach(r => r.remove());

      let invested = 0, value = 0, change24h = 0;
      items.forEach((i, idx) => {
        const v = i.price * i.qty;
        invested += i.cost * i.qty;
        value += v;
        change24h += v * (i.change24h / 100);

        const row = document.createElement("tr");
        row.innerHTML = `
          <td class="table_cell">${i.symbol}</td>
          <td class="table_cell">${Utils.usd(i.price)}</td>
          <td class="table_cell">${i.qty}</td>
          <td class="table_cell">${Utils.usd(v)}</td>
          <td class="table_cell is-remove-btn" data-i="${idx}">
          <button class="remove-btn" >
          <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 30 30" fill="none" class="remove-btn__icon">
          <path d="M6.25 15H23.75" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg></button>
          </td>
        `;
        body.appendChild(row);
      });

      if (defaultRow) defaultRow.style.display = items.length ? "none" : "table-row";

      document.getElementById("portfolio-total-invested").textContent =  Utils.usdCompact(invested);
      document.getElementById("portfolio-total-value").textContent =  Utils.usdCompact(value);

      const pnl = value - invested;
      const pnlEl = document.getElementById("portfolio-total-pnl");
      pnlEl.textContent = `${ Utils.usdCompact(pnl)} (${invested ? (pnl / invested * 100).toFixed(2) : 0}%)`;
      pnlEl.style.color = Utils.color(pnl);

      const chgEl = document.getElementById("portfolio-24h-change");
      chgEl.textContent = `${value ? (change24h / value * 100).toFixed(2) : 0}%`;
      chgEl.style.color = Utils.color(change24h);
    };

    return { add, render, items };
  })();

  /* =====================================================
     LAYOUT SWITCH
  ====================================================== */

const LayoutSwitch = (() => {
    const wrap = document.querySelector(".coin-layout");
    if (!wrap) return { init: () => {}, toggle: () => {} };

    const table = wrap.querySelector(".data-table");
    const grid = wrap.querySelector(".coin-grid");
    const switchBtn = document.querySelector(".layout-switch__toggle");
    
    const STORAGE_KEY = "coin_layout_preference";
    const DEFAULT_LAYOUT = "table";

    const updateAria = (isTable) => {
        if (!switchBtn) return;
        switchBtn.setAttribute("aria-pressed", isTable ? "false" : "true");
        switchBtn.setAttribute("aria-label", isTable ? "Switch to card view" : "Switch to table view");
    };

    const init = () => {
        if (!table || !grid || !switchBtn) return;

        const saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_LAYOUT;
        const isTable = saved === "table";

        table.classList.toggle("is-active", isTable);
        grid.classList.toggle("is-active", !isTable);
        switchBtn.classList.toggle("is-active", !isTable);

        if (isTable) {
            grid.setAttribute("inert", "");
            table.removeAttribute("inert");
        } else {
            table.setAttribute("inert", "");
            grid.removeAttribute("inert");
        }

        wrap.style.height = "auto";
        wrap.classList.add("is-ready");
        
        updateAria(isTable);
    };

    const toggle = () => {
        if (!table || !grid || !switchBtn) return;

        wrap.style.height = wrap.offsetHeight + "px";

        const showingTable = table.classList.contains("is-active");
        const next = showingTable ? grid : table;
        const current = showingTable ? table : grid;

        table.classList.remove("is-active");
        grid.classList.remove("is-active");
        switchBtn.classList.toggle("is-active");

        void wrap.offsetHeight; 

        next.classList.add("is-active");
        wrap.style.height = next.scrollHeight + "px";

        current.setAttribute("inert", "");
        next.removeAttribute("inert");

        localStorage.setItem(STORAGE_KEY, showingTable ? "card" : "table");
        updateAria(!showingTable);

        const cleanup = (e) => {
             if (e.target !== wrap) return; 
             wrap.style.height = "auto";
             wrap.removeEventListener("transitionend", cleanup);
        };
        wrap.addEventListener("transitionend", cleanup);
    };

    if (switchBtn) switchBtn.addEventListener("click", toggle);
    document.addEventListener("DOMContentLoaded", init);

    return { init, toggle };
})();

  /* =====================================================
     AUTO REFRESH
  ====================================================== */
  const AutoRefresh = (() => {
    let timer = null;
    let count = 0;
    const MAX_COUNT = 10;

    const set = sec => {
      clearInterval(timer);
      count = 0;

      timer = setInterval(async () => {
        if (count >= MAX_COUNT) {
          clearInterval(timer);
          alert(`Auto-refresh disabled after ${MAX_COUNT} updates per session.`);
          return;
        }
        count++;
        await App.init(true);
      }, sec * 1000);
    };

    return { set };
  })();

  /* =====================================================
     APP INIT
  ====================================================== */
  const App = (() => {
    let isFirstLoad = true;

    const init = async (isAuto = false) => {
      const loader = document.getElementById("crypto-loader");
      if (!isAuto && isFirstLoad && loader) loader.style.display = "flex";
			if (isFirstLoad) DashboardManager.hide();
      
      try {
        const assets = await Api.assets(CONFIG.DEFAULT_LIMIT);
        if (!assets) return;
        Store.assets = assets;
        assets.forEach(a => {
          Store.prices[a.symbol] = +a.priceUsd;
          Store.changes24h[a.symbol] = +a.changePercent24Hr;
        });

        Renderer.renderMarket(assets);
        Renderer.renderCards(assets);
        Renderer.renderTable(assets);
        
        CoinDetail.bindCoinDetailClick(".coin-card");
        CoinDetail.bindCoinDetailClick(".data-table__row");
       

    

      } catch (err) {
        console.error("Crypto init failed:", err);
      } finally {
        if (isFirstLoad && loader) {
          loader.style.display = "none";
           DashboardManager.show();
          isFirstLoad = false;
        }
        document.getElementById("last-updated").textContent = new Date().toLocaleTimeString();
      }
    };

    return { init };
  })();

  /* =====================================================
     PORTFOLIO CALCULATOR
  ====================================================== */
  document.addEventListener("DOMContentLoaded", () => {
    App.init();

    const modal = document.getElementById("portfolioModal");
    const calcBtn = document.querySelector(".portfolio-trigger");
    const closeBtn = modal.querySelector(".portfolio-modal__close");
    const coinInput = modal.querySelector(".portfolio_coin_input");
    const qtyInput = modal.querySelector(".portfolio_qnt_input");
    const costInput = modal.querySelector(".portfolio_cost_input");
    const addBtn = modal.querySelector(".portfolio_add-button");
    const tableBody = document.getElementById("portfolio-table-body");

    /* Modal */
    const openModal = () => { modal.showModal(); requestAnimationFrame(() => document.body.classList.add("modal-open")); };
    const closeModal = () => {
      modal.classList.add("closing");
      modal.addEventListener("animationend", () => {
        modal.classList.remove("closing");
        modal.close();
        document.body.classList.remove("modal-open");
      }, { once: true });
    };
    calcBtn.addEventListener("click", openModal);
    closeBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
    modal.addEventListener("cancel", e => { e.preventDefault(); closeModal(); });

    /* Portfolio add/remove */
    const addCoin = async () => {
      const symbol = coinInput.value.trim();
      const qty = parseFloat(qtyInput.value);
      const cost = parseFloat(costInput.value);
      if (!symbol || qty <= 0 || cost <= 0) return;
      await Portfolio.add(symbol, qty, cost);
      coinInput.value = ""; qtyInput.value = ""; costInput.value = "";
    };
    addBtn.addEventListener("click", addCoin);
    [coinInput, qtyInput, costInput].forEach(input => {
      input.addEventListener("keydown", e => { if (e.key === "Enter") addCoin(); });
    });

    tableBody.addEventListener("click", e => {
      const btn = e.target.closest(".remove-btn");
      if (!btn) return;
      Portfolio.items.splice(btn.dataset.i, 1);
      Portfolio.render();
    });
    
/* =====================================================
     Auto refresh 
  ====================================================== */
    const label = document.getElementById("dropdown-label");
    const options = document.querySelectorAll(".refresh__option");
    let refreshInterval = Number(localStorage.getItem("refreshInterval")) || 15;
    label.textContent = `${refreshInterval}s`;
    label.dataset.value = refreshInterval;
    options.forEach(option => {
      option.addEventListener("click", () => {
        const sec = Number(option.dataset.value);
        label.textContent = `${sec}s`;
        label.dataset.value = sec;
        localStorage.setItem("refreshInterval", sec);
        AutoRefresh.set(sec);
      });
    });

    AutoRefresh.set(refreshInterval);
  });
console.log("✅ Custom JS loaded and DOM is ready");
})();
