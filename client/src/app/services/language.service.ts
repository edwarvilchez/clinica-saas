import { Injectable, signal, computed } from '@angular/core';

export type Language = 'es' | 'en';

const ES_DICT = {
  common: {
    search: 'Buscar...',
    actions: 'Acciones',
    status: 'Estado',
    save: 'Guardar',
    cancel: 'Cancelar',
    loading: 'Cargando...',
    error: 'Error',
    success: 'Éxito',
    warning: 'Advertencia',
    noResults: 'No se encontraron resultados',
    doctor: 'Médico',
    birthDate: 'Fecha de Nacimiento',
    username: 'Nombre de Usuario',
    confirm: 'Confirmar',
    edit: 'Editar',
    delete: 'Eliminar',
    view: 'Ver',
    male: 'Masculino',
    female: 'Femenino',
    other: 'Otro',
    filters: 'Filtros',
    advancedFilters: 'Filtros Avanzados',
    clearFilters: 'Limpiar Filtros',
    resultsOf: 'Mostrando {{count}} de {{total}} registros',
    select: 'Seleccione...',
    back: 'Volver',
    dashboard: 'Panel Principal',
    active: 'Activo',
    inactive: 'Inactivo'
  },
  auth: {
    login: 'Iniciar Sesión',
    register: 'Registrarse',
    logout: 'Cerrar Sesión',
    email: 'Email',
    password: 'Contraseña'
  },
  video_history: {
    sidebar: 'Videoconsultas',
    title: 'Historial de Videoconsultas'
  },
  team: {
    sidebar: 'Gestión de Equipo'
  },
  billing: {
    sidebar: 'Mi Suscripción'
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
    title: 'Historia Médica Digital',
    subtitle: 'Expediente clínico completo y cronológico del paciente',
    selectPatient: 'Seleccione un paciente para ver su historia',
    id: 'Cédula/ID',
    phone: 'Teléfono',
    gender: 'Género',
    newRecord: 'Nueva Consulta / Evolución',
    changePatient: 'Cambiar Paciente',
    physicalExam: 'Examen Físico / Motivo',
    treatment: 'Tratamiento Sugerido',
    diagnosis: 'Diagnóstico Clínico',
    indications: 'Indicaciones Médicas',
    save: 'Guardar Consulta',
    print: 'Imprimir Informe',
    export: 'Exportar Historia',
    examPlaceholder: 'Signos vitales, hallazgos físicos...',
    treatmentPlaceholder: 'Medicamentos y procedimientos...',
    indicationsPlaceholder: 'Reposo, dieta, cuidados...',
    medicalLeave: 'Reposo Médico / Constancia',
    leaveDays: 'Días de reposo',
    startDate: 'Fecha Inicio',
    endDate: 'Fecha Fin (Estimada)',
    tabs: {
      consultations: 'Consultas',
      labs: 'Laboratorio',
      treatments: 'Tratamientos'
    },
    prescription: {
      title: 'Receta Médica (Rp)',
      search: 'Buscar medicamento...',
      drug: 'Medicamento',
      dosage: 'Dosis',
      frequency: 'Frecuencia',
      duration: 'Duración',
      empty: 'No hay medicamentos agregados a la receta'
    }
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
    drugGuide: 'Guía Farmacéutica',
    administration: 'ADMINISTRACIÓN',
    staff: 'Mi Personal',
    payments: 'Control de Pagos',
    config: 'CONFIGURACIÓN',
    bulkData: 'Carga Masiva',
    myTeam: 'Gestión de Equipo',
    billing: 'Mi Suscripción',
    dashboard: 'Panel Principal',
    labCatalog: 'Catálogo Lab'
  },
  navbar: {
    updateInfo: 'Actualizar Información',
    changePassword: 'Cambiar Contraseña',
    logout: 'Cerrar Sesión',
    updateRate: 'Actualizar Tasa BCV',
    rateHint: 'Tasa oficial del Banco Central'
  },
  roles: {
    SUPERADMIN: 'Super Administrador',
    ADMINISTRATIVE: 'Personal Administrativo',
    DOCTOR: 'Médico Especialista',
    NURSE: 'Enfermería',
    PATIENT: 'Paciente',
    RECEPTIONIST: 'Recepcionista'
  },
  drug_guide: {
    title: 'Guía Farmacéutica Digital',
    subtitle: 'Vademécum completo de medicamentos y posología',
    newDrug: 'Nuevo Medicamento',
    vademecumLabel: 'Consulta Externa Vademécum',
    vademecumDesc: 'Enlace directo a la base de datos farmacéutica oficial.',
    vademecumLink: 'Ir al Vademécum',
    searchPlaceholder: 'Buscar por nombre, principio activo...',
    search: 'Buscar',
    allCategories: 'Todas las categorías',
    noResults: 'No se encontraron medicamentos',
    noResultsHint: 'Intente con otro término o agregue uno nuevo a la base de datos.'
  },
  dashboard: {
    controlPanel: 'Panel de Control',
    welcome: 'Bienvenido de nuevo',
    report: 'Descargar Reporte',
    newAppointment: 'Nueva Cita',
    activity: 'Actividad de Citas',
    upcoming: 'Próximas Citas',
    days7: 'Últimos 7 días',
    stats: {
      totalPatients: 'Total Pacientes',
      income: 'Ingresos Totales',
      pending: 'Citas Pendientes',
      videoCalls: 'Video Llamadas',
      inPerson: 'Citas Presenciales',
      appointments: 'Citas',
      specialtyBreakdown: 'Distribución por Especialidad',
      incomeAnalysis: 'Análisis de Ingresos',
      daily: 'Ingreso Diario',
      weekly: 'Ingreso Semanal',
      monthly: 'Ingreso Mensual'
    },
    trial: {
      daysRemaining: 'Tu prueba gratuita finaliza en {{days}} días',
      trialDesc: 'Acceso total a todas las funciones premium habilitado.',
      upgradePlan: 'Actualizar Plan Ahora'
    },
    confirmed: 'Confirmada',
    reminderSent: 'Recordatorio Enviado'
  },
  appointments_list: {
    title: 'Agendamiento de Citas',
    subtitle: 'Gestión de consultas y lista de espera',
    newTitle: 'Nueva Cita',
    editTitle: 'Editar Cita',
    today: 'Citas de Hoy',
    all: 'Todas las Citas',
    pending: 'Pendientes',
    completed: 'Completadas',
    cancelled: 'Canceladas',
    table: {
      patient: 'Paciente',
      doctor: 'Médico',
      date: 'Fecha y Hora',
      status: 'Estado',
      reason: 'Motivo'
    },
    actions: {
      confirm: 'Confirmar Asistencia',
      cancel: 'Cancelar Cita',
      reschedule: 'Reprogramar',
      startConsultation: 'Iniciar Consulta'
    },
    filterSpecialty: 'Filtrar por Especialidad',
    whatsappService: 'Servicio de WhatsApp',
    serviceActive: 'Servicio Activo',
    scheduled: 'Citas Programadas',
    tabs: {
      day: 'Hoy',
      week: 'Semana',
      month: 'Mes'
    },
    new: 'Nueva Cita',
    whatsappDesc: 'Recordatorios automáticos para sus pacientes'
  },
  doctors: {
    title: 'Gestión de Especialistas',
    subtitle: 'Listado completo de médicos y profesionales de la salud',
    new: 'Nuevo Doctor',
    searchPlaceholder: 'Buscar por nombre o especialidad...',
    allSpecialties: 'Todas las especialidades',
    specialist: 'Especialista',
    viewProfile: 'Ver Perfil',
    schedule: 'Ver Agenda'
  },
  nurses: {
    title: 'Personal de Enfermería',
    subtitle: 'Gestión de turnos y asignaciones de enfermería',
    new: 'Nueva Enfermera',
    searchPlaceholder: 'Buscar enfermera...',
    allShifts: 'Todos los turnos',
    filters: 'Filtros',
    table: {
      nurse: 'Enfermera',
      specialty: 'Especialidad',
      shift: 'Turno',
      license: 'Licencia'
    }
  },
  booking: {
    personalInfo: 'Información Personal',
    firstName: 'Nombre',
    lastName: 'Apellido',
    docId: 'Cédula / Pasaporte',
    gender: 'Género',
    phone: 'Teléfono',
    birthDate: 'Fecha de Nacimiento',
    address: 'Dirección',
    appointmentInfo: 'Detalles de la Cita',
    specialty: 'Especialidad',
    doctor: 'Especialista',
    date: 'Fecha de la Cita',
    reason: 'Motivo de Consulta',
    additionalNotes: 'Notas Adicionales (Opcional)',
    submit: 'Agendar Cita Médica',
    successTitle: '¡Cita Agendada!',
    successMsg: 'Tu cita ha sido registrada exitosamente. Recibirás un correo de confirmación.',
    errorTitle: 'Error',
    errorMsg: 'No se pudo agendar la cita. Por favor verifique los datos.',
    placeholders: {
      firstName: 'Ej: Juan',
      lastName: 'Ej: Pérez',
      docId: 'Ej: 12345678',
      phone: 'Ej: 04121234567',
      address: 'Ciudad, Urbanización...',
      reason: 'Ej: Consulta General, Chequeo...',
      notes: 'Cualquier detalle adicional que desee compartir...',
      specialty: 'Selecciona una especialidad',
      doctor: 'Selecciona un especialista'
    }
  },
  lab: {
    title: 'Resultados de Laboratorio',
    subtitle: 'Gestión de analítica clínica y reportes',
    new: 'Nuevo Resultado',
    import: 'Importar Resultados',
    searchPlaceholder: 'Buscar por paciente o examen...',
    table: {
      date: 'Fecha',
      patient: 'Paciente',
      test: 'Prueba / Examen',
      results: 'Resultados',
      status: 'Estado',
      exam: 'Examen'
    },
    status: {
      pending: 'En Proceso',
      ready: 'Listo / Validado',
      delivered: 'Entregado'
    },
    examType: 'Tipo de Examen'
  },
  lab_catalog: {
    title: 'Catálogo de Exámenes',
    subtitle: 'Configuración de pruebas, perfiles y lista de precios',
    newTest: 'Nuevo Examen',
    newCombo: 'Nuevo Combo/Perfil',
    tabs: {
      tests: 'Exámenes Individuales',
      combos: 'Combos y Perfiles'
    },
    testsTab: 'Exámenes Individuales',
    combosTab: 'Combos y Perfiles',
    rateInfo: 'Tasa de Referencia',
    rateDetail: 'Monto en Bs. calculado según tasa oficial BCV:',
    showingInUsd: 'Precios en USD',
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
  },
  staff_list: {
    title: 'Personal Administrativo',
    subtitle: 'Gestión de roles administrativos, recepcionistas y personal operativo',
    new: 'Nuevo Personal',
    searchPlaceholder: 'Buscar por nombre, cargo o dpto...',
    allDepartments: 'Todos los departamentos',
    table: {
      staff: 'Personal',
      employeeId: 'ID Empleado',
      position: 'Cargo',
      department: 'Departamento'
    },
    noResults: 'No se encontraron miembros del personal',
    departments: {
      administration: 'Administración',
      reception: 'Recepción',
      accounting: 'Contabilidad',
      hr: 'Recursos Humanos',
      generalServices: 'Servicios Generales',
      security: 'Seguridad',
      maintenance: 'Mantenimiento',
      systems: 'Sistemas'
    }
  },
  bulk_import: {
    title: 'Carga Masiva de Datos',
    subtitle: 'Importación de registros mediante archivos CSV',
    config: 'Configuración de Carga',
    step1: '1. Seleccione Tipo de Dato',
    patients: 'Pacientes',
    doctors: 'Doctores',
    step2: '2. Descargar Plantilla',
    templateDesc: 'Utilice nuestra plantilla CSV estructurada para evitar errores de formato.',
    downloadTemplate: 'Descargar Plantilla (.csv)',
    step3: '3. Cargar Archivo',
    fileReady: 'Archivo listo',
    startImport: 'Iniciar Importación',
    processing: 'Procesando registros...',
    status: 'Estado de la Operación',
    emptyLabel: 'Los resultados de la importación aparecerán aquí',
    analyzing: 'Analizando archivo...',
    analyzingDesc: 'Esto puede tardar unos segundos dependiendo del tamaño del archivo.',
    summary: 'Resumen de transacciones procesadas.',
    importSummary: 'Importación finalizada: {{success}} exitosos, {{errors}} fallidos.',
    success: 'Exitosos',
    failed: 'Fallidos',
    errorDetail: 'Detalle de Errores',
    failedRecord: 'Registro Fallido',
    finished: 'Importación Finalizada',
    selectFileError: 'Por favor seleccione un archivo CSV',
    importError: 'Error al importar datos',
    template_filename: 'plantilla'
  },
  landing: {
    title: 'La Plataforma de Gestión Médica',
    subtitle: 'Más Avanzada del Mundo',
    description: 'Centralice su consulta, gestione historias médicas digitales y ofrezca videoconsultas premium con tecnología WebRTC de última generación.',
    pricing: 'Planes y Precios',
    pricingDesc: 'Desde gratuito hasta profesional',
    security: 'Seguridad ISO',
    securityDesc: 'Datos cifrados y blindaje legal',
    reminders: 'Recordatorios',
    remindersDesc: 'Alertas automáticas por WhatsApp',
    loginTitle: 'Acceso a la Plataforma',
    loginDesc: 'Ingresa tus credenciales para continuar',
    forgotPassword: '¿Olvidó su contraseña?',
    enterSystem: 'Entrar al Sistema',
    noAccount: '¿No tienes una cuenta aún?',
    registerHere: 'Regístrate aquí',
    publicBooking: 'Agendar Cita (Público)',
    businessName: 'Nombre del Centro / Consultorio',
    businessNamePlaceholder: 'Ej: Centro Médico San José'
  },
  patients_list: {
    title: 'Gestión de Pacientes',
    subtitle: 'Listado completo de pacientes registrados y expedientes',
    new: 'Nuevo Paciente',
    searchPlaceholder: 'Buscar por nombre o documento...',
    allGenders: 'Todos los géneros',
    table: {
      patient: 'Paciente',
      document: 'Documento ID',
      gender: 'Género',
      phone: 'Teléfono'
    }
  },
  register: {
    title: 'Crear cuenta en Clinica SaaS',
    join: 'Únete a',
    heroDesc: 'Crea tu cuenta y accede a la mejor plataforma de gestión clínica.',
    easyAgenda: 'Agenda Fácil',
    easyAgendaDesc: 'Reserva tus citas médicas en segundos.',
    digitalHistory: 'Historial Digital',
    digitalHistoryDesc: 'Accede a tu historial médico.',
    whoAreYou: '¿Quién eres?',
    selectAccountType: 'Selecciona el tipo de cuenta',
    completeData: 'Completa tus datos',
    firstName: 'Nombres',
    lastName: 'Apellidos',
    autoPassword: 'Contraseña generada automáticamente',
    autoPasswordDesc: 'Al crear tu cuenta, el sistema generará una contraseña temporal segura que se mostrará en pantalla. Deberás cambiarla en tu primer ingreso.',
    license: 'Colegiatura / Licencia',
    address: 'Dirección',
    bloodType: 'Tipo de Sangre',
    allergies: 'Alergias',
    acceptTerms: 'Acepto los términos. Datos bajo ISO 27001, ISO 9001 y GDPR.'
  }
};

const EN_DICT = {
  common: {
    search: 'Search...',
    actions: 'Actions',
    status: 'Status',
    save: 'Save',
    cancel: 'Cancel',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    noResults: 'No results found',
    doctor: 'Doctor',
    birthDate: 'Birth Date',
    username: 'Username',
    confirm: 'Confirm',
    edit: 'Edit',
    delete: 'Delete',
    view: 'View',
    male: 'Male',
    female: 'Female',
    other: 'Other',
    filters: 'Filters',
    advancedFilters: 'Advanced Filters',
    clearFilters: 'Clear Filters',
    resultsOf: 'Showing {{count}} of {{total}} records',
    select: 'Select...',
    back: 'Back',
    dashboard: 'Main Dashboard',
    printing: 'Print/Download',
    active: 'Active',
    inactive: 'Inactive'
  },
  auth: {
    login: 'Login',
    register: 'Register',
    logout: 'Logout',
    email: 'Email',
    password: 'Password'
  },
  video_history: {
    sidebar: 'Video Consultations',
    title: 'Video Consultation History'
  },
  team: {
    sidebar: 'Team Management'
  },
  billing: {
    sidebar: 'My Subscription'
  },
  payments: {
    title: 'Payment Control',
    subtitle: 'Billing management and account statements',
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
    title: 'Digital Medical History',
    subtitle: 'Complete and chronological clinical record of the patient',
    selectPatient: 'Select a patient to view their history',
    id: 'ID/Document',
    phone: 'Phone',
    gender: 'Gender',
    newRecord: 'New Consultation / Evolution',
    changePatient: 'Change Patient',
    physicalExam: 'Physical Exam / Reason',
    treatment: 'Suggested Treatment',
    diagnosis: 'Clinical Diagnosis',
    indications: 'Medical Indications',
    save: 'Save Consultation',
    print: 'Print Report',
    export: 'Export History',
    examPlaceholder: 'Vital signs, physical findings...',
    treatmentPlaceholder: 'Medications and procedures...',
    indicationsPlaceholder: 'Rest, diet, care...',
    medicalLeave: 'Medical Leave / Certificate',
    leaveDays: 'Leave days',
    startDate: 'Start Date',
    endDate: 'End Date (Estimated)',
    tabs: {
      consultations: 'Consultations',
      labs: 'Laboratory',
      treatments: 'Treatments'
    },
    prescription: {
      title: 'Medical Prescription (Rp)',
      search: 'Search medication...',
      drug: 'Medication',
      dosage: 'Dosage',
      frequency: 'Frequency',
      duration: 'Duration',
      empty: 'No medications added to the prescription'
    }
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
    drugGuide: 'Drug Guide',
    administration: 'ADMINISTRATION',
    staff: 'My Staff',
    payments: 'Payments Control',
    config: 'CONFIGURATION',
    bulkData: 'Bulk Import',
    myTeam: 'Team Management',
    billing: 'My Subscription',
    dashboard: 'Main Dashboard',
    labCatalog: 'Lab Catalog'
  },
  navbar: {
    updateInfo: 'Update Information',
    changePassword: 'Change Password',
    logout: 'Logout',
    updateRate: 'Update BCV Rate',
    rateHint: 'Official Central Bank Rate'
  },
  roles: {
    SUPERADMIN: 'Super Administrator',
    ADMINISTRATIVE: 'Administrative Staff',
    DOCTOR: 'Medical Specialist',
    NURSE: 'Nursing Staff',
    PATIENT: 'Patient',
    RECEPTIONIST: 'Receptionist'
  },
  drug_guide: {
    title: 'Digital Drug Guide',
    subtitle: 'Complete vademecum of medications and dosage',
    newDrug: 'New Medication',
    vademecumLabel: 'External Vademecum Query',
    vademecumDesc: 'Direct link to the official pharmaceutical database.',
    vademecumLink: 'Go to Vademecum',
    searchPlaceholder: 'Search by name, active ingredient...',
    search: 'Search',
    allCategories: 'All categories',
    noResults: 'No medications found',
    noResultsHint: 'Try another term or add a new one to the database.'
  },
  dashboard: {
    controlPanel: 'Control Panel',
    welcome: 'Welcome back',
    report: 'Download Report',
    newAppointment: 'New Appointment',
    activity: 'Appointment Activity',
    upcoming: 'Upcoming Appointments',
    days7: 'Last 7 days',
    stats: {
      totalPatients: 'Total Patients',
      income: 'Total Income',
      pending: 'Pending Appointments',
      videoCalls: 'Video Calls',
      inPerson: 'In-Person Appointments',
      appointments: 'Appointments',
      specialtyBreakdown: 'Specialty Breakdown',
      incomeAnalysis: 'Income Analysis',
      daily: 'Daily Income',
      weekly: 'Weekly Income',
      monthly: 'Monthly Income'
    },
    trial: {
      daysRemaining: 'Your free trial ends in {{days}} days',
      trialDesc: 'Full access to all premium features enabled.',
      upgradePlan: 'Upgrade Plan Now'
    },
    confirmed: 'Confirmed',
    reminderSent: 'Reminder Sent'
  },
  appointments_list: {
    title: 'Appointment Scheduling',
    subtitle: 'Management of consultations and waiting list',
    newTitle: 'New Appointment',
    editTitle: 'Edit Appointment',
    today: 'Today\'s Appointments',
    all: 'All Appointments',
    pending: 'Pending',
    completed: 'Completed',
    cancelled: 'Cancelled',
    table: {
      patient: 'Patient',
      doctor: 'Doctor',
      date: 'Date & Time',
      status: 'Status',
      reason: 'Reason'
    },
    actions: {
      confirm: 'Confirmar Attendance',
      cancel: 'Cancel Appointment',
      reschedule: 'Reschedule',
      startConsultation: 'Start Consultation'
    },
    filterSpecialty: 'Filter by Specialty',
    whatsappService: 'WhatsApp Service',
    serviceActive: 'Service Active',
    scheduled: 'Scheduled Appointments',
    tabs: {
      day: 'Today',
      week: 'Week',
      month: 'Month'
    },
    new: 'New Appointment',
    whatsappDesc: 'Automatic reminders for your patients'
  },
  doctors: {
    title: 'Specialists Management',
    subtitle: 'Complete list of doctors and healthcare professionals',
    new: 'New Doctor',
    searchPlaceholder: 'Search by name or specialty...',
    allSpecialties: 'All specialties',
    specialist: 'Specialist',
    viewProfile: 'View Profile',
    schedule: 'View Schedule'
  },
  nurses: {
    title: 'Nursing Staff',
    subtitle: 'Shift management and nursing assignments',
    new: 'New Nurse',
    searchPlaceholder: 'Search nurse...',
    allShifts: 'All shifts',
    filters: 'Filters',
    table: {
      nurse: 'Nurse',
      specialty: 'Specialty',
      shift: 'Shift',
      license: 'License'
    }
  },
  booking: {
    personalInfo: 'Personal Information',
    firstName: 'First Name',
    lastName: 'Last Name',
    docId: 'ID / Passport',
    gender: 'Gender',
    phone: 'Phone',
    birthDate: 'Birth Date',
    address: 'Address',
    appointmentInfo: 'Appointment Details',
    specialty: 'Specialty',
    doctor: 'Specialist',
    date: 'Appointment Date',
    reason: 'Reason for Visit',
    additionalNotes: 'Additional Notes (Optional)',
    submit: 'Book Medical Appointment',
    successTitle: 'Appointment Booked!',
    successMsg: 'Your appointment has been successfully registered. You will receive a confirmation email.',
    errorTitle: 'Error',
    errorMsg: 'Could not book the appointment. Please check the data.',
    placeholders: {
      firstName: 'e.g. John',
      lastName: 'e.g. Smith',
      docId: 'e.g. 12345678',
      phone: 'e.g. 04121234567',
      address: 'City, Neighborhood...',
      reason: 'e.g. General Consultation, Checkup...',
      notes: 'Any additional information you want to share...',
      specialty: 'Select a specialty',
      doctor: 'Select a specialist'
    }
  },
  lab: {
    title: 'Laboratory Results',
    subtitle: 'Clinical analytics and reports management',
    new: 'New Result',
    import: 'Import Results',
    searchPlaceholder: 'Search by patient or exam...',
    table: {
      date: 'Date',
      patient: 'Patient',
      test: 'Test / Exam',
      results: 'Results',
      status: 'Status',
      exam: 'Exam'
    },
    status: {
      pending: 'In Process',
      ready: 'Ready / Validated',
      delivered: 'Delivered'
    },
    examType: 'Test Type'
  },
  lab_catalog: {
    title: 'Test Catalog',
    subtitle: 'Setup trials, profiles and price list',
    newTest: 'New Test',
    newCombo: 'New Combo/Profile',
    tabs: {
      tests: 'Individual Tests',
      combos: 'Combos and Profiles'
    },
    testsTab: 'Individual Tests',
    combosTab: 'Combos and Profiles',
    rateInfo: 'Reference Rate',
    rateDetail: 'Amount in Bs. calculated according to official BCV rate:',
    showingInUsd: 'Prices in USD',
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
  },
  staff_list: {
    title: 'Staff Members',
    subtitle: 'Management of administrative roles, receptionists, and operational staff',
    new: 'New Staff Member',
    searchPlaceholder: 'Search by name, position or department...',
    allDepartments: 'All departments',
    table: {
      staff: 'Staff',
      employeeId: 'Employee ID',
      position: 'Position',
      department: 'Department'
    },
    noResults: 'No staff members found',
    departments: {
      administration: 'Administration',
      reception: 'Reception',
      accounting: 'Accounting',
      hr: 'Human Resources',
      generalServices: 'General Services',
      security: 'Security',
      maintenance: 'Maintenance',
      systems: 'IT / Systems'
    }
  },
  bulk_import: {
    title: 'Bulk Data Import',
    subtitle: 'Import records via CSV files',
    config: 'Import Configuration',
    step1: '1. Select Data Type',
    patients: 'Patients',
    doctors: 'Doctors',
    step2: '2. Download Template',
    templateDesc: 'Use our structured CSV template to avoid formatting errors.',
    downloadTemplate: 'Download Template (.csv)',
    step3: '3. Upload File',
    fileReady: 'File ready',
    startImport: 'Start Import',
    processing: 'Processing records...',
    status: 'Operation Status',
    emptyLabel: 'Import results will appear here',
    analyzing: 'Analyzing file...',
    analyzingDesc: 'This may take a few seconds depending on the file size.',
    summary: 'Summary of processed transactions.',
    importSummary: 'Import completed: {{success}} successful, {{errors}} failed.',
    success: 'Successful',
    failed: 'Failed',
    errorDetail: 'Error Detail',
    failedRecord: 'Failed Record',
    finished: 'Import Finished',
    selectFileError: 'Please select a CSV file',
    importError: 'Error importing data',
    template_filename: 'template'
  },
  landing: {
    title: 'The Most Advanced Medical',
    subtitle: 'Management Platform',
    description: 'Centralize your practice, manage digital medical records, and offer premium video consultations with state-of-the-art WebRTC technology.',
    pricing: 'Plans & Pricing',
    pricingDesc: 'From free to professional',
    security: 'ISO Security',
    securityDesc: 'Encrypted data and legal shield',
    reminders: 'Reminders',
    remindersDesc: 'Automatic WhatsApp alerts',
    loginTitle: 'Platform Access',
    loginDesc: 'Enter your credentials to continue',
    forgotPassword: 'Forgot your password?',
    enterSystem: 'Enter System',
    noAccount: 'Don\'t have an account yet?',
    registerHere: 'Register here',
    publicBooking: 'Book Appointment (Public)',
    businessName: 'Center / Clinic Name',
    businessNamePlaceholder: 'e.g. San Jose Medical Center'
  },
  patients_list: {
    title: 'Patient Management',
    subtitle: 'Complete list of registered patients and records',
    new: 'New Patient',
    searchPlaceholder: 'Search by name or document...',
    allGenders: 'All genders',
    table: {
      patient: 'Patient',
      document: 'ID Document',
      gender: 'Gender',
      phone: 'Phone'
    }
  },
  register: {
    title: 'Create account in Clinica SaaS',
    join: 'Join',
    heroDesc: 'Create your account and access the best clinical management platform.',
    easyAgenda: 'Easy Booking',
    easyAgendaDesc: 'Book your medical appointments in seconds.',
    digitalHistory: 'Digital Records',
    digitalHistoryDesc: 'Access your medical history.',
    whoAreYou: 'Who are you?',
    selectAccountType: 'Select account type',
    completeData: 'Complete your data',
    firstName: 'First Name',
    lastName: 'Last Name',
    autoPassword: 'Automatically generated password',
    autoPasswordDesc: 'When creating your account, the system will generate a secure temporary password that will be displayed on screen. You must change it upon your first login.',
    license: 'Medical License / Number',
    address: 'Address',
    bloodType: 'Blood Type',
    allergies: 'Allergies',
    acceptTerms: 'I accept the terms. Data under ISO 27001, ISO 9001, and GDPR compliance.'
  }
};

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private currentLang = signal<Language>('es');
  
  public locale = computed(() => this.currentLang() === 'es' ? 'es-ES' : 'en-US');
  
  private translations: Record<Language, any> = {
    es: ES_DICT,
    en: EN_DICT
  };

  constructor() {
    const savedLang = localStorage.getItem('lang') as Language;
    if (savedLang && (savedLang === 'es' || savedLang === 'en')) {
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

  translate(path: string): string {
    const keys = path.split('.');
    let translation = this.translations[this.currentLang()];
    
    for (const key of keys) {
      if (translation && translation[key]) {
        translation = translation[key];
      } else {
        return path;
      }
    }
    
    return translation;
  }
}
