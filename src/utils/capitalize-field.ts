import type { UseFormRegister, UseFormSetValue, FieldValues, Path } from "react-hook-form";
import { capitalizeFirst } from "./formatters";

/**
 * Envuelve `register` de react-hook-form para que un campo de texto capitalice
 * automáticamente su primera letra mientras se escribe.
 *
 * Uso:
 *   const cap = makeCapitalizedRegister(register, setValue);
 *   <input {...cap("name")} />
 *
 * Solo debe usarse en campos de LETRAS (nombre, descripción, premio, lotería,
 * dirección, etc.), nunca en números, cédulas, teléfonos ni fechas.
 */
export function makeCapitalizedRegister<T extends FieldValues>(
    register: UseFormRegister<T>,
    setValue: UseFormSetValue<T>
) {
    return (name: Path<T>) => {
        const reg = register(name);
        return {
            ...reg,
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                const capped = capitalizeFirst(e.target.value);
                if (capped !== e.target.value) {
                    // Actualiza el valor capitalizado en el formulario y en el DOM.
                    setValue(name, capped as never, { shouldValidate: false, shouldDirty: true });
                    e.target.value = capped;
                }
                return reg.onChange(e);
            },
        };
    };
}
