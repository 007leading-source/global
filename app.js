const API="https://script.google.com/macros/s/AKfycbyqrOYvuYnGW0WnwFC7Ns2RpqVyoGZ_IkdQPdsZagfk4Hg8jezu_5g92ipN57HbVcq4PA/exec";

let products=[],filtered=[],chart,mode="value";
let customers=[],cartItems=[];

/* NAV */
function goTo(s){
document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));
document.getElementById(s).classList.add("active");

if(s==="inventory"){loadProducts();}
if(s==="sale"){loadProducts();loadCustomers();}
}

/* LOAD */
async function loadProducts(){
const r=await fetch(API+"?action=getProducts");
products=await r.json();
filtered=products;
renderAll();
}

async function loadCustomers(){
const r=await fetch(API+"?action=getCustomers");
customers=await r.json();
customerSelect.innerHTML=`<option value="WALK-IN">Público General</option>`+
customers.map(c=>`<option value="${c.CustomerID}">${c.Name}</option>`).join("");
}

/* RENDER */
function renderAll(){
renderTable();
renderDashboard();
renderChart();
}

/* TABLE */
function renderTable(){
productsTable.innerHTML=filtered.map(p=>`
<tr>
<td contenteditable>${p.Name}</td>
<td class="${p.Stock<p.MinStock?'low':''}">${p.Stock}</td>
<td>${p.MinStock}</td>
<td>$${Number(p.CostPrice).toLocaleString("es-MX")}</td>
<td><button onclick="restock('${p.ProductID}')">📦</button></td>
</tr>`).join("");
}

/* DASHBOARD */
function renderDashboard(){
let total=0,low=[],out=[];
products.forEach(p=>{
total+=p.Stock*p.CostPrice;
if(p.Stock<p.MinStock)low.push(p);
if(p.Stock<=0)out.push(p);
});
inventoryValue.innerText="$"+total.toLocaleString("es-MX");
lowStock.innerHTML=low.map(p=>`<li>${p.Name} (${p.Stock})</li>`).join("");
outStock.innerHTML=out.map(p=>`<li>${p.Name}</li>`).join("");
}

/* CHART */
function renderChart(){
const canvas=document.getElementById("chart");
if(!canvas)return;

const ctx=canvas.getContext("2d");

const labels=products.map(p=>p.Name);
const data=products.map(p=>mode==="value"?p.Stock*p.CostPrice:p.Stock);
const colors=products.map(p=>p.Stock<p.MinStock?"#ef4444":"#3b82f6");

chartTitle.innerText=mode==="value"?"Producto VS Inversión":"Producto VS Stock";

if(chart)chart.destroy();

chart=new Chart(ctx,{
type:"bar",
data:{labels,datasets:[{data,backgroundColor:colors}]},
options:{plugins:{legend:{display:false}},responsive:true}
});
}

function toggleChartMode(){
mode=mode==="value"?"quantity":"value";
renderChart();
}

/* SEARCH INVENTORY */
function filterProducts(q){
filtered=products.filter(p=>p.Name.toLowerCase().includes(q.toLowerCase()));
renderTable();
}

/* 🔥 UNIVERSAL POST FIX */
async function postData(data){
return fetch(API,{
method:"POST",
headers:{
"Content-Type":"application/x-www-form-urlencoded"
},
body:"data="+encodeURIComponent(JSON.stringify(data))
});
}

/* RESTOCK */
async function restock(id){
const q=prompt("Cantidad:");
const c=prompt("Costo:");
if(!q||!c)return;

await postData({
action:"restock",
ProductID:id,
QuantityAdded:Number(q),
Cost:Number(c)
});

loadProducts();
}

/* PRODUCT */
function openProductForm(){
document.getElementById("productModal").classList.remove("hidden");
}
function closeProductForm(){
document.getElementById("productModal").classList.add("hidden");
}

async function createProduct(){
await postData({
action:"createProduct",
Name:pName.value,
Brand:pBrand.value,
Model:pModel.value,
Category:pCategory.value,
Unit:pUnit.value,
CostPrice:pCost.value,
SalePrice:pPrice.value,
Stock:pStock.value,
MinStock:pMinStock.value,
Supplier:pSupplier.value,
Description:pDesc.value
});

closeProductForm();
loadProducts();
}

/* CUSTOMERS */
async function createCustomer(){
await postData({
action:"createCustomer",
Name:cName.value,
Phone:cPhone.value,
Email:cEmail.value,
Address:cAddress.value,
RFC:cRFC.value,
Notes:cNotes.value
});

alert("✅ Cliente guardado");
goTo("home");
}

/* SALES SEARCH */
function searchProducts(q){
const results=products.filter(p=>p.Name.toLowerCase().includes(q.toLowerCase()));
searchResults.innerHTML=results.map(p=>`
<div onclick="addToCart('${p.ProductID}')">
${p.Name} - $${p.SalePrice}
</div>`).join("");
}

/* CART */
function addToCart(id){
const p=products.find(x=>x.ProductID===id);
const ex=cartItems.find(x=>x.ProductID===id);

if(ex)ex.Quantity++;
else cartItems.push({
ProductID:id,
Name:p.Name,
Price:Number(p.SalePrice),
Quantity:1
});

renderCart();
}

function renderCart(){
cart.innerHTML=cartItems.map((i,idx)=>`
<div>
${i.Name}
<button onclick="changeQty(${idx},-1)">−</button>
${i.Quantity}
<button onclick="changeQty(${idx},1)">+</button>
$${(i.Price*i.Quantity).toFixed(2)}
<button onclick="removeItem(${idx})">❌</button>
</div>`).join("");

updateTotals();
}

function changeQty(i,d){
cartItems[i].Quantity+=d;
if(cartItems[i].Quantity<=0)cartItems.splice(i,1);
renderCart();
}

function removeItem(i){
cartItems.splice(i,1);
renderCart();
}

/* TOTALS */
function updateTotals(){
const sub=cartItems.reduce((s,i)=>s+i.Price*i.Quantity,0);
const d=Number(discount.value||0);
const ivaCalc=(sub-d)*0.16;
const t=sub-d+ivaCalc;

subtotal.innerText=sub.toFixed(2);
iva.innerText=ivaCalc.toFixed(2);
total.innerText=t.toFixed(2);
}

/* CREATE SALE */
async function createSale(){
if(cartItems.length===0){
alert("Carrito vacío");
return;
}

try{

const items=cartItems.map(i=>({
ProductID:i.ProductID,
Quantity:i.Quantity,
Price:i.Price,
Total:i.Price*i.Quantity
}));

const res=await postData({
action:"createSale",
CustomerID:customerSelect.value,
Subtotal:Number(subtotal.innerText),
Discount:Number(discount.value),
IVA:Number(iva.innerText),
Total:Number(total.innerText),
items
});

const text=await res.text();
const data=JSON.parse(text);

alert("✅ Venta generada\nFactura: "+data.invoice);

generatePDF(data);

cartItems=[];
renderCart();
loadProducts();

}catch(err){
console.error(err);
alert("❌ Error al generar venta");
}
}

/* PDF */
function generatePDF(d){
const {jsPDF}=window.jspdf;
const doc=new jsPDF();

doc.text("Factura "+d.invoice,10,10);

let y=20;
d.items.forEach(i=>{
doc.text(`${i.ProductID} x${i.Quantity} $${i.Total}`,10,y);
y+=10;
});

doc.text("Total: $"+d.total,10,y+10);

doc.save("Factura_"+d.invoice+".pdf");
}