import {createStudio} from "./scene.js";

const content = {
  overview:{
    title:["Счётчики БЕТАР","оптом"],
    text:["Бытовые и промышленные","приборы учёта для организаций"]
  },
  water:{
    title:["Счётчики воды"],
    text:["СХВМ измеряет объём холодной воды, а СГВМ подходит для холодной и горячей. Компактный корпус удобно разместить в сантехническом шкафу."],
    item:"счётчики воды БЕТАР СХВМ / СГВМ"
  },
  gas:{
    title:["Счётчики газа"],
    text:["СГБМ измеряет объём бытового газа. Встроенный радиомодуль LoRaWAN «Лартех» передаёт показания дистанционно."],
    item:"счётчики газа БЕТАР СГБМ с радиоканалом LoRaWAN «Лартех»"
  },
  electric:{
    title:["Счётчики","электроэнергии"],
    text:["Однофазный ЭСО‑211 ведёт учёт по нескольким тарифам. Показания можно считывать по проводному интерфейсу RS‑485."],
    item:"однофазные многотарифные электросчётчики БЕТАР ЭСО‑211"
  }
};
const details = {
  terms:["Условия поставки","Для расчёта оптовой партии укажите нужные модели, количество, город и желаемый срок поставки."],
  about:["О компании","Поставляем счётчики БЕТАР для организаций. В ассортимент входят бытовые и промышленные приборы учёта воды, газа и электроэнергии."],
  contact:["Контакты","В макете указан демонстрационный номер. Здесь можно подготовить текст запроса для отдела продаж."]
};
const studio=createStudio();
const hero=document.querySelector(".hero");
const copy=document.querySelector("#copy");
const title=document.querySelector("#title");
const description=document.querySelector("#description");
const back=document.querySelector("#back");
const categories=[...document.querySelectorAll(".category")];
const reduce=matchMedia("(prefers-reduced-motion:reduce)");
let selected="overview",copyTimer=0,copyFrame=0;

function setLines(el,lines){
  const nodes=[];
  lines.forEach((s,i)=>{if(i)nodes.push(document.createElement("br"));nodes.push(document.createTextNode(s))});
  el.replaceChildren(...nodes);
}

function select(id){
  if(!Object.hasOwn(content,id)||selected===id)return;
  selected=id;studio.select(id);
  const rangeLink=document.querySelector("#range-link");
  rangeLink.hidden=id==="overview";
  rangeLink.href="./catalog.html#"+id;
  document.querySelector("#price-open").hidden=id!=="overview";
  for(const button of categories)button.setAttribute("aria-pressed",String(button.dataset.type===id));
  clearTimeout(copyTimer);cancelAnimationFrame(copyFrame);
  copy.classList.remove("entering");
  const swap=()=>{
    if(id!==selected)return;
    setLines(title,content[id].title);setLines(description,content[id].text);
    hero.classList.toggle("selected",id!=="overview");back.hidden=id==="overview";
    copy.classList.remove("leaving");
    if(reduce.matches)return;
    copy.classList.add("entering");void copy.offsetWidth;
    copyFrame=requestAnimationFrame(()=>copy.classList.remove("entering"));
  };
  if(reduce.matches)swap();else{copy.classList.add("leaving");copyTimer=setTimeout(swap,185)}
}

const menus=[...document.querySelectorAll("[data-menu]")].map(b=>[b,document.getElementById(b.dataset.menu)]);
function closeMenus(){
  for(const [button,menu] of menus){button.setAttribute("aria-expanded","false");menu.hidden=true}
}
for(const [button,menu] of menus){
  button.addEventListener("click",()=>{
    const opening=menu.hidden;closeMenus();
    if(opening){menu.hidden=false;button.setAttribute("aria-expanded","true")}
  });
}
document.addEventListener("click",e=>{
  if(!menus.some(([b,m])=>b.contains(e.target)||m.contains(e.target)))closeMenus();
});
for(const button of document.querySelectorAll("[data-type]")){
  button.addEventListener("click",()=>{
    const id=button.dataset.type;closeMenus();
    select(button.classList.contains("category")&&selected===id?"overview":id);
  });
}
for(const button of document.querySelectorAll("[data-all]")){
  button.addEventListener("click",e=>{
    e.preventDefault();closeMenus();
    if(button===back)categories.find(b=>b.dataset.type===selected)?.focus({preventScroll:true});
    select("overview");
  });
}
categories.forEach((button,index)=>button.addEventListener("keydown",e=>{
  const step=e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:0;if(!step)return;
  e.preventDefault();const next=categories[(index+step+categories.length)%categories.length];
  next.focus({preventScroll:true});select(next.dataset.type);
}));

const info=document.querySelector("#info"),quote=document.querySelector("#quote");
const draft=document.querySelector("#draft"),status=document.querySelector("#status");
const drafts=new Map();
for(const button of document.querySelectorAll("[data-info]")){
  button.addEventListener("click",()=>{
    closeMenus();const [heading,text]=details[button.dataset.info];
    document.querySelector("#info-heading").textContent=heading;
    document.querySelector("#info-body").textContent=text;info.showModal();
  });
}
for(const button of document.querySelectorAll("[data-quote]")){
  button.addEventListener("click",()=>{
    closeMenus();if(info.open)info.close();
    const item=content[selected].item || "приборы учёта БЕТАР";
    draft.value=drafts.get(selected)??`Добрый день! Прошу подготовить коммерческое предложение на ${item}.\n\nКоличество: \nГород поставки: \nЖелаемый срок: `;
    status.textContent="";quote.showModal();
  });
}
draft.addEventListener("input",()=>{drafts.set(selected,draft.value);status.textContent=""});
document.querySelector("#copy-draft").addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText(draft.value);status.textContent="Текст запроса скопирован."}
  catch{draft.select();status.textContent="Текст выделен. Используйте команду «Копировать»."}
});
for(const dialog of [info,quote]){
  dialog.querySelector("[data-close]").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("click",e=>{
    if(e.target!==dialog)return;
    const r=dialog.getBoundingClientRect();
    if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();
  });
}
document.addEventListener("keydown",e=>{
  if(e.key!=="Escape"||info.open||quote.open)return;
  const open=menus.find(([,m])=>!m.hidden);
  if(open){closeMenus();open[0].focus()}else select("overview");
});


const priceDialog=document.querySelector("#price-dialog");
const priceForm=document.querySelector("#price-form");
const priceStatus=document.querySelector("#price-status");
document.querySelector("#price-open").onclick=()=>{
  priceStatus.textContent=priceForm.dataset.endpoint?"":"Демонстрационная форма. Отправка прайса на почту пока недоступна.";
  priceDialog.showModal();
};
document.querySelector("#price-close").onclick=()=>priceDialog.close();
priceForm.addEventListener("submit",async event=>{
  event.preventDefault();
  const city=priceForm.elements.city;
  if(!city.value.trim()){city.value="";city.reportValidity();return}
  if(!priceForm.dataset.endpoint)return;
  const button=priceForm.querySelector("button");
  button.disabled=true;
  priceStatus.textContent="Отправляем запрос…";
  try{
    const response=await fetch(priceForm.dataset.endpoint,{method:"POST",body:new URLSearchParams(new FormData(priceForm)),signal:AbortSignal.timeout(20000)});
    if(!response.ok || !(await response.json()).ok)throw new Error();
    priceStatus.textContent="Прайс передан почтовой службе. Проверьте входящие и папку «Спам».";
    priceForm.reset();
  }catch{priceStatus.textContent="Не удалось подтвердить отправку. Попробуйте позже."}
  finally{button.disabled=false}
});
if(!priceForm.dataset.endpoint)priceForm.querySelector("button").disabled=true;
