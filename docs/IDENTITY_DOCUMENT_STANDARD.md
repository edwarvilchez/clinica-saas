# 🇻🇪 Estándar Técnico de Documento de Identidad Venezolano (Cédula de Identidad)

## Clinica SaaS — Sistema Integral de Normalización y Unicidad de Cédulas

---

## 1. Marco Normativo y Justificación Legal

### Fundamento Jurídico
En la República Bolivariana de Venezuela, la expedición y regulación del documento de identidad personal se rige por la **Ley Orgánica de Identificación** (*Gaceta Oficial N° 38.458 del 14 de junio de 2006*):

1. **Distinción por Nacionalidad / Condición Jurídica:**
   - Las personas de nacionalidad venezolana (por nacimiento o por naturalización) portan un número de cédula precedido por la letra **`V`**.
   - Las personas extranjeras con estatus de residencia legal en el territorio nacional portan un número precedido por la letra **`E`**.
2. **Carácter Inalienable e Individual:**
   - El número de cédula de identidad es correlativo, permanente, único e intransferible para cada persona física durante toda su vida jurídica.
3. **Distinción entre Exigencia Legal y Decisión de Diseño de Software:**
   - **Exigencia Legal:** La separación clara de estatus mediante el prefijo `V` o `E` y la numeración correlativa inherente.
   - **Decisión de Diseño del Sistema:** El uso del separador con guion (`V-########`), la longitud de 1 a 8 dígitos numéricos, y la columna de deduplicación sin separadores (`V########`) son convenciones técnicas adoptadas para garantizar la interoperabilidad, evitar colisiones sintácticas y asegurar una experiencia de usuario limpia y libre de duplicados semánticos.

---

## 2. Definición de Formatos

### 2.1 Formato Canónico (Persistido y Visualizado en UI)
Es la representación visual y oficial de almacenamiento en la columna `documentId` de la entidad paciente:

```regex
^[VE]-[0-9]{1,8}$
```

- **Venezolanos:** `V-12345678` (o longitudes históricas menores como `V-654321`)
- **Extranjeros:** `E-12345678`

### 2.2 Formato Normalizado (Unicidad y Búsqueda Indexada)
Es la representación compacta utilizada internamente por el motor de base de datos en la columna `documentNumberNormalized` y en índices `UNIQUE`:

```regex
^[VE][0-9]{1,8}$
```

- **Venezolanos:** `V12345678`
- **Extranjeros:** `E12345678`

### 2.3 Matriz de Equivalencia Semántica
Cualquiera de las siguientes variantes ingresadas por un usuario o archivo externo representa exactamente al **mismo documento subyacente**:

| Entrada Cruda | Canónico (`documentId`) | Normalizado (`documentNumberNormalized`) | Estado |
| :--- | :--- | :--- | :--- |
| `V-85397898` | `V-85397898` | `V85397898` | Válido (Canónico directo) |
| `V85397898` | `V-85397898` | `V85397898` | Válido (Canonicalizado) |
| `V 85397898` | `V-85397898` | `V85397898` | Válido (Canonicalizado) |
| `v-85397898` | `V-85397898` | `V85397898` | Válido (Canonicalizado) |
| `v85397898` | `V-85397898` | `V85397898` | Válido (Canonicalizado) |
| `V.85397898` | `V-85397898` | `V85397898` | Válido (Canonicalizado) |
| `V-85.397.898` | `V-85397898` | `V85397898` | Válido (Canonicalizado) |
| `V - 85397898` | `V-85397898` | `V85397898` | Válido (Canonicalizado) |
| `E-12345678` | `E-12345678` | `E12345678` | Válido (Canónico directo) |
| `e 12.345.678` | `E-12345678` | `E12345678` | Válido (Canonicalizado) |

---

## 3. Arquitectura del Servicio Central (`IdentityDocumentService`)

Ubicación: `server/src/services/identityDocument.service.js`

### Métodos Principales

1. **`parse(input)`**:
   - Descompone la cadena en: `prefix`, `number`, `canonical`, `normalized`, `isValid`, `isCanonical`, `error`.
   - Rechaza caracteres ilegales (como símbolos especiales o letras intermedias) y longitudes superiores a 8 dígitos.
2. **`normalizeIdentityDocument(input)`**:
   - Devuelve la cadena compacta en mayúsculas (`V85397898`). Lanza excepción `INVALID_IDENTITY_DOCUMENT` si no es válida.
3. **`canonicalize(input)`**:
   - Devuelve la forma canónica con guion (`V-85397898`). Lanza excepción si el formato no es recuperable.
4. **`validate(input, strict = false)`**:
   - Si `strict` es `true`, evalúa cumplimiento estricto con `^[VE]-[0-9]{1,8}$`. Si es `false`, evalúa si puede ser parseado correctamente.
5. **`areEquivalent(docA, docB)`**:
   - Compara dos cadenas y determina igualdad semántica basada en su forma normalizada.
6. **`checkDuplicate({ documentInput, organizationId, excludePatientId })`**:
   - Realiza consulta en base de datos con aislamiento multi-tenant para verificar si el documento ya está registrado.
7. **`handleUniqueViolationError(error, res)`**:
   - Atrapa errores de violación de restricción única de PostgreSQL (código `23505`) y responde con código HTTP 409 y mensaje estructurado.

---

## 4. Política Multi-Tenancy de Unicidad

En una plataforma médica multi-tenant como Clinica SaaS, un ciudadano puede atenderse legítimamente en diferentes centros de salud independientes. Por tanto:

- **Aislamiento por Organización (Tenant):**
  Un paciente con cédula `V-85397898` en la **Clínica A** puede existir independientemente en la **Clínica B** sin generar conflicto.
- **Unicidad Estricta dentro del Tenant:**
  Dentro de una misma clínica (`organizationId`), ninguna combinación de formatos (`V85397898`, `V-85397898`, etc.) puede ser duplicada.
- **Garantía en Base de Datos (PostgreSQL):**
  ```sql
  -- Restricción única para pacientes asignados a una organización
  CREATE UNIQUE INDEX uq_patients_org_doc_normalized 
  ON "Patients" ("organizationId", "documentNumberNormalized") 
  WHERE ("deletedAt" IS NULL AND "organizationId" IS NOT NULL);

  -- Restricción única para pacientes globales (sin organización asignada)
  CREATE UNIQUE INDEX uq_patients_global_doc_normalized 
  ON "Patients" ("documentNumberNormalized") 
  WHERE ("deletedAt" IS NULL AND "organizationId" IS NULL);
  ```

---

## 5. Respuestas y Protocolos de Error de la API

Cuando un usuario intenta registrar un paciente con un documento que ya existe en la organización, el backend responde de forma determinista:

### Código HTTP
`409 Conflict`

### Cuerpo JSON
```json
{
  "code": "IDENTITY_DOCUMENT_ALREADY_EXISTS",
  "message": "El registro ya existe. Verifique el número de documento ingresado."
}
```

### Reglas de Edición / Actualización
- **Preservación:** Si el paciente conserva su misma cédula durante una edición, la consulta excluye su propio `id` (`id != excludePatientId`), permitiendo actualizar otros datos clínicos o demográficos sin falso positivo.
- **Colisión:** Si el usuario intenta cambiar la cédula por una ya perteneciente a otro paciente, la operación es bloqueada inmediatamente.

---

## 6. Importación Masiva (CSV / Excel)

El pipeline de importación en `bulk.controller.js` e `importService.js` implementa validación en tres capas:

1. **Validación Estructural:** Cada fila debe contener un documento que cumpla la especificación venezolana (`V` o `E`, 1 a 8 dígitos).
2. **Detección Intra-Archivo:** Si dentro del mismo archivo CSV existen dos filas con el mismo documento en formatos diferentes (ej. fila 2 con `V-85397898` y fila 40 con `V85397898`), el proceso detecta el conflicto y rechaza la importación con detalle de fila.
3. **Detección contra Base de Datos:** Verificación masiva contra `Patients.documentNumberNormalized` dentro de la organización antes de la inserción transaccional.

---

## 7. Experiencia de Usuario en el Frontend (Angular)

El componente `Patients` (`patients.ts` y `patients.html`) incorpora:
- **Prefijo Asistido:** Selector de nacionalidad (`V-` / `E-`) y campo de texto con validación numérica.
- **Feedback en Tiempo Real:** Clases visuales `is-valid` e `is-invalid`, con mensaje aclaratorio:
  > *Formato canónico: V-12345678 (1 a 8 dígitos numéricos).*
- **Verificación Asíncrona:** Consulta debounced a `/api/patients/check-document?document=...` para alertar de duplicados antes de presionar "Guardar".
- **Alerta SweetAlert2:** Manejo del error 409 con aviso amigable y claro si ocurre una colisión concurrente.

---

## 8. Verificación y Pruebas Automatizadas

La suite de pruebas automatizadas en `server/src/__tests__/unit/identityDocument.test.js` cubre:
- Matriz completa de variantes y equivalencia por pares.
- Rechazo estricto de entradas inválidas (`V--`, `X-12345678`, `12345678`, etc.).
- Comportamiento de `checkDuplicate` en creación y edición.
- Aislamiento multi-tenant.
- Conversión de errores de concurrencia de base de datos a `409 Conflict`.
- Detección intra-lote en importación masiva.
