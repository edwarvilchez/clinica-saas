'use strict';

/**
 * ⚡ ClinicalAiController - HTTP Handlers for CDSS & AI Decision Support
 */

const clinicalAiService = require('../services/clinicalAi.service');

exports.generateBrief = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { doctorId } = req.body;
    const brief = await clinicalAiService.generatePreConsultationBrief({
      patientId,
      doctorId: doctorId || req.user.doctorId || null,
      organizationId: req.user.organizationId,
      actorUserId: req.user.id,
      ip: req.ip
    });
    res.status(201).json({
      message: 'Resumen clínico pre-consulta generado exitosamente',
      draft: brief
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.suggestCie11 = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { symptomsText, physicalExamText, doctorId } = req.body;
    const suggestions = await clinicalAiService.suggestDifferentialDiagnoses({
      patientId,
      doctorId: doctorId || req.user.doctorId || null,
      organizationId: req.user.organizationId,
      symptomsText,
      physicalExamText,
      actorUserId: req.user.id,
      ip: req.ip
    });
    res.status(201).json({
      message: 'Hipótesis diagnósticas diferenciales CIE-11 generadas',
      draft: suggestions
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.generateSoap = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { symptomsText, vitalSigns, observations, doctorId } = req.body;
    const soapDraft = await clinicalAiService.generateSoapNoteDraft({
      patientId,
      doctorId: doctorId || req.user.doctorId || null,
      organizationId: req.user.organizationId,
      symptomsText,
      vitalSigns,
      observations,
      actorUserId: req.user.id,
      ip: req.ip
    });
    res.status(201).json({
      message: 'Borrador de nota SOAP generado exitosamente',
      draft: soapDraft
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.checkPrescriptionSafety = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { proposedDrugs, doctorId } = req.body;
    const safetyCheck = await clinicalAiService.evaluatePrescriptionSafety({
      patientId,
      doctorId: doctorId || req.user.doctorId || null,
      organizationId: req.user.organizationId,
      proposedDrugs: Array.isArray(proposedDrugs) ? proposedDrugs : [proposedDrugs],
      actorUserId: req.user.id,
      ip: req.ip
    });
    res.status(201).json({
      message: 'Evaluación de seguridad farmacológica y alergias completada',
      draft: safetyCheck
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.reviewDraft = async (req, res) => {
  try {
    const { draftId } = req.params;
    const { action, doctorFeedback, modifiedContent, createMedicalRecord } = req.body;
    const result = await clinicalAiService.reviewAiDraft({
      draftId,
      doctorId: req.user.doctorId || null,
      organizationId: req.user.organizationId,
      action,
      doctorFeedback,
      modifiedContent,
      createMedicalRecord: Boolean(createMedicalRecord),
      actorUserId: req.user.id,
      ip: req.ip
    });
    res.json({
      message: `Borrador clínico de IA procesado exitosamente (${action})`,
      ...result
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.getDraftsForPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { status, page, limit } = req.query;
    const drafts = await clinicalAiService.getDraftsForPatient({
      patientId,
      organizationId: req.user.organizationId,
      status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });
    res.json(drafts);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.getDraftById = async (req, res) => {
  try {
    const { draftId } = req.params;
    const draft = await clinicalAiService.getDraftById({
      draftId,
      organizationId: req.user.organizationId
    });
    res.json(draft);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};
