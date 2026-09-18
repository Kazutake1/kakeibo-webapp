// Dashboard chart rendering and chart-specific controls.
let chartDrawTimer=null;
let chartDrawSeq=0;
function chartCanvasVisible(id){
  const panel=document.querySelector('.panel[data-panel="dashboard"]');
  const canvas=document.getElementById(id);
  if(!panel?.classList.contains('active')||!panel.getClientRects().length||!canvas)return false;
  const rect=canvas.parentElement?.getBoundingClientRect();
  return !!rect&&rect.width>=2&&rect.height>=2;
}
function scheduleChartDraw(delay=80){
  const seq=++chartDrawSeq;
  clearTimeout(chartDrawTimer);
  chartDrawTimer=setTimeout(()=>{
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(seq===chartDrawSeq)drawCharts();
    }));
  },delay);
}
function drawCharts(){
  let drawn=false;
  if(chartCanvasVisible('weeklyChart')){drawWeekly();drawn=true}
  if(chartCanvasVisible('donutChart')){drawDonut('donutChart','donutLegend',TYPES.filter(t=>t.key!=='income').map(t=>[t.label,effectiveTypeSum(t.key)]));drawn=true}
  if(chartCanvasVisible('variableDonut')){drawDonut('variableDonut','variableLegend',catsFor('variable').map(c=>[c,sum(monthTx().filter(t=>t.type==='variable'&&t.category===c).map(t=>t.amount))]));drawn=true}
  return drawn;
}

function chartTheme(){const dark=document.body.classList.contains('dark-mode');return dark?{grid:'#2b4056',muted:'#9eb0c6',strong:'#cfe5fb',hole:'#17212c',empty:'#2a425c'}:{grid:'#dbe7f7',muted:'#64748b',strong:'#1e3a5f',hole:'#ffffff',empty:'#dbeafe'}}
function prepCanvas(id){const c=document.getElementById(id);const r=c.getBoundingClientRect();const pr=c.parentElement?.getBoundingClientRect();const w=r.width||pr?.width||0;const h=r.height||pr?.height||0;if(w<2||h<2)return null;const dpr=devicePixelRatio||1;c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);return [x,w,h]}
function prepDonutCanvas(id){const c=document.getElementById(id);const wrap=c.parentElement;const r=wrap.getBoundingClientRect();const size=Math.max(1,Math.min(r.width||wrap.clientWidth||300,r.height||wrap.clientHeight||300));const dpr=devicePixelRatio||1;c.style.width='100%';c.style.height='100%';c.width=Math.round(size*dpr);c.height=Math.round(size*dpr);const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);return [x,size,size]}
function drawWeekly(){
  const prepared=prepCanvas('weeklyChart');
  if(!prepared)return false;
  let [ctx,w,h]=prepared;
  ctx.clearRect(0,0,w,h);

  const WEEKLY_BUDGET=14000;
  const lastDay=new Date(current.getFullYear(),current.getMonth()+1,0).getDate();
  const periods=[[1,7],[8,14],[15,21],[22,28],[29,lastDay]].filter(([a])=>a<=lastDay);
  const cats=catsFor('variable');
  const tx=monthTx().filter(t=>t.type==='variable');

  const matrix=periods.map(([a,b])=>
    cats.map(c=>sum(
      tx.filter(t=>t.category===c&&+t.date.slice(-2)>=a&&+t.date.slice(-2)<=b)
        .map(t=>t.amount)
    ))
  );
  const totals=matrix.map(r=>sum(r));

  // Keep the ¥14,000 weekly budget line visible even in low-spend weeks.
  const max=Math.max(...totals,WEEKLY_BUDGET*1.2,1);
  const left=54,right=14,top=26,bottom=40;
  const plotW=w-left-right,plotH=h-top-bottom;
  const ct=chartTheme();

  // Grid and y-axis.
  ctx.strokeStyle=ct.grid;
  ctx.lineWidth=1;
  ctx.fillStyle=ct.muted;
  ctx.font='11px sans-serif';
  ctx.textAlign='right';
  for(let i=0;i<5;i++){
    const y=top+i*plotH/4;
    const val=Math.round(max*(1-i/4));
    ctx.beginPath();
    ctx.moveTo(left,y);
    ctx.lineTo(w-right,y);
    ctx.stroke();
    ctx.fillText(val?money(val):'¥0',left-7,y+4);
  }

  // Calculate the weekly budget threshold now, but draw it after the bars so
  // the warning line always stays visible when a bar crosses it.
  const budgetY=top+plotH-(WEEKLY_BUDGET/max*plotH);

  // Weekly stacked bars.
  const slot=plotW/periods.length;
  const barW=Math.min(58,slot*.58);
  periods.forEach((p,i)=>{
    const x=left+i*slot+(slot-barW)/2;
    let yBottom=top+plotH;

    matrix[i].forEach((v,j)=>{
      if(!v)return;
      const bh=v/max*plotH;
      yBottom-=bh;
      ctx.fillStyle=chartColor(j);
      ctx.fillRect(x,yBottom,barW,bh);
    });

    ctx.fillStyle=ct.muted;
    ctx.font='11px sans-serif';
    ctx.textAlign='center';
    const end=Math.min(p[1],lastDay);
    ctx.fillText(`${p[0]}-${end}日`,x+barW/2,h-14);

    if(totals[i]){
      ctx.fillStyle=totals[i]>=WEEKLY_BUDGET?'#ef4444':ct.strong;
      ctx.font='700 11px sans-serif';
      ctx.fillText(
        money(totals[i]),
        x+barW/2,
        Math.max(12,top+plotH-totals[i]/max*plotH-6)
      );
    }
  });

  // Weekly budget threshold: ¥2,000/day × 7 days = ¥14,000/week.
  // Draw this overlay last so the red dotted line is not hidden by the bars.
  ctx.save();
  ctx.setLineDash([7,5]);
  ctx.strokeStyle='#ef4444';
  ctx.lineWidth=1.5;
  ctx.beginPath();
  ctx.moveTo(left,budgetY);
  ctx.lineTo(w-right,budgetY);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle='#ef4444';
  ctx.font='700 10px sans-serif';
  ctx.textAlign='left';
  ctx.fillText('週予算 ¥14,000',left+4,Math.max(top+11,budgetY-6));

  document.getElementById('weeklyLegend').innerHTML=cats
    .map((c,j)=>`<span><i class="dot" style="background:${chartColor(j)}"></i>${escapeHtml(c)}</span>`)
    .join('');
}
// Cool blue-based palette aligned with the app's current cards and charts.
// Red remains reserved for the weekly budget warning line and over-limit totals.
const CHART_COLORS_LIGHT=['#1769d2','#18a6c9','#438ee8','#2ab7a9','#5aaef2','#557dc5','#45c5d0','#7399df','#7bb9da','#8ed9df'];
const CHART_COLORS_DARK=['#5fa8ff','#45d2ec','#7bb5ff','#55d7c4','#8bc8ff','#91aef4','#75e0e9','#a3baff','#9ed4ed','#b0edf0'];
function chartColors(){return document.body.classList.contains('dark-mode')?CHART_COLORS_DARK:CHART_COLORS_LIGHT}
function chartColor(index){const palette=chartColors();return palette[index%palette.length]}
function donutColor(canvasId,index,count){
  const total=Math.max(1,count);
  const t=total<=1?0:Math.min(1,Math.max(0,index/(total-1)));
  const isVariable=canvasId==='variableDonut';
  const hue=isVariable?145:216;
  const saturation=isVariable?62:82;
  const startLightness=isVariable?28:34;
  const endLightness=76;
  const lightness=Math.round(startLightness+(endLightness-startLightness)*t);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}
const donutLegendModes={donutLegend:'percent',variableLegend:'percent'};
function setDonutLegendMode(legendId,mode){
  if(mode!=='percent'&&mode!=='amount')return;
  donutLegendModes[legendId]=mode;
  const root=document.getElementById(legendId);
  if(!root)return;
  root.dataset.mode=mode;
  root.querySelectorAll('.donut-mode-btn').forEach(btn=>{
    const active=btn.dataset.mode===mode;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',active?'true':'false');
  });
}
function drawDonut(canvasId,legendId,data){
  let [ctx,w,h]=prepDonutCanvas(canvasId);
  ctx.clearRect(0,0,w,h);
  const allData=data.slice();
  const drawableData=allData.map((entry,index)=>[...entry,index]).filter(x=>x[1]>0);
  let total=sum(allData.map(x=>x[1]));
  const ct=chartTheme();
  let cx=w/2,cy=h/2,r=Math.min(w,h)*.34,inner=r*.72,start=-Math.PI/2;
  if(!total){
    ctx.fillStyle=ct.empty;
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.arc(cx,cy,inner,0,Math.PI*2,true);ctx.fill('evenodd');
  }else{
    drawableData.forEach(([l,v,i])=>{
      let a=v/total*Math.PI*2;
      ctx.fillStyle=donutColor(canvasId,i,allData.length);
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,start,start+a);ctx.closePath();ctx.fill();
      start+=a
    });
    ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc(cx,cy,inner,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation='source-over';
    if(drawableData.length>1){
      let divider=-Math.PI/2;
      ctx.save();
      ctx.strokeStyle=ct.hole;ctx.lineWidth=Math.max(2,Math.min(3,w*.009));ctx.lineCap='round';
      drawableData.forEach(([,v])=>{
        ctx.beginPath();
        ctx.moveTo(cx+Math.cos(divider)*(inner-1),cy+Math.sin(divider)*(inner-1));
        ctx.lineTo(cx+Math.cos(divider)*(r+1),cy+Math.sin(divider)*(r+1));
        ctx.stroke();
        divider+=v/total*Math.PI*2;
      });
      ctx.restore();
    }
  }
  ctx.textAlign='center';
  ctx.fillStyle=ct.muted;ctx.font='700 11px sans-serif';ctx.fillText('合計',cx,cy-10);
  ctx.fillStyle=ct.strong;ctx.font='750 20px sans-serif';ctx.fillText(money(total),cx,cy+14);
  const mode=donutLegendModes[legendId]||'percent';
  const root=document.getElementById(legendId);
  root.dataset.mode=mode;
  const legendScrollAttrs=legendId==='variableLegend'?' role="region" aria-label="変動費カテゴリ一覧" tabindex="0"':'';
  root.innerHTML=`<div class="donut-mode-toggle" role="group" aria-label="凡例の表示切替"><button type="button" class="donut-mode-btn ${mode==='percent'?'active':''}" data-mode="percent" aria-pressed="${mode==='percent'}">割合</button><button type="button" class="donut-mode-btn ${mode==='amount'?'active':''}" data-mode="amount" aria-pressed="${mode==='amount'}">金額</button></div><div class="donut-legend-list"${legendScrollAttrs}>${allData.map(([l,v],i)=>`<div class="donut-legend-row"><div class="donut-legend-name"><i class="dot" style="background:${donutColor(canvasId,i,allData.length)}"></i><span>${escapeHtml(l)}</span></div><span class="donut-legend-value donut-value-percent">${total?Math.round(v/total*100):0}%</span><strong class="donut-legend-value donut-value-amount">${money(v)}</strong></div>`).join('')}</div>`;
  root.querySelectorAll('.donut-mode-btn').forEach(btn=>btn.addEventListener('click',()=>setDonutLegendMode(legendId,btn.dataset.mode)));
  setDonutLegendMode(legendId,mode);
}
