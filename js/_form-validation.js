// Contiene toda la lógica de validación del formulario.
import { DOM } from './_dom-elements.js';
import { getFormStepNum, updateFormView } from './_ui-helpers.js';
import { comunasRegiones } from './_config.js';

// --- FUNCIONES DE VALIDACIÓN ESPECÍFICAS ---

function validarRut(rutCompleto) {
    if (!/^[0-9]+-[0-9kK]{1}$/.test(rutCompleto.replace(/\./g, ''))) return false;
    const [cuerpo, dv] = rutCompleto.replace(/\./g, '').split('-');
    let suma = 0;
    let multiplo = 2;
    for (let i = cuerpo.length - 1; i >= 0; i--) {
        suma += parseInt(cuerpo.charAt(i), 10) * multiplo;
        multiplo = multiplo === 7 ? 2 : multiplo + 1;
    }
    const dvEsperado = 11 - (suma % 11);
    const dvCalculado = (dvEsperado === 11) ? '0' : (dvEsperado === 10) ? 'K' : dvEsperado.toString();
    return dvCalculado === dv.toUpperCase();
}

function validarEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

function validarComuna(comuna) {
    return Object.prototype.hasOwnProperty.call(comunasRegiones, comuna);
}

// --- LÓGICA DE VALIDACIÓN PRINCIPAL ---

function manejarUIError(formGroup, esValido, mensaje = '') {
    const errorDiv = formGroup.querySelector('.error-message');
    if (!errorDiv) return;
    if (esValido) {
        formGroup.classList.remove('input-error');
        errorDiv.classList.remove('visible');
    } else {
        formGroup.classList.add('input-error');
        errorDiv.textContent = mensaje;
        errorDiv.classList.add('visible');
    }
}

function checkFieldValidity(field) {
    const conditionalParent = field.closest('.conditional-isapre-fields, #afp-details');
    if (conditionalParent && !conditionalParent.classList.contains('is-visible')) {
        return true;
    }
    if (!field.hasAttribute('required') && field.value.trim() === '') return true;
    if (field.type === 'radio' && !document.querySelector(`input[name="${field.name}"]:checked`)) return false;
    if (field.type !== 'radio' && !field.checkValidity()) return false;
    if (field.id === 'rut' && !validarRut(field.value)) return false;
    if (field.id === 'email' && !validarEmail(field.value)) return false;
    if (field.id === 'comuna' && !validarComuna(field.value)) return false;
    return true;
}

export function validateField(field) {
    // SOLUCIÓN: Siempre buscar el contenedor '.form-group' principal.
    // Esto asegura que tanto el campo/grupo de radios como el mensaje de error sean manejados correctamente.
    const formGroup = field.closest('.form-group');
    if (!formGroup) return true;

    if (!formGroup.classList.contains('is-interacted')) {
        return checkFieldValidity(field);
    }
    
    let esValido = true;
    let mensajeError = 'Completa este campo';
    const isRadio = field.type === 'radio';

    if (isRadio) {
        if (field.hasAttribute('required') && !document.querySelector(`input[name="${field.name}"]:checked`)) {
            esValido = false;
        }
    } else {
        if (field.hasAttribute('required') && field.value.trim() === '') {
            esValido = false;
        } else if (field.type !== 'range' && !field.checkValidity()) {
             esValido = false;
             mensajeError = field.validationMessage;
        }
    }
    
    if (esValido) {
        switch (field.id) {
            case 'rut':
                if (!validarRut(field.value)) { esValido = false; mensajeError = 'El RUT ingresado no es válido.'; }
                break;
            case 'email':
                if (!validarEmail(field.value)) { esValido = false; mensajeError = 'El formato e-mail es incorrecto.'; }
                break;
            case 'comuna':
                if (!validarComuna(field.value)) { esValido = false; mensajeError = 'Por favor, selecciona una comuna de la lista.'; }
                break;
        }
    }
    manejarUIError(formGroup, esValido, mensajeError);
    return esValido;
}

export function isCurrentStepValid() {
    const formStepsNum = getFormStepNum();
    if (formStepsNum < 0 || !DOM.formSteps || formStepsNum >= DOM.formSteps.length) return false;
    const currentStep = DOM.formSteps[formStepsNum];
    const fields = currentStep.querySelectorAll('input[required], select[required]');
    for (const field of fields) {
        if (!checkFieldValidity(field)) return false;
    }
    return true;
}

export function isFullFormValid() {
    let isAllValid = true;
    let firstInvalidField = null;
    let firstInvalidStep = -1;
    DOM.formSteps.forEach((step, index) => {
        const fields = step.querySelectorAll('input[required], select[required]');
        fields.forEach(field => field.closest('.form-group')?.classList.add('is-interacted'));
        for (const field of fields) {
            if (!validateField(field)) {
                isAllValid = false;
                if (firstInvalidField === null) {
                    firstInvalidField = field;
                    firstInvalidStep = index;
                }
            }
        }
    });
    if (!isAllValid && firstInvalidStep !== -1) {
        setFormStepNum(firstInvalidStep); 
        updateFormView('prev'); 
        firstInvalidField.focus();
        firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return isAllValid;
}