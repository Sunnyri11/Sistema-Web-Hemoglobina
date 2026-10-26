// Pantalla de carga global. Es un script clásico: mostrarLoader() y ocultarLoader() quedan globales.
const rutaIcono = window.location.pathname.includes("/view/")
    ? "../public/img/icon.png"
    : "public/img/icon.png";

function inicializarLoader() {
    if (document.getElementById("globalLoader")) return;

    const aspas = '<div class="spinner-blade"></div>'.repeat(12);
    document.body.insertAdjacentHTML("beforeend", `
        <div id="globalLoader" role="status" aria-live="polite">
            <div class="loader-container">
                <div class="spinner-wrapper">
                    ${aspas}
                    <img src="${rutaIcono}" alt="" class="loader-logo" onerror="this.style.display='none'">
                </div>
                <span class="loader-text" id="loaderMessage">Cargando...</span>
            </div>
        </div>`);
}

function mostrarLoader(mensaje = "Cargando...") {
    inicializarLoader();
    document.getElementById("loaderMessage").textContent = mensaje;
    document.getElementById("globalLoader").classList.add("active");
}

function ocultarLoader() {
    document.getElementById("globalLoader")?.classList.remove("active");
}
