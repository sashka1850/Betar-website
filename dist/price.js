const priceDialog=document.querySelector("#price-dialog");
const priceForm=document.querySelector("#price-form");
const priceStatus=document.querySelector("#price-status");
for(const opener of document.querySelectorAll("[data-price-open]"))opener.addEventListener("click",()=>{
  priceStatus.textContent=priceForm.dataset.endpoint?"":"Демонстрационная форма. Отправка прайса на почту пока недоступна.";
  priceDialog.showModal();
});
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
