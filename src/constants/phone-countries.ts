/**
 * Catálogo de países para el indicativo telefónico del cliente.
 *
 * Cada país define su indicativo (code, ej. "+57"), nombre, bandera y la
 * cantidad de dígitos que se espera del número local (digits). La validación
 * del formulario usa `digits` para exigir la longitud correcta según el país.
 * Colombia va primero por ser el caso principal.
 */

export interface PhoneCountry {
    /** Indicativo internacional, ej. "+57". Se guarda en el campo phoneCountry. */
    code: string;
    /** Nombre del país. */
    name: string;
    /** Bandera (emoji) para mostrar en el selector. */
    flag: string;
    /** Cantidad de dígitos esperada del número local (sin indicativo). */
    digits: number;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
    { code: "+57", name: "Colombia", flag: "🇨🇴", digits: 10 },
    { code: "+58", name: "Venezuela", flag: "🇻🇪", digits: 10 },
    { code: "+593", name: "Ecuador", flag: "🇪🇨", digits: 9 },
    { code: "+51", name: "Perú", flag: "🇵🇪", digits: 9 },
    { code: "+52", name: "México", flag: "🇲🇽", digits: 10 },
    { code: "+1", name: "Estados Unidos", flag: "🇺🇸", digits: 10 },
    { code: "+34", name: "España", flag: "🇪🇸", digits: 9 },
    { code: "+54", name: "Argentina", flag: "🇦🇷", digits: 10 },
    { code: "+56", name: "Chile", flag: "🇨🇱", digits: 9 },
];

/** Indicativo por defecto (Colombia). Se usa para clientes sin país guardado. */
export const DEFAULT_PHONE_COUNTRY = "+57";

/** Devuelve el país por su indicativo, o Colombia si no se encuentra. */
export function getPhoneCountry(code?: string | null): PhoneCountry {
    const found = PHONE_COUNTRIES.find((c) => c.code === code);
    return found ?? PHONE_COUNTRIES[0];
}
