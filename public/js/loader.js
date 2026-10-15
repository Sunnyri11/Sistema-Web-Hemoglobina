const esSubCarpeta = window.location.pathname.includes('/view/');
const rutaIcono = esSubCarpeta ? "../public/img/icon.png" : "public/img/icon.png";

function inicializarLoader() {
  if (document.getElementById("globalLoader")) return;

  const loaderHtml = `
    <div id="globalLoader" style="display: none;">
      <div class="loader-container">
        <div class="spinner-wrapper">
          <div class="spinner-blade"></div>
          <div class="spinner-blade"></div>
          <div class="spinner-blade"></div>
          <div class="spinner-blade"></div>
          <div class="spinner-blade"></div>
          <div class="spinner-blade"></div>
          <div class="spinner-blade"></div>
          <div class="spinner-blade"></div>
          <div class="spinner-blade"></div>
          <div class="spinner-blade"></div>
          <div class="spinner-blade"></div>
          <div class="spinner-blade"></div>
          <img src="${rutaIcono}" alt="Logo" class="loader-logo" onerror="this.style.display='none'">
        </div>
        <span class="loader-text" id="loaderMessage">Cargando...</span>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', loaderHtml);
}

function mostrarLoader(mensaje = "Cargando...") {
  inicializarLoader();
  const txt = document.getElementById("loaderMessage");
  if (txt) txt.textContent = mensaje;
  
  const loader = document.getElementById("globalLoader");
  if (loader) {
    loader.style.display = "flex"; // Forzamos visibilidad directa
    loader.classList.add("active");
  }
}

function ocultarLoader() {
  const loader = document.getElementById("globalLoader");
  if (loader) {
    loader.classList.remove("active");
    loader.style.display = "none"; // Ocultamos al terminar
  }
}