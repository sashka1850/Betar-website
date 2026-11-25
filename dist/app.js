import {createStudio} from "./scene.js";
import {initHeader} from "./header.js";
import "./about.js";
import "./price.js";

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

for(const button of document.querySelectorAll("[data-type]")){
  button.addEventListener("click",()=>{
    const id=button.dataset.type;
    select(button.classList.contains("category")&&selected===id?"overview":id);
  });
}
for(const button of document.querySelectorAll("[data-all]")){
  button.addEventListener("click",e=>{
    e.preventDefault();
    if(button===back)categories.find(b=>b.dataset.type===selected)?.focus({preventScroll:true});
    select("overview");
  });
}
categories.forEach((button,index)=>button.addEventListener("keydown",e=>{
  const step=e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:0;if(!step)return;
  e.preventDefault();const next=categories[(index+step+categories.length)%categories.length];
  next.focus({preventScroll:true});select(next.dataset.type);
}));

initHeader({getSelection:()=>selected,getItem:()=>content[selected].item,onEscape:()=>select("overview")});
document.querySelector(".brand").addEventListener("click",()=>select("overview"));
