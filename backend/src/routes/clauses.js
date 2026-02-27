const express = require('express');
const router = express.Router();
const { PolicyClauses } = require('../models/PolicyModels');

// GET /api/clauses/:policyId
router.get('/:policyId', async (req, res) => {
  try {
    const clauses = await PolicyClauses.findOne({ policyId: req.params.policyId });
    res.json(clauses || { policyId: req.params.policyId, clauses: [] });
  } catch (err) {
    console.error('Error fetching clauses:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/clauses/:policyId - Save clauses
router.post('/:policyId', async (req, res) => {
  try {
    const { clauses } = req.body;
    const result = await PolicyClauses.findOneAndUpdate(
      { policyId: req.params.policyId },
      { policyId: req.params.policyId, clauses, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json(result);
  } catch (err) {
    console.error('Error saving clauses:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/clauses/:policyId/add - Add a single clause
router.post('/:policyId/add', async (req, res) => {
  try {
    const { triggerCondition, clauseTemplate, variables, documents } = req.body;
    
    let doc = await PolicyClauses.findOne({ policyId: req.params.policyId });
    if (!doc) {
      doc = new PolicyClauses({ policyId: req.params.policyId, clauses: [] });
    }

    doc.clauses.push({
      triggerCondition,
      clauseTemplate,
      variables: variables || [],
      status: 'Draft',
      documents: documents || []
    });

    doc.updatedAt = new Date();
    await doc.save();
    res.json(doc);
  } catch (err) {
    console.error('Error adding clause:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/clauses/:policyId/:clauseIndex - Update a specific clause
router.put('/:policyId/:clauseIndex', async (req, res) => {
  try {
    const doc = await PolicyClauses.findOne({ policyId: req.params.policyId });
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const index = parseInt(req.params.clauseIndex);
    if (index < 0 || index >= doc.clauses.length) {
      return res.status(400).json({ error: 'Invalid clause index' });
    }

    Object.assign(doc.clauses[index], req.body);
    doc.updatedAt = new Date();
    await doc.save();
    res.json(doc);
  } catch (err) {
    console.error('Error updating clause:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/clauses/:policyId/preview - Render clause preview (resolve variables)
router.post('/:policyId/preview', async (req, res) => {
  try {
    const doc = await PolicyClauses.findOne({ policyId: req.params.policyId });
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const variableValues = req.body.variables || {};
    const previews = doc.clauses.map(clause => {
      let rendered = clause.clauseTemplate || '';
      for (const [key, val] of Object.entries(variableValues)) {
        rendered = rendered.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
      }
      return {
        triggerCondition: clause.triggerCondition,
        renderedText: rendered,
        documents: clause.documents
      };
    });

    res.json({ previews });
  } catch (err) {
    console.error('Error generating preview:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
