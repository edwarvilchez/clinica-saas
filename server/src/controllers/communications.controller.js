'use strict';

/**
 * ⚡ CommunicationsController - HTTP Handlers for Omnichannel Messaging
 */

const communicationsService = require('../services/communications/communications.service');

exports.sendMessage = async (req, res) => {
  try {
    const { to, message, channel, messageType, providerName, metadata } = req.body;
    const result = await communicationsService.sendMessage({
      to,
      message,
      channel: channel || 'WHATSAPP',
      messageType: messageType || 'CUSTOM',
      organizationId: req.user.organizationId,
      providerName,
      metadata,
      actorUserId: req.user.id,
      ip: req.ip
    });

    res.status(result.success ? 200 : 502).json({
      message: result.success ? 'Mensaje procesado para entrega exitosamente' : 'Error en la entrega del mensaje',
      result
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.getLogs = async (req, res) => {
  try {
    const { status, channel, recipient, page, limit } = req.query;
    const logs = await communicationsService.getCommunicationLogs({
      organizationId: req.user.organizationId,
      status,
      channel,
      recipient,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });
    res.json(logs);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const stats = await communicationsService.getCommunicationStats({
      organizationId: req.user.organizationId
    });
    res.json(stats);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.handleWebhook = async (req, res) => {
  try {
    const { provider } = req.params;
    const outcome = await communicationsService.handleProviderWebhook(
      provider,
      req.body,
      req.headers
    );

    res.json({
      received: true,
      outcome
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};
