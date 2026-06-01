document.addEventListener("DOMContentLoaded", function () {
    const inputTelefono = document.querySelector("#testRegTelefono");
    
    if (inputTelefono) {
        window.iti = window.intlTelInput(inputTelefono, {
            initialCountry: "bo", // Bolivia por defecto
            separateDialCode: true,
            utilsScript: "https://cdn.jsdelivr.net/npm/intl-tel-input@25.10.5/build/js/utils.js"
        });
    }
});
