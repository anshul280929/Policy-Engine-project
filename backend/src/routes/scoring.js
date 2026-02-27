const express = require('express');
const router = express.Router();
const { PolicyScoring } = require('../models/PolicyModels');

// GET /api/scoring/:policyId - Get scoring parameters
router.get('/:policyId', async (req, res) => {
  try {
    const scoring = await PolicyScoring.findOne({ policyId: req.params.policyId });
    res.json(scoring || {
      policyId: req.params.policyId,
      scoringJson: { categories: [] },
      totalWeight: 0
    });
  } catch (err) {
    console.error('Error fetching scoring:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/scoring/:policyId - Save scoring parameters
router.post('/:policyId', async (req, res) => {
  try {
    const { scoringJson } = req.body;

    // Calculate total weight
    let totalWeight = 0;
    if (scoringJson && scoringJson.categories) {
      for (const cat of scoringJson.categories) {
        if (cat.parameters) {
          for (const param of cat.parameters) {
            totalWeight += param.weight || 0;
          }
        }
      }
    }

    const scoring = await PolicyScoring.findOneAndUpdate(
      { policyId: req.params.policyId },
      { policyId: req.params.policyId, scoringJson, totalWeight, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json(scoring);
  } catch (err) {
    console.error('Error saving scoring:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/scoring/:policyId/validate - Validate scoring configuration
router.post('/:policyId/validate', async (req, res) => {
  try {
    const scoring = await PolicyScoring.findOne({ policyId: req.params.policyId });
    const errors = [];

    if (!scoring || !scoring.scoringJson || !scoring.scoringJson.categories) {
      errors.push('No scoring parameters defined');
      return res.json({ valid: false, errors });
    }

    const { categories } = scoring.scoringJson;
    let totalWeight = 0;
    let paramCount = 0;

    for (const cat of categories) {
      if (!cat.parameters || cat.parameters.length === 0) {
        errors.push(`Category "${cat.name}" has no parameters`);
      }
      for (const p of (cat.parameters || [])) {
        totalWeight += p.weight || 0;
        paramCount++;
      }
    }

    if (totalWeight !== 100) {
      errors.push(`Total weight is ${totalWeight}%, must be 100%`);
    }
    if (paramCount === 0) {
      errors.push('At least one parameter required');
    }

    res.json({
      valid: errors.length === 0,
      errors,
      totalWeight,
      parameterCount: paramCount
    });
  } catch (err) {
    console.error('Error validating scoring:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
