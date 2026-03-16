import { Injectable, signal, computed } from '@angular/core';

export type Language = 'es' | 'en';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private currentLang = signal<Language>('es');
  
  public locale = computed(() => this.currentLang() === 'es' ? 'es-ES' : 'en-US');
  
  // Diccionarios de traducción
  private translations: any = {
    es: {
      common: {
        dashboard: 'Dashboard',
        search: 'Buscar...',
        actions: 'Acciones',
        status: 'Estado',
        save: 'Guardar',
        cancel: 'Cancelar',
        loading: 'Cargando...',
        printing: 'Imprimiendo...',
        success: '¡Éxito!',
        error: 'Error',
        warning: 'Atención',
        noResults: 'No se encontraron resultados',
        doctor: 'Doctor',
        birthDate: 'Fecha de Nacimiento',
        male: 'Masculino',
        female: 'Femenino',
        username: 'Nombre de Usuario',
        confirm: 'Confirmar'
      },
      auth: {
        login: 'Iniciar Sesión',
        register: 'Registrarse',
        logout: 'Cerrar Sesión',
        email: 'Email',
        password: 'Contraseña'
      },
      payments: {
        title: 'Control de Pagos',
        subtitle: 'Gestión de facturación y estados de cuenta',
        newPayment: 'Nuevo Pago',
        export: 'Exportar Reporte',
        reference: 'Referencia',
        patient: 'Paciente',
        concept: 'Concepto',
        amount: 'Monto',
        fecha: 'Fecha',
        collect: 'Cobrar',
        receipt: 'Recibo',
        pending: 'Pendiente',
        paid: 'Pagado',
        doctorConsultation: 'Consulta / Médico',
        generalPayment: 'Pago General',
        edit: 'Editar Pago',
        delete: 'Eliminar Pago',
        registerTitle: 'Registrar Pago de Cita',
        editTitle: 'Editar Pago de Cita',
        payCurrency: 'Moneda del Pago',
        bankPlatform: 'Banco / Plataforma',
        updateReceipt: 'Actualizar Comprobante (Opcional)',
        hasAttachment: 'Ya tiene un archivo adjunto',
        selectAppointment: 'Cita a Pagar',
        method: 'Método de Pago',
        select: 'Seleccione...',
        bankPlatformPlaceholder: 'Ej: Banesco, Mercantil, Zelle...',
        refPlaceholder: 'Últimos 4-6 dígitos',
        payDate: 'Fecha de Pago',
        attachReceipt: 'Adjuntar Comprobante (Opcional)',
        saveChanges: 'Guardar Cambios',
        confirmDelete: '¿Estás seguro?',
        confirmDeleteText: 'Esta acción eliminará el registro del pago permanentemente.',
        yesDelete: 'Sí, eliminar',
        deleted: 'Eliminado',
        deletedMsg: 'El pago ha sido eliminado.',
        updated: 'Actualizado',
        updatedMsg: 'Su pago ha sido actualizado de forma exitosa.'
      },
      medical_history: {
        title: 'Historial del Paciente',
        subtitle: 'Registro detallado de consultas, tratamientos y evolución',
        selectPatient: 'Selecciona un Paciente para ver su Historial',
        id: 'ID',
        phone: 'Teléfono',
        gender: 'Género',
        newRecord: 'Nuevo Informe Médico',
        changePatient: 'Cambiar Paciente',
        tabs: {
          consultations: 'Consultas',
          labs: 'Laboratorio',
          treatments: 'Tratamientos'
        },
        diagnosis: 'Diagnóstico',
        physicalExam: 'Examen Físico',
        treatment: 'Tratamiento',
        indications: 'Indicaciones',
        medicalLeave: 'Suspensión Médica (Reposo)',
        leaveDays: 'Días de Reposo',
        startDate: 'Fecha de Inicio',
        endDate: 'Fecha de Fin',
        save: 'Guardar Informe en Historial',
        noRecords: 'No hay registros médicos para este paciente.',
        diagnosisPlaceholder: 'Escribe el diagnóstico principal...',
        examPlaceholder: 'Detalles del examen físico...',
        treatmentPlaceholder: 'Medicamentos y dosis...',
        indicationsPlaceholder: 'Recomendaciones generales...',
        viewPdf: 'Ver PDF',
        noLabs: 'No hay resultados de laboratorio para este paciente.',
        treatmentsSummary: 'Resumen de Tratamientos',
        noTreatments: 'No se registran tratamientos activos.'
      },
      sidebar: {
        medicalManagement: 'GESTIÓN MÉDICA',
        appointments: 'Citas Médicas',
        history: 'Historial Médico',
        patients: 'Pacientes',
        lab: 'Laboratorio',
        medicalStaff: 'PERSONAL MÉDICO',
        doctors: 'Doctores',
        nurses: 'Enfermería',
        administration: 'ADMINISTRACIÓN',
        staff: 'Personal Staff',
        payments: 'Pagos',
        bank: 'Banco',
        instrument: 'Tipo de Pago',
        method: 'Método',
        cash: 'Efectivo',
        transfer: 'Transferencia',
        mobile: 'Pago Móvil',
        debit: 'Débito',
        credit: 'Crédito',
        currency: 'Moneda',
        bulkData: 'Carga Masiva',
        drugGuide: 'Guía Farmacéutica',
        labCatalog: 'Catálogo de Exámenes'
      },
      drug_guide: {
        title: 'Guía Farmacéutica Spilva',
        subtitle: 'Consulta de componentes, posología e indicaciones de medicamentos.',
        vademecumLabel: 'Vademécum Venezuela en línea',
        vademecumDesc: 'Accede al directorio completo de medicamentos disponibles en Venezuela.',
        vademecumLink: 'Abrir Vademécum',
        newDrug: 'Nuevo Medicamento',
        searchPlaceholder: 'Buscar por nombre, genérico o componentes...',
        allCategories: 'Todas las categorías',
        search: 'Buscar',
        noResults: 'No se encontraron medicamentos',
        noResultsHint: 'Intenta con otros términos o agrega el primero.',
        results: 'resultados',
        table: {
          commercial: 'Nombre Comercial',
          generic: 'Nombre Genérico',
          components: 'Componentes Activos',
          presentation: 'Presentación',
          category: 'Categoría',
          actions: 'Acciones'
        },
        noCategory: 'Sin categoría',
        detail: {
          title: 'Detalle de Medicamento',
          presentation: 'Presentación',
          category: 'Categoría',
          components: 'Componentes Activos',
          indications: 'Indicaciones',
          posology: 'Posología',
          contraindications: 'Contraindicaciones',
          adverseReactions: 'Reacciones Adversas',
          precautions: 'PRECAUCIONES',
          noSpecified: 'No especificado',
          close: 'Cerrar',
          edit: 'Editar'
        },
        form: {
          create: 'Agregar a la Guía',
          edit: 'Editar Medicamento',
          commercial: 'Nombre Comercial',
          commercialPlaceholder: 'Ej: Atamel, Voltarén...',
          generic: 'Nombre Genérico',
          genericPlaceholder: 'Ej: Acetaminofén, Diclofenaco...',
          components: 'Componentes Activos',
          componentsPlaceholder: 'Ej: Paracetamol 500mg, Cafeína 65mg...',
          componentsHint: 'Separe los componentes por comas.',
          presentation: 'Presentación',
          presentationPlaceholder: 'Ej: Tabletas 500mg, Jarabe 250ml/5mg',
          category: 'Categoría',
          categoryPlaceholder: 'Selecciona o escribe...',
          indications: 'Indicaciones',
          indicationsPlaceholder: 'Usos terapéuticos...',
          posology: 'Posología',
          posologyPlaceholder: 'Dosis recomendada, frecuencia...',
          contraindications: 'Contraindicaciones',
          contraindicationsPlaceholder: 'Situaciones donde está contraindicado...',
          adverseReactions: 'Reacciones Adversas',
          adverseReactionsPlaceholder: 'Efectos secundarios conocidos...',
          precautions: 'Precauciones',
          precautionsPlaceholder: 'Advertencias especiales, interacciones...',
          cancel: 'Cancelar',
          save: 'Guardar Cambios',
          create_btn: 'Crear Registro'
        },
        validation: 'Nombre y componentes activos son requeridos',
        savedOk: 'El medicamento fue guardado correctamente',
        deletedOk: 'Medicamento eliminado de la guía',
        confirmDelete: '¿Eliminar medicamento?',
        confirmDeleteText: 'Se eliminará "{{name}}" de la guía',
        yes: 'Sí, eliminar',
        no: 'Cancelar'
      },
      landing: {
        title: 'Tu Socio en',
        subtitle: 'Salud Digital',
        description: 'Gestiona tu clínica con la plataforma más avanzada. Optimiza citas, historiales clínicos y comunicación con pacientes de forma segura y eficiente.',
        security: 'Seguridad Total',
        securityDesc: 'Protección de datos bajo estándares internacionales.',
        reminders: 'Recordatorios',
        remindersDesc: 'Automatiza avisos por WhatsApp a tus pacientes.',
        loginTitle: 'Iniciar Sesión',
        loginDesc: 'Ingresa tus credenciales para acceder',
        forgotPassword: '¿Olvidaste tu contraseña?',
        enterSystem: 'Ingresar al Sistema',
        noAccount: '¿No tienes cuenta?',
        registerHere: 'Regístrate aquí',
        publicBooking: 'Agendar Cita (Sin cuenta)',
        accountType: 'Tipo de Cuenta',
        professional: 'Profesional Independiente (Médicos)',
        clinic: 'Clínica / Centro Médico',
        hospital: 'Hospital / Institución',
        businessName: 'Nombre Institucional / Comercial',
        businessNamePlaceholder: 'Ej: Clínica San José'
      },
      register: {
        title: 'Crear Cuenta',
        subtitle: 'Únete a nuestra plataforma',
        patient: 'Paciente',
        provider: 'Proveedor de Salud',
        license: 'Número de Colegiatura / Licencia',
        address: 'Dirección de la Sede',
        success: '¡Registro Exitoso!',
        error: 'Error de Registro',
        patientDesc: 'Accede a tu historial médico y agenda citas fácilmente',
        professionalDesc: 'Gestiona tu consulta privada y pacientes',
        clinicDesc: 'Administra tu centro médico y personal',
        hospitalDesc: 'Solución completa para instituciones médicas'
      },
      dashboard: {
        controlPanel: 'Panel de Control',
        welcome: 'Bienvenido',
        report: 'Reporte',
        newAppointment: 'Nueva Cita',
        activity: 'Actividad',
        days7: '7 días',
        days30: '30 días',
        upcoming: 'Próximas Citas',
        noUpcoming: 'No hay citas programadas',
        viewPatients: 'Ver pacientes',
        medicalCitas: 'Mis Próximas Citas Médicas',
        myResults: 'Mis Resultados',
        recentExams: 'Ver exámenes recientes',
        confirmed: 'Confirmada',
        newAptDesc: 'Programa tu próxima visita médica fácilmente.',
        bookNow: 'Agendar Ahora',
        stats: {
          totalPatients: 'Pacientes Totales',
          appointments: 'Citas Hoy',
          income: 'Ingresos Mes',
          pending: 'Pendientes',
          inPerson: 'Presenciales',
          videoCalls: 'Videoconsultas',
          specialtyBreakdown: 'Rendimiento por Especialidad',
          toAttend: 'Por Atender',
          attended: 'Atendidas',
          incomeAnalysis: 'Análisis de Ingresos',
          daily: 'Diario',
          weekly: 'Semanal',
          monthly: 'Mensual'
        },
        reminderSent: 'Recordatorio enviado',
        active: 'Activo'
      },
      navbar: {
        updateInfo: 'Actualizar Datos',
        changePassword: 'Cambiar Contraseña',
        logout: 'Cerrar Sesión',
        profile: 'Perfil'
      },
      roles: {
        ADMIN: 'Administrador',
        DOCTOR: 'Médico',
        PATIENT: 'Paciente',
        NURSE: 'Enfermería',
        STAFF: 'Administrativo'
      },
      specialties: {
        all: 'Todas',
        cardiology: 'Cardiología',
        pediatrics: 'Pediatría',
        gynecology: 'Ginecología'
      },
      nurses: {
        title: 'Personal de Enfermería',
        subtitle: 'Gestión de perfiles, turnos y especialidades del equipo de enfermería',
        new: 'Nueva Enfermera/o',
        searchPlaceholder: 'Buscar por nombre o especialización...',
        allShifts: 'Todos los turnos',
        filters: 'Filtros',
        table: {
          nurse: 'Enfermero/a',
          specialty: 'Especialización',
          shift: 'Turno',
          license: 'Licencia'
        },
        noResults: 'No se encontraron enfermeros',
        filtersCleared: 'Filtros Limpiados',
        filtersClearedMsg: 'Se han restablecido todos los filtros',
        showing: 'Mostrando',
        of: 'de',
        fields: {
          firstName: 'Nombre',
          lastName: 'Apellido',
          email: 'Email',
          phone: 'Teléfono',
          license: 'Licencia',
          shift: 'Turno',
          specialization: 'Especialización',
          password: 'Contraseña',
          passwordPlaceholder: 'Mínimo 6 caracteres'
        },
        shifts: {
          morning: 'Mañana',
          afternoon: 'Tarde',
          night: 'Noche',
          rotating: 'Rotativo'
        },
        specialties: {
          general: 'Enfermería General',
          icu: 'Cuidados Intensivos',
          pediatrics: 'Pediatría',
          surgery: 'Quirófano',
          emergency: 'Emergencias',
          geriatrics: 'Geriatría',
          neonatology: 'Neonatología',
          oncology: 'Oncología'
        },
        messages: {
          created: '¡Enfermera/o Creada/o!',
          createdMsg: 'El personal de enfermería ha sido registrado exitosamente.',
          deleted: '¡Eliminado!',
          deletedMsg: 'Registro eliminado exitosamente.',
          confirmDelete: '¿Confirmar eliminación?',
          confirmDeleteText: 'Se borrará el registro del enfermero/a.',
          yesDelete: 'Sí, eliminar',
          errorDelete: 'No se pudo eliminar el registro',
          completeRequired: 'Por favor completa todos los campos obligatorios'
        }
      },
      lab: {
        title: 'Laboratorio',
        subtitle: 'Gestión de resultados y exámenes médicos',
        new: 'Nuevo Resultado',
        searchPlaceholder: 'Buscar por paciente...',
        examType: 'Tipo de Examen',
        table: {
          patient: 'PACIENTE',
          exam: 'TIPO EXAMEN',
          date: 'FECHA'
        }
      },
      patients_list: {
        title: 'Pacientes',
        subtitle: 'Gestiona el padrón de pacientes de la clínica',
        new: 'Nuevo Paciente',
        searchPlaceholder: 'Buscar por nombre, apellido o ID...',
        allGenders: 'Todos los géneros',
        table: {
          patient: 'Paciente',
          document: 'ID / Documento',
          gender: 'Género',
          phone: 'Teléfono'
        }
      },
      appointments_list: {
        title: 'Agendamiento de Citas',
        subtitle: 'Gestión de turnos médicos y disponibilidad',
        new: 'Agendar Nueva Cita',
        filterSpecialty: 'Filtrar por Especialidad',
        all: 'Todas',
        whatsappService: 'Recordatorios WhatsApp',
        serviceActive: 'Servicio Activo',
        whatsappDesc: 'Se enviarán recordatorios automáticamente al agendar.',
        scheduled: 'Citas Agendadas',
        tabs: {
          day: 'Día',
          week: 'Semana',
          month: 'Mes'
        },
        doctorSpecialty: 'Doctor / Especialidad',
        time: 'Hora',
        reason: 'Motivo de Consulta',
        reasonPlaceholder: 'Ej: Control Mensual',
        notes: 'Observaciones (Opcional)',
        videoCall: 'Videollamada',
        success: '¡Cita Agendada!',
        success_msg: 'La cita ha sido registrada exitosamente.',
        success_info: 'Se ha enviado una notificación automática, pero puedes usar estos accesos directos:',
        error_create: 'No se pudo agendar la cita. Por favor, intenta de nuevo.'
      },
      video_history: {
        title: 'Historial de Videoconsultas',
        subtitle: 'Registro de llamadas realizadas y programadas',
        sidebar: 'Videoconsultas',
        starting: 'Iniciando videoconsulta...',
        wait: 'Por favor espera',
        error_init: 'No se pudo iniciar la videoconsulta. Intenta de nuevo.'
      },
      doctors: {
        title: 'Equipo Médico',
        subtitle: 'Directorio de doctores y especialistas',
        new: 'Nuevo Doctor',
        searchPlaceholder: 'Buscar por nombre o especialidad...',
        allSpecialties: 'Todas las especialidades',
        noResults: 'No se encontraron doctores con esos criterios.',
        viewProfile: 'Ver Perfil',
        schedule: 'Agendar',
        available: 'Disponible'
      },
      billing: {
        title: 'Mi Suscripción',
        subtitle: 'Gestiona tu plan y historial de facturación',
        sidebar: 'Estado de Suscripción',
        updatePlan: 'Actualizar Plan',
        timeRemaining: 'Tiempo Restante',
        days: 'días',
        expiresOn: 'Vence el',
        reminderNotice: 'Recibirás un recordatorio 2 días antes del vencimiento.',
        paymentHistory: 'Historial de Pagos',
        noPayments: 'No tienes pagos de suscripción registrados aún.',
        table: {
          date: 'FECHA',
          concept: 'CONCEPTO',
          method: 'MÉTODO',
          amount: 'MONTO',
          status: 'ESTADO',
          receipt: 'RECIBO'
        }
      },
      team: {
        title: 'Gestión de Equipo',
        subtitle: 'Administra los miembros de tu organización.',
        sidebar: 'Mi Equipo',
        addMember: 'Añadir Miembro',
        newMember: 'Nuevo Miembro',
        role: 'Rol',
        selectRole: 'Seleccionar Rol',
        gender: 'Género',
        license: 'Licencia / ID',
        invitationButton: 'Guardar y Enviar Invitación',
        member: 'Miembro',
        noMembers: 'No hay miembros en tu equipo aún.',
        messages: {
          loading: 'Añadiendo miembro...',
          success: 'Miembro añadido correctamente',
          confirmDelete: '¿Estás seguro?',
          confirmDeleteText: 'Esta acción no se puede deshacer.',
          yesDelete: 'Sí, eliminar'
        }
      },
      subscription: {
        trialTitle: '¡Prueba Gratis por 7 Días!',
        trialDesc: 'Experimenta todas las funcionalidades premium sin compromiso.',
        sidebar: 'Planes y Precios',
        startTrial: 'Comenzar Prueba',
        activeSession: 'Sesión Activa',
        pricingTitle: 'PLANES Y PRECIOS',
        choosePlan: 'Elige el plan perfecto para tu organización',
        scalePlan: 'Escala tu plan a medida que crece tu práctica.',
        choosePlanBtn: 'Elegir Plan',
        currentPlan: 'Plan Actual',
        customDeployment: '¿Necesitas un despliegue personalizado?',
        customDeploymentDesc: 'Si eres una red de hospitales o una corporación multinacional, contacta con nuestro equipo para una solución a medida.',
        supportEmail: 'Email de Atención',
        recommended: 'Recomendado',
        monthly: 'mes',
        quarterly: 'trimestre',
        semester: 'semestre',
        yearly: 'año'
      },
      public_booking: {
        backToLogin: 'Volver al Login',
        title: 'Agenda tu Cita Médica',
        subtitle: 'Rápido, fácil y sin necesidad de crear una cuenta',
        steps: {
          personal: 'Tus Datos',
          appointment: 'Agendar Cita'
        },
        personalInfo: {
          title: 'Información Personal',
          firstName: 'Nombre',
          lastName: 'Apellido',
          email: 'Email',
          phone: 'Teléfono / WhatsApp',
          document: 'Cédula / Documento',
          placeholders: {
            firstName: 'Juan',
            lastName: 'Pérez',
            email: 'correo@ejemplo.com',
            phone: '+58 424-1234567',
            document: 'V-12345678'
          }
        },
        appointmentInfo: {
          title: 'Detalles de la Cita',
          doctor: 'Doctor / Especialidad',
          doctorPlaceholder: 'Selecciona un doctor...',
          date: 'Fecha',
          time: 'Hora',
          timePlaceholder: 'Selecciona una hora...',
          reason: 'Motivo de Consulta',
          reasonPlaceholder: 'Ej: Consulta General, Control, Chequeo...',
          notes: 'Observaciones (Opcional)',
          notesPlaceholder: 'Información adicional que quieras compartir...'
        },
        actions: {
          continue: 'Continuar',
          back: 'Atrás',
          confirm: 'Confirmar Cita',
          booking: 'Agendando...',
          hasAccount: '¿Ya tienes cuenta?',
          loginNow: 'Inicia sesión'
        },
        errors: {
          required: 'Este campo es requerido',
          email: 'Email inválido',
          pattern: 'Formato inválido',
          general: 'No se pudo agendar la cita. Por favor, intenta de nuevo.'
        },
        success: {
          title: '¡Cita Agendada!',
          msg: 'Tu cita ha sido registrada exitosamente.',
          notification: 'Hemos enviado la confirmación a tu WhatsApp y email.',
          calendar: 'Calendario',
          didYouKnow: '💡 ¿Sabías que puedes crear una cuenta?',
          accountBenefits: 'Con una cuenta podrás ver tu historial de citas, reagendar y mucho más.',
          createAccount: 'Crear Cuenta',
          gotIt: 'Entendido'
        }
      },
      lab_catalog: {
        title: 'Catálogo de Laboratorio',
        subtitle: 'Gestión de exámenes individuales y perfiles combinados',
        rateInfo: 'Tu Guía de Precios y Tasa BCV',
        rateDetail: 'Mantenemos nuestros precios actualizados según la tasa oficial de 1 USD = ',
        showingInUsd: 'Mostrando en Dólares ($)',
        showingInVes: 'Mostrando en Bolívares (Bs)',
        bulkImport: 'Carga Masiva (CSV)',
        newTest: 'Nuevo Examen',
        newCombo: 'Nuevo Combo',
        testsTab: 'Exámenes Individuales',
        combosTab: 'Combos y Perfiles',
        table: {
          category: 'Categoría / Examen',
          price: 'Precio (USD)',
          status: 'Estado',
          actions: 'Acciones'
        },
        active: 'Activo',
        inactive: 'Inactivo',
        noTests: 'No hay exámenes registrados.',
        noCombos: 'No hay combos o perfiles registrados.',
        includes: 'Incluye:',
        comboPrice: 'Precio Combo',
        modals: {
          editTest: 'Editar Examen',
          newTest: 'Nuevo Examen',
          testName: 'Nombre del Examen',
          price: 'Precio (USD)',
          category: 'Categoría',
          description: 'Descripción (Opcional)',
          editCombo: 'Editar Combo/Perfil',
          newCombo: 'Nuevo Combo/Perfil',
          comboName: 'Nombre del Combo',
          suggestedPrice: 'Precio Total Sugerido (USD)',
          selectTests: 'Seleccionar Exámenes Incluidos',
          importTitle: 'Importar Exámenes (CSV)',
          importText: 'Seleccione un archivo CSV con las columnas: name, price, category, description.',
          importSuccess: 'Importación Finalizada',
          imported: 'Exitosos',
          failed: 'Fallidos'
        }
      }
    },
    en: {
      common: {
        dashboard: 'Dashboard',
        search: 'Search...',
        actions: 'Actions',
        status: 'Status',
        save: 'Save',
        cancel: 'Cancel',
        loading: 'Loading...',
        printing: 'Printing...',
        success: 'Success!',
        error: 'Error',
        warning: 'Warning',
        noResults: 'No results found',
        doctor: 'Doctor',
        birthDate: 'Birth Date',
        male: 'Male',
        female: 'Female',
        username: 'Username',
        confirm: 'Confirm'
      },
      auth: {
        login: 'Login',
        register: 'Register',
        logout: 'Logout',
        email: 'Email',
        password: 'Password'
      },
      payments: {
        title: 'Payment Control',
        subtitle: 'Billing and account statement management',
        newPayment: 'New Payment',
        export: 'Export Report',
        reference: 'Reference',
        patient: 'Patient',
        concept: 'Concept',
        amount: 'Amount',
        fecha: 'Date',
        collect: 'Collect',
        receipt: 'Receipt',
        pending: 'Pending',
        paid: 'Paid',
        doctorConsultation: 'Consultation / Doctor',
        generalPayment: 'General Payment',
        edit: 'Edit Payment',
        delete: 'Delete Payment',
        registerTitle: 'Register Appointment Payment',
        editTitle: 'Edit Appointment Payment',
        payCurrency: 'Payment Currency',
        bankPlatform: 'Bank / Platform',
        updateReceipt: 'Update Receipt (Optional)',
        hasAttachment: 'Already has an attachment',
        selectAppointment: 'Appointment to Pay',
        method: 'Payment Method',
        select: 'Select...',
        bankPlatformPlaceholder: 'e.g. Banesco, Mercantil, Zelle...',
        refPlaceholder: 'Last 4-6 digits',
        payDate: 'Payment Date',
        attachReceipt: 'Attach Receipt (Optional)',
        saveChanges: 'Save Changes',
        confirmDelete: 'Are you sure?',
        confirmDeleteText: 'This action will permanently delete the payment record.',
        yesDelete: 'Yes, delete',
        deleted: 'Deleted',
        deletedMsg: 'The payment has been deleted.',
        updated: 'Updated',
        updatedMsg: 'Your payment has been successfully updated.'
      },
      medical_history: {
        title: 'Patient History',
        subtitle: 'Detailed record of consultations, treatments, and evolution',
        selectPatient: 'Select a Patient to view their History',
        id: 'ID',
        phone: 'Phone',
        gender: 'Gender',
        newRecord: 'New Medical Record',
        changePatient: 'Change Patient',
        tabs: {
          consultations: 'Consultations',
          labs: 'Laboratory',
          treatments: 'Treatments'
        },
        diagnosis: 'Diagnosis',
        physicalExam: 'Physical Exam',
        treatment: 'Treatment',
        indications: 'Indications',
        medicalLeave: 'Medical Leave',
        leaveDays: 'Leave Days',
        startDate: 'Start Date',
        endDate: 'End Date',
        save: 'Save Record to History',
        noRecords: 'No medical records for this patient.',
        diagnosisPlaceholder: 'Enter main diagnosis...',
        examPlaceholder: 'Physical exam details...',
        treatmentPlaceholder: 'Medications and dosage...',
        indicationsPlaceholder: 'General recommendations...',
        viewPdf: 'View PDF',
        noLabs: 'No lab results found for this patient.',
        treatmentsSummary: 'Treatments Summary',
        noTreatments: 'No active treatments recorded.'
      },
      sidebar: {
        medicalManagement: 'MEDICAL MANAGEMENT',
        appointments: 'Appointments',
        history: 'Patient History',
        patients: 'Patients',
        lab: 'Laboratory',
        medicalStaff: 'MEDICAL STAFF',
        doctors: 'Doctors',
        nurses: 'Nursing',
        administration: 'ADMINISTRATION',
        staff: 'Staff Members',
        payments: 'Payments',
        bank: 'Bank',
        instrument: 'Payment Type',
        method: 'Method',
        cash: 'Cash',
        transfer: 'Transfer',
        mobile: 'Mobile Payment',
        debit: 'Debit Card',
        credit: 'Credit Card',
        currency: 'Currency',
        bulkData: 'Bulk Import',
        drugGuide: 'Drug Guide',
        labCatalog: 'Lab Catalog'
      },
      drug_guide: {
        title: 'Spilva Drug Guide',
        subtitle: 'Reference for drug components, dosage and indications.',
        vademecumLabel: 'Venezuela Online Vademecum',
        vademecumDesc: 'Access the complete directory of drugs available in Venezuela.',
        vademecumLink: 'Open Vademecum',
        newDrug: 'New Drug',
        searchPlaceholder: 'Search by name, generic or components...',
        allCategories: 'All categories',
        search: 'Search',
        noResults: 'No drugs found',
        noResultsHint: 'Try different terms or add the first one.',
        results: 'results',
        table: {
          commercial: 'Commercial Name',
          generic: 'Generic Name',
          components: 'Active Components',
          presentation: 'Presentation',
          category: 'Category',
          actions: 'Actions'
        },
        noCategory: 'Uncategorized',
        detail: {
          title: 'Drug Detail',
          presentation: 'Presentation',
          category: 'Category',
          components: 'Active Components',
          indications: 'Indications',
          posology: 'Dosage',
          contraindications: 'Contraindications',
          adverseReactions: 'Adverse Reactions',
          precautions: 'PRECAUTIONS',
          noSpecified: 'Not specified',
          close: 'Close',
          edit: 'Edit'
        },
        form: {
          create: 'Add to Guide',
          edit: 'Edit Drug',
          commercial: 'Commercial Name',
          commercialPlaceholder: 'e.g. Tylenol, Voltaren...',
          generic: 'Generic Name',
          genericPlaceholder: 'e.g. Acetaminophen, Diclofenac...',
          components: 'Active Components',
          componentsPlaceholder: 'e.g. Paracetamol 500mg, Caffeine 65mg...',
          componentsHint: 'Separate components with commas.',
          presentation: 'Presentation',
          presentationPlaceholder: 'e.g. Tablets 500mg, Syrup 250ml/5mg',
          category: 'Category',
          categoryPlaceholder: 'Select or type...',
          indications: 'Indications',
          indicationsPlaceholder: 'Therapeutic uses...',
          posology: 'Dosage',
          posologyPlaceholder: 'Recommended dose, frequency...',
          contraindications: 'Contraindications',
          contraindicationsPlaceholder: 'Situations where it is contraindicated...',
          adverseReactions: 'Adverse Reactions',
          adverseReactionsPlaceholder: 'Known side effects...',
          precautions: 'Precautions',
          precautionsPlaceholder: 'Special warnings, interactions...',
          cancel: 'Cancel',
          save: 'Save Changes',
          create_btn: 'Create Record'
        },
        validation: 'Name and active components are required',
        savedOk: 'Drug saved successfully',
        deletedOk: 'Drug removed from the guide',
        confirmDelete: 'Delete drug?',
        confirmDeleteText: 'This will remove "{{name}}" from the guide',
        yes: 'Yes, delete',
        no: 'Cancel'
      },
      landing: {
        title: 'Your Partner in',
        subtitle: 'Digital Health',
        description: 'Manage your clinic with the most advanced platform. Optimize appointments, medical records, and patient communication securely and efficiently.',
        security: 'Total Security',
        securityDesc: 'Data protection under international standards.',
        reminders: 'Reminders',
        remindersDesc: 'Automate WhatsApp alerts for your patients.',
        loginTitle: 'Log In',
        loginDesc: 'Enter your credentials to access',
        forgotPassword: 'Forgot your password?',
        enterSystem: 'Log In',
        noAccount: "Don't have an account?",
        registerHere: 'Register here',
        publicBooking: 'Schedule Appointment (No account)',
        accountType: 'Account Type',
        professional: 'Independent Professional',
        clinic: 'Clinic / Medical Center',
        hospital: 'Hospital / Institution',
        businessName: 'Institutional / Business Name',
        businessNamePlaceholder: 'e.g. St. Joseph Clinic'
      },
      register: {
        title: 'Create Account',
        subtitle: 'Join our platform',
        patient: 'Patient',
        provider: 'Healthcare Provider',
        license: 'Medical License Number',
        address: 'Office Address',
        success: 'Registration Successful!',
        error: 'Registration Error',
        patientDesc: 'Access your medical history and book appointments easily',
        professionalDesc: 'Manage your private practice and patients',
        clinicDesc: 'Manage your medical center and staff',
        hospitalDesc: 'Complete solution for medical institutions'
      },
      dashboard: {
        controlPanel: 'Control Panel',
        welcome: 'Welcome',
        report: 'Report',
        newAppointment: 'New Appointment',
        activity: 'Activity',
        days7: '7 days',
        days30: '30 days',
        upcoming: 'Upcoming Appointments',
        noUpcoming: 'No scheduled appointments',
        viewPatients: 'View patients',
        medicalCitas: 'My Upcoming Medical Appointments',
        myResults: 'My Results',
        recentExams: 'See recent exams',
        confirmed: 'Confirmed',
        newAptDesc: 'Schedule your next medical visit easily.',
        bookNow: 'Book Now',
        stats: {
          totalPatients: 'Total Patients',
          appointments: 'Today\'s Appointments',
          income: 'Month Revenue',
          pending: 'Pending',
          inPerson: 'In-Person',
          videoCalls: 'Video Calls',
          specialtyBreakdown: 'Specialty Performance',
          toAttend: 'To Attend',
          attended: 'Attended',
          incomeAnalysis: 'Income Analysis',
          daily: 'Daily',
          weekly: 'Weekly',
          monthly: 'Monthly'
        },
        reminderSent: 'Reminder sent',
        active: 'Active'
      },
      specialties: {
        all: 'All',
        cardiology: 'Cardiology',
        pediatrics: 'Pediatrics',
        gynecology: 'Gynecology'
      },
      nurses: {
        title: 'Nursing Staff',
        subtitle: 'Profile, shift, and specialty management of the nursing team',
        new: 'New Nurse',
        searchPlaceholder: 'Search by name or specialty...',
        allShifts: 'All shifts',
        filters: 'Filters',
        table: {
          nurse: 'Nurse',
          specialty: 'Specialty',
          shift: 'Shift',
          license: 'License'
        },
        noResults: 'No nurses found',
        filtersCleared: 'Filters Cleared',
        filtersClearedMsg: 'All filters have been reset',
        showing: 'Showing',
        of: 'of',
        fields: {
          firstName: 'First Name',
          lastName: 'Last Name',
          email: 'Email',
          phone: 'Phone',
          license: 'License',
          shift: 'Shift',
          specialization: 'Specialty',
          password: 'Password',
          passwordPlaceholder: 'Minimum 6 characters'
        },
        shifts: {
          morning: 'Morning',
          afternoon: 'Afternoon',
          night: 'Night',
          rotating: 'Rotating'
        },
        specialties: {
          general: 'General Nursing',
          icu: 'Intensive Care (ICU)',
          pediatrics: 'Pediatrics',
          surgery: 'Surgery',
          emergency: 'Emergency',
          geriatrics: 'Geriatrics',
          neonatology: 'Neonatology',
          oncology: 'Oncology'
        },
        messages: {
          created: 'Nurse Created!',
          createdMsg: 'Nursing staff has been successfully registered.',
          deleted: 'Deleted!',
          deletedMsg: 'Record successfully deleted.',
          confirmDelete: 'Confirm deletion?',
          confirmDeleteText: 'This will delete the nurse record.',
          yesDelete: 'Yes, delete',
          errorDelete: 'Could not delete the record',
          completeRequired: 'Please complete all required fields'
        }
      },
      lab: {
        title: 'Laboratory',
        subtitle: 'Medical results and exams management',
        new: 'New Result',
        searchPlaceholder: 'Search by patient...',
        examType: 'Exam Type',
        table: {
          patient: 'PATIENT',
          exam: 'EXAM TYPE',
          date: 'DATE'
        }
      },
      patients_list: {
        title: 'Patients',
        subtitle: 'Manage the clinic patient database',
        new: 'New Patient',
        searchPlaceholder: 'Search by name, last name or ID...',
        allGenders: 'All genders',
        table: {
          patient: 'Patient',
          document: 'ID / Documento',
          gender: 'Gender',
          phone: 'Phone'
        }
      },
      appointments_list: {
        title: 'Appointment Scheduling',
        subtitle: 'Medical shifts and availability management',
        new: 'Schedule New Appointment',
        filterSpecialty: 'Filter by Specialty',
        all: 'All',
        whatsappService: 'WhatsApp Reminders',
        serviceActive: 'Service Active',
        whatsappDesc: 'Reminders will be sent automatically when scheduling.',
        scheduled: 'Scheduled Appointments',
        tabs: {
          day: 'Day',
          week: 'Week',
          month: 'Month'
        },
        doctorSpecialty: 'Doctor / Specialty',
        time: 'Time',
        reason: 'Reason for Visit',
        reasonPlaceholder: 'e.g. Monthly Checkup',
        notes: 'Notes (Optional)',
        videoCall: 'Video Call',
        success: 'Appointment Scheduled!',
        success_msg: 'The appointment has been registered successfully.',
        success_info: 'An automatic notification has been sent, but you can use these shortcuts:',
        error_create: 'Could not schedule the appointment. Please try again.'
      },
      video_history: {
        title: 'Video Consultation History',
        subtitle: 'Record of made and scheduled calls',
        sidebar: 'Video Calls',
        starting: 'Starting video consultation...',
        wait: 'Please wait',
        error_init: 'Could not start the video consultation. Please try again.'
      },
      doctors: {
        title: 'Medical Team',
        subtitle: 'Directory of doctors and specialists',
        new: 'New Doctor',
        searchPlaceholder: 'Search by name or specialty...',
        allSpecialties: 'All specialties',
        noResults: 'No doctors found with those criteria.',
        viewProfile: 'View Profile',
        schedule: 'Schedule',
        available: 'Available'
      },
      billing: {
        title: 'My Subscription',
        subtitle: 'Manage your plan and billing history',
        sidebar: 'Subscription Status',
        updatePlan: 'Upgrade Plan',
        timeRemaining: 'Time Remaining',
        days: 'days',
        expiresOn: 'Expires on',
        reminderNotice: 'You will receive a reminder 2 days before expiration.',
        paymentHistory: 'Payment History',
        noPayments: 'You have no subscription payments recorded yet.',
        table: {
          date: 'DATE',
          concept: 'CONCEPT',
          method: 'METHOD',
          amount: 'AMOUNT',
          status: 'STATUS',
          receipt: 'RECEIPT'
        }
      },
      team: {
        title: 'Team Management',
        subtitle: 'Manage your organization members.',
        sidebar: 'My Team',
        addMember: 'Add Member',
        newMember: 'New Member',
        role: 'Role',
        selectRole: 'Select Role',
        gender: 'Gender',
        license: 'License / ID',
        invitationButton: 'Save and Send Invitation',
        member: 'Member',
        noMembers: 'No members in your team yet.',
        messages: {
          loading: 'Adding member...',
          success: 'Member added successfully',
          confirmDelete: 'Are you sure?',
          confirmDeleteText: 'This action cannot be undone.',
          yesDelete: 'Yes, delete'
        }
      },
      subscription: {
        trialTitle: '7-Day Free Trial!',
        trialDesc: 'Experience all premium features with no commitment.',
        sidebar: 'Plans & Pricing',
        startTrial: 'Start Trial',
        activeSession: 'Active Session',
        pricingTitle: 'PLANS & PRICING',
        choosePlan: 'Choose the perfect plan for your organization',
        scalePlan: 'Scale your plan as your practice grows.',
        choosePlanBtn: 'Choose Plan',
        currentPlan: 'Current Plan',
        customDeployment: 'Need a custom deployment?',
        customDeploymentDesc: 'If you are a hospital network or a multinational corporation, contact our team for a tailored solution.',
        supportEmail: 'Support Email',
        recommended: 'Recommended',
        monthly: 'month',
        quarterly: 'quarter',
        semester: 'semester',
        yearly: 'year'
      },
      navbar: {
        updateInfo: 'Update Info',
        changePassword: 'Change Password',
        logout: 'Logout',
        profile: 'Profile'
      },
      roles: {
        ADMIN: 'Administrator',
        DOCTOR: 'Doctor',
        PATIENT: 'Patient',
        NURSE: 'Nurse',
        STAFF: 'Staff'
      },
      public_booking: {
        backToLogin: 'Back to Login',
        title: 'Book your Medical Appointment',
        subtitle: 'Quick, easy and no account required',
        steps: {
          personal: 'Your Info',
          appointment: 'Schedule'
        },
        personalInfo: {
          title: 'Personal Information',
          firstName: 'First Name',
          lastName: 'Last Name',
          email: 'Email',
          phone: 'Phone / WhatsApp',
          document: 'ID / Document',
          placeholders: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'email@example.com',
            phone: '+1 555-123-4567',
            document: 'ID-12345678'
          }
        },
        appointmentInfo: {
          title: 'Appointment Details',
          doctor: 'Doctor / Specialty',
          doctorPlaceholder: 'Select a doctor...',
          date: 'Date',
          time: 'Time',
          timePlaceholder: 'Select a time...',
          reason: 'Reason for Visit',
          reasonPlaceholder: 'e.g. General Consultation, Checkup...',
          notes: 'Notes (Optional)',
          notesPlaceholder: 'Any additional information you want to share...'
        },
        actions: {
          continue: 'Continue',
          back: 'Back',
          confirm: 'Confirm Appointment',
          booking: 'Booking...',
          hasAccount: 'Already have an account?',
          loginNow: 'Login'
        },
        errors: {
          required: 'This field is required',
          email: 'Invalid email',
          pattern: 'Invalid format',
          general: 'Could not book appointment. Please try again.'
        },
        success: {
          title: 'Appointment Scheduled!',
          msg: 'Your appointment has been registered successfully.',
          notification: 'We have sent confirmation to your WhatsApp and email.',
          calendar: 'Calendar',
          didYouKnow: '💡 Did you know you can create an account?',
          accountBenefits: 'With an account you can view your appointment history, reschedule and more.',
          createAccount: 'Create Account',
          gotIt: 'Got it'
        }
      },
      lab_catalog: {
        title: 'Laboratory Catalog',
        subtitle: 'Management of individual tests and combined profiles',
        rateInfo: 'Your Pricing Guide & BCV Rate',
        rateDetail: 'We keep our prices updated according to the official rate of 1 USD = ',
        showingInUsd: 'Showing in Dollars ($)',
        showingInVes: 'Showing in Bolivars (Bs)',
        bulkImport: 'Bulk Import (CSV)',
        newTest: 'New Test',
        newCombo: 'New Combo',
        testsTab: 'Individual Tests',
        combosTab: 'Combos & Profiles',
        table: {
          category: 'Category / Test',
          price: 'Price (USD)',
          status: 'Status',
          actions: 'Actions'
        },
        active: 'Active',
        inactive: 'Inactive',
        noTests: 'No tests registered.',
        noCombos: 'No combos or profiles registered.',
        includes: 'Includes:',
        comboPrice: 'Combo Price',
        modals: {
          editTest: 'Edit Test',
          newTest: 'New Test',
          testName: 'Test Name',
          price: 'Price (USD)',
          category: 'Category',
          description: 'Description (Optional)',
          editCombo: 'Edit Combo/Profile',
          newCombo: 'New Combo/Profile',
          comboName: 'Combo Name',
          suggestedPrice: 'Suggested Total Price (USD)',
          selectTests: 'Select Included Tests',
          importTitle: 'Import Tests (CSV)',
          importText: 'Select a CSV file with columns: name, price, category, description.',
          importSuccess: 'Import Finished',
          imported: 'Successful',
          failed: 'Failed'
        }
      }
    }
  };

  constructor() {
    const savedLang = localStorage.getItem('lang') as Language;
    if (savedLang) {
      this.currentLang.set(savedLang);
    }
  }

  get lang() {
    return this.currentLang.asReadonly();
  }

  setLanguage(lang: Language) {
    this.currentLang.set(lang);
    localStorage.setItem('lang', lang);
  }

  // Método para obtener una traducción
  translate(path: string): string {
    const keys = path.split('.');
    let translation = this.translations[this.currentLang()];
    
    for (const key of keys) {
      if (translation[key]) {
        translation = translation[key];
      } else {
        return path; // Retorna el path si no encuentra traducción
      }
    }
    
    return translation;
  }
}
