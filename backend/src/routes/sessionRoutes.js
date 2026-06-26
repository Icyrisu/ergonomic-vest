const express = require('express');
const sessionController = require('../controllers/sessionController');

const router = express.Router();

router.post('/start', sessionController.startSession);
router.post('/stop', sessionController.stopSession);
router.get('/', sessionController.getAllSessions);
router.get('/:name/data', sessionController.getSessionData);

module.exports = router;
