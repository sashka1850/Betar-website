const details = {
  terms:["Условия поставки","Для расчёта оптовой партии укажите нужные модели, количество, город и желаемый срок поставки."],
  about:["О компании","Поставляем счётчики БЕТАР для организаций. В ассортимент входят бытовые и промышленные приборы учёта воды, газа и электроэнергии."]
};

export function initHeader({getSelection=()=> "overview",getItem=()=>"",onEscape=()=>{}}={}){
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
    if(e.target.closest(".mobile-pop a")||!menus.some(([b,m])=>b.contains(e.target)||m.contains(e.target)))closeMenus();
  });
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
      const item=getItem() || "приборы учёта БЕТАР";
      draft.value=drafts.get(getSelection())??`Добрый день! Прошу подготовить коммерческое предложение на ${item}.\n\nКоличество: \nГород поставки: \nЖелаемый срок: `;
      status.textContent="";quote.showModal();
    });
  }
  draft.addEventListener("input",()=>{drafts.set(getSelection(),draft.value);status.textContent=""});
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
    if(open){closeMenus();open[0].focus()}else onEscape();
  });
}
