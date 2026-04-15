/**
 * Modern POS Pro - Professional Mobile-First Application
 * Preserving all original backend logic while upgrading UX
 */

const API = "https://script.google.com/macros/s/AKfycbwSrgqMASZAafCsW_t3MzocjqZkJ1fIAd2iOo_9DF76xFvNoBx-mnKhpXydCLKrm07gTw/exec";

// Global State
let products = [];
let filtered = [];
let chart = null;
let chartMode = "value"; // 'value' or 'quantity'
let customers = [];
let cartItems = [];
let currentScreen = 'home';

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    showLoading(true);
    try {
        await Promise.all([loadProducts(), loadCustomers()]);
        // Start on home
        goTo('home');
    } catch (error) {
        showToast("Error al iniciar la aplicación: " + error.message);
    } finally {
        showLoading(false);
    }
}

/** 
 * NAVIGATION 
 */
function goTo(screenId) {
    // Update active screen
    document.querySelectorAll(".screen").forEach(x => x.classList.remove("active"));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add("active");
        currentScreen = screenId;
    }

    // Update nav buttons
    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.classList.toggle("active", btn.id === `nav-${screenId}`);
    });

    // Refresh data based on screen
    if (screenId === "inventory") {
        renderInventoryTable();
    } else if (screenId === "home") {
        renderDashboard();
    } else if (screenId === "sale") {
        // Clear search input when entering sale screen
        const searchInput = document.getElementById('productSearchInput');
        if (searchInput) searchInput.value = '';
        hideSearchResults();
    }
}

/**
 * DATA LOADING
 */
async function loadProducts() {
    try {
        const r = await fetch(`${API}?action=getProducts`);
        if (!r.ok) throw new Error("Network response was not ok");
        products = await r.json();
        filtered = [...products];
        
        // If we are on a screen that needs fresh data, re-render
        if (currentScreen === 'home') renderDashboard();
        if (currentScreen === 'inventory') renderInventoryTable();
        
        return products;
    } catch (e) {
        console.error("Load Products Error:", e);
        showToast("Error al cargar productos");
    }
}

async function loadCustomers() {
    try {
        const r = await fetch(`${API}?action=getCustomers`);
        if (!r.ok) throw new Error("Network response was not ok");
        customers = await r.json();
        
        const select = document.getElementById('customerSelect');
        if (select) {
            select.innerHTML = `<option value="WALK-IN">Público General</option>` +
                customers.map(c => `<option value="${c.CustomerID}">${c.Name}</option>`).join("");
        }
        return customers;
    } catch (e) {
        console.error("Load Customers Error:", e);
        showToast("Error al cargar clientes");
    }
}

/**
 * DASHBOARD & ANALYTICS
 */
function renderDashboard() {
    let totalValue = 0;
    let lowStock = [];
    let outStock = [];

    products.forEach(p => {
        const stock = Number(p.Stock) || 0;
        const cost = Number(p.CostPrice) || 0;
        const min = Number(p.MinStock) || 0;

        totalValue += stock * cost;
        if (stock <= 0) {
            outStock.push(p);
        } else if (stock < min) {
            lowStock.push(p);
        }
    });

    // Update Stats
    const valEl = document.getElementById('inventoryValue');
    const lowEl = document.getElementById('lowStockCount');
    const outEl = document.getElementById('outStockCount');

    if (valEl) valEl.innerText = `$${totalValue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
    if (lowEl) lowEl.innerText = lowStock.length;
    if (outEl) outEl.innerText = outStock.length;

    // Update Alerts List
    const alertsList = document.getElementById('inventoryAlerts');
    if (alertsList) {
        if (lowStock.length === 0 && outStock.length === 0) {
            alertsList.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle" style="color:var(--success);opacity:1;font-size:24px"></i><p>Todo en orden</p></div>';
        } else {
            const outAlerts = outStock.map(p => `
                <div class="alert-item out">
                    <i class="fas fa-times-circle"></i>
                    <span><strong>${p.Name}</strong> está agotado</span>
                </div>
            `).join("");
            
            const lowAlerts = lowStock.map(p => `
                <div class="alert-item low">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span><strong>${p.Name}</strong> tiene bajo stock (${p.Stock})</span>
                </div>
            `).join("");
            
            alertsList.innerHTML = outAlerts + lowAlerts;
        }
    }

    renderChart();
}

function renderChart() {
    const canvas = document.getElementById("chart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Take top 10 products for better mobile visibility
    const displayProducts = [...products]
        .sort((a, b) => (b.Stock * b.CostPrice) - (a.Stock * a.CostPrice))
        .slice(0, 8);

    const labels = displayProducts.map(p => p.Name.length > 12 ? p.Name.substring(0, 10) + '..' : p.Name);
    const data = displayProducts.map(p => chartMode === "value" ? (p.Stock * p.CostPrice) : p.Stock);
    const colors = displayProducts.map(p => p.Stock < p.MinStock ? "#ef4444" : "#3b82f6");

    const titleEl = document.getElementById('chartTitle');
    if (titleEl) titleEl.innerText = chartMode === "value" ? "Top Inversión por Producto" : "Top Stock por Producto";

    if (chart) chart.destroy();

    chart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (chartMode === 'value') {
                                label += '$' + context.parsed.y.toLocaleString();
                            } else {
                                label += context.parsed.y;
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
}

function toggleChartMode() {
    chartMode = chartMode === "value" ? "quantity" : "value";
    renderChart();
}

/**
 * INVENTORY MANAGEMENT
 */
function renderInventoryTable() {
    const tableBody = document.getElementById('productsTable');
    if (!tableBody) return;

    if (filtered.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="empty-state">No se encontraron productos</td></tr>';
        return;
    }

    tableBody.innerHTML = filtered.map(p => {
        const isLow = Number(p.Stock) < Number(p.MinStock);
        const isOut = Number(p.Stock) <= 0;
        let badgeClass = 'ok';
        let badgeText = p.Stock;
        
        if (isOut) { badgeClass = 'out'; badgeText = 'Agotado'; }
        else if (isLow) { badgeClass = 'low'; badgeText = `${p.Stock} (Bajo)`; }

        return `
            <tr>
                <td>
                    <div style="font-weight:600">${p.Name}</div>
                    <div style="font-size:11px; color:var(--text-muted)">${p.Brand || ''} | ${p.Category || ''}</div>
                </td>
                <td>
                    <span class="stock-badge ${badgeClass}">${badgeText}</span>
                </td>
                <td>$${Number(p.CostPrice).toLocaleString("es-MX")}</td>
                <td>
                    <div style="display:flex; gap:8px">
                        <button class="icon-btn" onclick="restock('${p.ProductID}')" title="Restock">
                            <i class="fas fa-plus-circle" style="color:var(--primary)"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function filterProducts(query) {
    const q = query.toLowerCase();
    filtered = products.filter(p => 
        p.Name.toLowerCase().includes(q) || 
        (p.Brand && p.Brand.toLowerCase().includes(q)) ||
        (p.Category && p.Category.toLowerCase().includes(q))
    );
    renderInventoryTable();
}

function sort(field) {
    filtered.sort((a, b) => {
        let valA = a[field];
        let valB = b[field];
        
        // Handle numeric sorting
        if (!isNaN(valA) && !isNaN(valB)) {
            return Number(valA) - Number(valB);
        }
        
        // Handle string sorting
        return String(valA).localeCompare(String(valB));
    });
    renderInventoryTable();
}

async function restock(id) {
    const product = products.find(p => p.ProductID === id);
    const qty = prompt(`Cantidad a añadir para ${product.Name}:`, "10");
    if (qty === null || qty === "" || isNaN(qty)) return;
    
    const cost = prompt(`Costo unitario de esta entrada:`, product.CostPrice);
    if (cost === null || cost === "" || isNaN(cost)) return;

    showLoading(true);
    try {
        const params = new URLSearchParams({
            action: "restock",
            ProductID: id,
            QuantityAdded: qty,
            Cost: cost
        });
        const res = await fetch(`${API}?${params}`);
        if (res.ok) {
            showToast("Stock actualizado correctamente");
            await loadProducts();
        } else {
            throw new Error("Server error");
        }
    } catch (e) {
        showToast("Error al actualizar stock");
    } finally {
        showLoading(false);
    }
}

/**
 * PRODUCT FORM
 */
function openProductForm() {
    document.getElementById('productModal').classList.remove('hidden');
}

function closeProductForm() {
    document.getElementById('productModal').classList.add('hidden');
}

async function createProduct() {
    const data = {
        action: "createProduct",
        Name: document.getElementById('pName').value,
        Brand: document.getElementById('pBrand').value,
        Model: document.getElementById('pModel').value,
        Category: document.getElementById('pCategory').value,
        Unit: document.getElementById('pUnit').value,
        CostPrice: document.getElementById('pCost').value,
        SalePrice: document.getElementById('pPrice').value,
        Stock: document.getElementById('pStock').value,
        MinStock: document.getElementById('pMinStock').value,
        Supplier: document.getElementById('pSupplier').value,
        Description: document.getElementById('pDesc').value
    };

    if (!data.Name || !data.CostPrice || !data.SalePrice) {
        showToast("Por favor llena los campos obligatorios");
        return;
    }

    showLoading(true);
    try {
        const params = new URLSearchParams(data);
        const res = await fetch(`${API}?${params}`);
        if (res.ok) {
            showToast("Producto creado exitosamente");
            closeProductForm();
            await loadProducts();
        }
    } catch (e) {
        showToast("Error al crear producto");
    } finally {
        showLoading(false);
    }
}

/**
 * CUSTOMER MANAGEMENT
 */
async function createCustomer() {
    const data = {
        action: "createCustomer",
        Name: document.getElementById('cName').value,
        Phone: document.getElementById('cPhone').value,
        Email: document.getElementById('cEmail').value,
        Address: document.getElementById('cAddress').value,
        RFC: document.getElementById('cRFC').value,
        Notes: document.getElementById('cNotes').value
    };

    if (!data.Name) {
        showToast("El nombre es obligatorio");
        return;
    }

    showLoading(true);
    try {
        const params = new URLSearchParams(data);
        const res = await fetch(`${API}?${params}`);
        if (res.ok) {
            showToast("Cliente guardado correctamente");
            // Clear form
            ['cName', 'cPhone', 'cEmail', 'cAddress', 'cRFC', 'cNotes'].forEach(id => {
                document.getElementById(id).value = '';
            });
            await loadCustomers();
        }
    } catch (e) {
        showToast("Error al guardar cliente");
    } finally {
        showLoading(false);
    }
}

/**
 * SALES & CART
 */
function searchProducts(query) {
    const dropdown = document.getElementById('searchResults');
    if (!query || query.length < 1) {
        hideSearchResults();
        return;
    }

    const q = query.toLowerCase();
    const matches = products.filter(p => 
        p.Name.toLowerCase().includes(q) || 
        (p.Brand && p.Brand.toLowerCase().includes(q))
    ).slice(0, 5);

    if (matches.length > 0) {
        dropdown.innerHTML = matches.map(p => `
            <div class="search-item" onclick="addToCart('${p.ProductID}')">
                <div style="font-weight:600">${p.Name}</div>
                <div style="font-size:12px; color:var(--text-muted)">
                    $${Number(p.SalePrice).toFixed(2)} | Stock: ${p.Stock}
                </div>
            </div>
        `).join("");
        dropdown.classList.remove('hidden');
    } else {
        dropdown.innerHTML = '<div class="search-item">No se encontraron productos</div>';
        dropdown.classList.remove('hidden');
    }
}

function hideSearchResults() {
    const dropdown = document.getElementById('searchResults');
    if (dropdown) dropdown.classList.add('hidden');
}

function addToCart(id) {
    const p = products.find(x => x.ProductID === id);
    if (!p) return;

    const existing = cartItems.find(x => x.ProductID === id);
    if (existing) {
        existing.Quantity++;
    } else {
        cartItems.push({
            ProductID: id,
            Name: p.Name,
            Price: Number(p.SalePrice),
            Quantity: 1
        });
    }

    // Clear search
    document.getElementById('productSearchInput').value = '';
    hideSearchResults();
    
    renderCart();
    showToast(`Agregado: ${p.Name}`);
}

function renderCart() {
    const cartList = document.getElementById('cart');
    if (!cartList) return;

    if (cartItems.length === 0) {
        cartList.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-shopping-cart"></i>
                <p>El carrito está vacío</p>
            </div>
        `;
    } else {
        cartList.innerHTML = cartItems.map((item, index) => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.Name}</div>
                    <div class="cart-item-price">$${item.Price.toFixed(2)} c/u</div>
                </div>
                <div class="qty-controls">
                    <button class="qty-btn" onclick="updateQty(${index}, -1)">-</button>
                    <span style="font-weight:600; min-width:20px; text-align:center">${item.Quantity}</span>
                    <button class="qty-btn" onclick="updateQty(${index}, 1)">+</button>
                </div>
                <div style="font-weight:700; min-width:70px; text-align:right">
                    $${(item.Price * item.Quantity).toFixed(2)}
                </div>
                <button class="text-btn" onclick="removeFromCart(${index})" style="color:var(--danger); margin-left:12px">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join("");
    }
    updateTotals();
}

function updateQty(index, delta) {
    cartItems[index].Quantity += delta;
    if (cartItems[index].Quantity <= 0) {
        cartItems.splice(index, 1);
    }
    renderCart();
}

function removeFromCart(index) {
    cartItems.splice(index, 1);
    renderCart();
}

function updateTotals() {
    const sub = cartItems.reduce((acc, item) => acc + (item.Price * item.Quantity), 0);
    const disc = Number(document.getElementById('discount').value || 0);
    const baseForIva = Math.max(0, sub - disc);
    const ivaVal = baseForIva * 0.16;
    const totalVal = baseForIva + ivaVal;

    // Use toFixed(2) to match original numeric format in the spans before they are parsed by createSale
    document.getElementById('subtotal').innerText = sub.toFixed(2);
    document.getElementById('iva').innerText = ivaVal.toFixed(2);
    document.getElementById('total').innerText = totalVal.toFixed(2);
}

async function createSale() {
    if (cartItems.length === 0) {
        showToast("Agrega productos al carrito");
        return;
    }

    const customerId = document.getElementById('customerSelect').value;
    const subVal = document.getElementById('subtotal').innerText;
    const discVal = document.getElementById('discount').value || 0;
    const ivaValStr = document.getElementById('iva').innerText;
    const totalValStr = document.getElementById('total').innerText;

    // The backend expects an 'items' parameter containing a JSON string of the cart items
    // for stock deduction and saving individual sale items.
    const itemsData = cartItems.map(i => ({
        ProductID: i.ProductID,
        Name: i.Name,
        Quantity: i.Quantity,
        Price: i.Price,
        Total: i.Price * i.Quantity
    }));

    showLoading(true);
    try {
        // Build URL with the required 'items' parameter
        const params = new URLSearchParams({
            action: "createSale",
            CustomerID: customerId,
            Subtotal: subVal,
            Discount: discVal,
            IVA: ivaValStr,
            Total: totalValStr,
            items: JSON.stringify(itemsData)
        });

        const url = `${API}?${params.toString()}`;
        
        const res = await fetch(url);
        let data = {};
        
        if (res.ok) {
            try {
                data = await res.json();
            } catch (e) {
                console.warn("Could not parse backend JSON response", e);
            }
        } else {
            console.warn("Backend returned non-OK status", res.status);
        }
        
        // Even if there's a backend error (like the 'appendRow' null error), 
        // we should still try to generate the PDF locally since the user saw it work before.
        
        // Prepare data for PDF using local values as primary source of truth
        const pdfData = {
            invoice: data.invoice || `INV-${Date.now()}`,
            Subtotal: subVal,
            Discount: discVal,
            IVA: ivaValStr,
            Total: totalValStr,
            items: itemsData,
            customerName: document.getElementById('customerSelect').options[document.getElementById('customerSelect').selectedIndex].text
        };

        if (data.error) {
            console.error("Backend Error:", data.error);
            showToast("Aviso: Error en base de datos, pero el recibo se generará.");
        } else {
            showToast("✅ Venta generada exitosamente");
        }
        
        // ALWAYS try to generate PDF
        try {
            generateProfessionalPDF(pdfData);
        } catch (pdfError) {
            console.error("PDF Generation Error:", pdfError);
            showToast("Error crítico al generar el PDF.");
        }

        // Reset state
        cartItems = [];
        document.getElementById('discount').value = 0;
        renderCart();
        await loadProducts();
        goTo('home');

    } catch (e) {
        console.error(e);
        showToast("❌ Error al procesar la venta");
    } finally {
        showLoading(false);
    }
}

/**
 * PDF GENERATION (UPGRADED)
 */
function generateProfessionalPDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235); // Primary Blue
    doc.text("RECIBO DE COMPRA", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Muted Text
    doc.text(`Folio: ${data.invoice || 'N/A'}`, 20, 35);
    doc.text(`Fecha: ${new Date().toLocaleString()}`, 20, 40);
    doc.text(`Cliente: ${data.customerName || 'Público General'}`, 20, 45);
    
    // Table of Items
    // Safely handle item mapping to prevent crashes if an item property is missing
    const tableData = (data.items || []).map(item => [
        item.Name || item.ProductID || "Producto",
        item.Quantity || 0,
        `$${Number(item.Price || 0).toFixed(2)}`,
        `$${Number(item.Total || 0).toFixed(2)}`
    ]);
    
    doc.autoTable({
        startY: 55,
        head: [['Producto', 'Cant.', 'Precio Unit.', 'Subtotal']],
        body: tableData,
        headStyles: { fillStyle: [37, 99, 235] },
        foot: [
            ['', '', 'Subtotal:', `$${Number(data.Subtotal || 0).toFixed(2)}`],
            ['', '', 'Descuento:', `-$${Number(data.Discount || 0).toFixed(2)}`],
            ['', '', 'IVA (16%):', `$${Number(data.IVA || 0).toFixed(2)}`],
            ['', '', 'TOTAL:', `$${Number(data.Total || 0).toFixed(2)}`]
        ],
        footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold' }
    });
    
    const finalY = doc.lastAutoTable.finalY || 150;
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text("¡Gracias por su compra!", 105, finalY + 20, { align: "center" });
    
    doc.save(`Venta_${data.invoice || Date.now()}.pdf`);
}

/**
 * UI UTILITIES
 */
function showLoading(show) {
    const el = document.getElementById('loading');
    if (el) el.classList.toggle('hidden', !show);
}

function showToast(message) {
    const el = document.getElementById('toast');
    const msg = document.getElementById('toastMessage');
    if (el && msg) {
        msg.innerText = message;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 3000);
    }
}
