const pins = [...document.querySelectorAll(".map-pin")];
const cities = [...document.querySelectorAll(".city-select")];
const selectedCity = document.querySelector(".map-city");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

function selectCity(id, fromMap) {
  for (const pin of pins) {
    pin.setAttribute("aria-pressed", String(pin.dataset.city === id));
  }
  for (const city of cities) {
    const active = city.dataset.city === id;
    city.setAttribute("aria-pressed", String(active));
    city.closest(".city-row").toggleAttribute("data-active", active);
    if (active) selectedCity.textContent = city.textContent;
  }
  if (fromMap) {
    document.getElementById(id).scrollIntoView({
      block:"nearest",
      behavior:reduceMotion.matches ? "instant" : "smooth"
    });
  }
}

for (const pin of pins) {
  pin.addEventListener("click", () => selectCity(pin.dataset.city, true));
  pin.previousElementSibling.addEventListener("click", () => pin.click());
}
for (const city of cities) {
  city.addEventListener("click", () => selectCity(city.dataset.city, false));
}
