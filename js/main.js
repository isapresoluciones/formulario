// Contenido para main.js
import { loadModules } from './_module-loader.js';
import { setElements } from './_dom-elements.js';
import {
    initModals,
    initStepNavigation,
    initFormEventListeners,
    initDynamicFields,
    initFormSubmission,
    loadProgress,
    updateActionButtonState,
    checkRecoveryStatus 
} from './_form-logic.js';
import { openModal, closeModal } from './_ui-helpers.js';


function initializeFormApp() {
    checkRecoveryStatus();
    setElements();

    // Lee el parámetro 'hoja' de la URL y actualiza el formulario.
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const sheetTarget = urlParams.get('hoja'); // ej: ?hoja=Asesores MP
        const sheetNameInput = document.querySelector('input[name="sheetName"]');

        if (sheetTarget && sheetNameInput) {
            sheetNameInput.value = sheetTarget;
            console.log(`✅ Hoja de destino configurada para: ${sheetTarget}`);
        }
    } catch (e) {
        console.error("No se pudo leer los parámetros de la URL.", e);
    }

    initModals();
    initStepNavigation();
    initFormEventListeners();
    initDynamicFields();
    initFormSubmission();

    loadProgress();
    updateActionButtonState();

    openModal('welcomeModal');
    document.body.style.backgroundColor = '#0b0b0b';

    const thankYouModal = document.getElementById('thankyou-modal');
    if (thankYouModal) {
        const closeBtn = thankYouModal.querySelector('[data-close-modal]');
        if(closeBtn){
            closeBtn.addEventListener('click', () => {
                closeModal('thankyou-modal');
                document.getElementById('standalone-exit').style.display = 'grid';
            });
        }
    }

    // --- LÓGICA PARA LA PANTALLA DE RECUPERACIÓN
    const recoveryScreen = document.getElementById('recovery-screen');
    const restartBtn = document.getElementById('recover-restart-btn');

    if (recoveryScreen && restartBtn) {
        restartBtn.addEventListener('click', () => {
            checkRecoveryStatus(); 
            
            recoveryScreen.style.display = 'none';
            openModal('welcomeModal');
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadModules().then(initializeFormApp).catch(error => {
        console.error("No se pudo inicializar la aplicación:", error);
    });
});