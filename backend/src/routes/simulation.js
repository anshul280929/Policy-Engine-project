const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { PolicyRules, PolicyScoring, PolicyDecisionTree, PolicyClauses, SimulationResult } = require('../models/PolicyModels');

// POST /api/simulation/:policyId/simulate-full - Full simulation
router.post('/:policyId/simulate-full', async (req, res) => {
  try {
    const { policyId } = req.params;
    const applicantData = req.body;

    // 1. Run Eligibility Engine
    const rules = await PolicyRules.findOne({ policyId });
    let eligibilityResult = { passed: true, trace: [] };
    if (rules && rules.ruleJson) {
      eligibilityResult = evaluateEligibility(rules.ruleJson, applicantData);
    }

    if (!eligibilityResult.passed) {
      const result = {
        decision: 'REJECT',
        score: 0,
        triggeredRule: 'Eligibility Filter',
        reason: 'Failed eligibility criteria',
        trace: eligibilityResult.trace
      };
      await saveSimulationResult(policyId, applicantData, result);
      return res.json(result);
    }

    // 2. Run Scoring Engine
    const scoring = await PolicyScoring.findOne({ policyId });
    let score = 0;
    const scoreTrace = [];
    if (scoring && scoring.scoringJson && scoring.scoringJson.categories) {
      const scoreResult = calculateScore(scoring.scoringJson, applicantData);
      score = scoreResult.score;
      scoreTrace.push(...scoreResult.trace);
    }

    // 3. Evaluate Decision Tree
    const tree = await PolicyDecisionTree.findOne({ policyId });
    let decision = 'NO_DECISION';
    let tier = null;
    let treeTrace = [];

    if (tree && tree.decisionTreeJson && tree.decisionTreeJson.type) {
      const treeResult = evaluateDecisionTree(tree.decisionTreeJson, { ...applicantData, _score: score });
      decision = treeResult.decision;
      tier = treeResult.tier;
      treeTrace = treeResult.trace;
    } else {
      // Default decision bands
      if (score >= 75) { decision = 'APPROVE'; tier = 'TIER_1'; }
      else if (score >= 60) { decision = 'REVIEW'; tier = 'TIER_2'; }
      else { decision = 'REJECT'; }
    }

    const finalTrace = [...eligibilityResult.trace, ...scoreTrace, ...treeTrace];
    const triggeredRule = treeTrace.find(t => t.includes('✗')) || treeTrace[treeTrace.length - 1] || '';

    const result = {
      decision,
      score,
      tier,
      triggeredRule: triggeredRule || `Score: ${score}`,
      reason: `Score ${score} resulted in ${decision}`,
      trace: finalTrace
    };

    await saveSimulationResult(policyId, applicantData, result);
    res.json(result);
  } catch (err) {
    console.error('Error running simulation:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/simulation/:policyId/validate - Validate policy completeness
router.post('/:policyId/validate', async (req, res) => {
  try {
    const { policyId } = req.params;
    const pool = req.app.locals.pool;
    const errors = [];

    // Check policy exists
    const policyResult = await pool.query('SELECT * FROM policies WHERE id = $1', [policyId]);
    if (policyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    const policy = policyResult.rows[0];

    // Check eligibility rules
    const rules = await PolicyRules.findOne({ policyId });
    if (!rules || !rules.ruleJson || !rules.ruleJson.conditions || rules.ruleJson.conditions.length === 0) {
      errors.push('No eligibility rules defined');
    }

    // Check scoring
    const scoring = await PolicyScoring.findOne({ policyId });
    if (!scoring || !scoring.scoringJson || !scoring.scoringJson.categories || scoring.scoringJson.categories.length === 0) {
      errors.push('No scoring parameters defined');
    } else if (scoring.totalWeight !== 100) {
      errors.push(`Scoring weight is ${scoring.totalWeight}%, must be 100%`);
    }

    // Check decision tree
    const tree = await PolicyDecisionTree.findOne({ policyId });
    if (!tree || !tree.decisionTreeJson || !tree.decisionTreeJson.type) {
      errors.push('No decision tree configured');
    }

    // Check clauses
    const clauses = await PolicyClauses.findOne({ policyId });
    if (!clauses || !clauses.clauses || clauses.clauses.length === 0) {
      errors.push('No clauses defined');
    }

    // Check dates
    if (policy.effective_date && new Date(policy.effective_date) < new Date()) {
      errors.push('Effective date is in the past');
    }
    if (policy.expiry_date && policy.effective_date && new Date(policy.expiry_date) <= new Date(policy.effective_date)) {
      errors.push('Expiry date must be after effective date');
    }

    res.json({
      valid: errors.length === 0,
      errors,
      completedSteps: {
        attributes: !!policy.policy_name,
        eligibility: !!(rules && rules.ruleJson && rules.ruleJson.conditions && rules.ruleJson.conditions.length > 0),
        scoring: !!(scoring && scoring.totalWeight === 100),
        decisionTree: !!(tree && tree.decisionTreeJson && tree.decisionTreeJson.type),
        clauses: !!(clauses && clauses.clauses && clauses.clauses.length > 0)
      }
    });
  } catch (err) {
    console.error('Error validating policy:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/simulation/:policyId/history - Get simulation history
router.get('/:policyId/history', async (req, res) => {
  try {
    const results = await SimulationResult.find({ policyId: req.params.policyId })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(results);
  } catch (err) {
    console.error('Error fetching simulation history:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions
function evaluateEligibility(ruleNode, data) {
  const trace = [];

  function evaluate(node) {
    if (node.type === 'group') {
      if (!node.conditions || node.conditions.length === 0) return true;
      const results = node.conditions.map(c => evaluate(c));
      return node.operator === 'AND' ? results.every(Boolean) : results.some(Boolean);
    }
    const { field, operator, value } = node;
    const actual = data[field];
    let met = false;

    switch (operator) {
      case '>': met = actual > value; break;
      case '>=': met = actual >= value; break;
      case '<': met = actual < value; break;
      case '<=': met = actual <= value; break;
      case '=': case '==': met = actual == value; break;
      case 'IN': met = Array.isArray(value) && value.includes(actual); break;
      case 'NOT IN': met = Array.isArray(value) && !value.includes(actual); break;
      default: met = false;
    }

    trace.push(`${field} ${operator} ${JSON.stringify(value)} ${met ? '✓' : '✗'}`);
    return met;
  }

  const passed = evaluate(ruleNode);
  return { passed, trace };
}

function calculateScore(scoringJson, data) {
  let score = 0;
  const trace = [];

  for (const cat of scoringJson.categories) {
    for (const param of (cat.parameters || [])) {
      const actual = data[param.field];
      let conditionMet = false;

      switch (param.operator) {
        case '>': conditionMet = actual > param.threshold; break;
        case '>=': conditionMet = actual >= param.threshold; break;
        case '<': conditionMet = actual < param.threshold; break;
        case '<=': conditionMet = actual <= param.threshold; break;
        case '=': conditionMet = actual == param.threshold; break;
        default: conditionMet = false;
      }

      if (conditionMet) score += param.weight || 0;
      trace.push(`${param.field} ${param.operator} ${param.threshold} (weight: ${param.weight}%) ${conditionMet ? '✓' : '✗'}`);
    }
  }

  return { score, trace };
}

function evaluateDecisionTree(node, data) {
  const trace = [];

  function evaluate(n) {
    if (!n || !n.type) {
      if (n && n.action) return { action: n.action, tier: n.tier };
      return { action: 'NO_DECISION' };
    }
    if (n.type === 'condition') {
      let conditionMet = false;
      if (n.if.operator && n.if.conditions) {
        const results = n.if.conditions.map(c => evalCond(c, data));
        conditionMet = n.if.operator === 'AND' ? results.every(r => r.met) : results.some(r => r.met);
        results.forEach(r => trace.push(r.trace));
      } else {
        const result = evalCond(n.if, data);
        conditionMet = result.met;
        trace.push(result.trace);
      }
      const branch = conditionMet ? n.then : n.else;
      if (!branch) return { action: 'NO_DECISION' };
      if (branch.type === 'condition') return evaluate(branch);
      return { action: branch.action, tier: branch.tier };
    }
    return { action: 'NO_DECISION' };
  }

  function evalCond(c, data) {
    const actual = data[c.field];
    let met = false;
    switch (c.operator) {
      case '>': met = actual > c.value; break;
      case '>=': met = actual >= c.value; break;
      case '<': met = actual < c.value; break;
      case '<=': met = actual <= c.value; break;
      case '=': case '==': met = actual == c.value; break;
      default: met = false;
    }
    return { met, trace: `${c.field} ${c.operator} ${JSON.stringify(c.value)} ${met ? '✓' : '✗'}` };
  }

  const result = evaluate(node);
  return { decision: result.action, tier: result.tier, trace };
}

async function saveSimulationResult(policyId, input, result) {
  try {
    await new SimulationResult({ policyId, simulationInput: input, result }).save();
  } catch (e) { /* non-blocking */ }
}

module.exports = router;
