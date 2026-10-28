var API_URL = ""
const FIREBASE_URL = "https://hemoglobinaproy-default-rtdb.firebaseio.com/";
var API_WALLEHB="https://walle-hb.onrender.com/predecir";
var veri = true;
if (veri == true) {
    API_URL = "https://api-prueba-sistema-hb.onrender.com/api/";
}
else {
    API_URL = "https://localhost:7176/api/"
}


if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado con éxito', reg))
            .catch(err => console.log('Error al registrar el Service Worker', err));
    });
}
