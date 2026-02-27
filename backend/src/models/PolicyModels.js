const mongoose = require('mongoose');

// ==========================================
// Policy Rules (Step 2 - Eligibility)
// ==========================================
const PolicyRulesSchema = new mongoose.Schema({
  policyId: { type: String, required: true, index: true },
  ruleJson: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      type: 'group',
      operator: 'AND',
      conditions: []
    }
  },
  generatedSql: { type: String, default: '' },
  estimatedApprovalRate: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// ==========================================
// Policy Scoring (Step 3 - Risk Parameters)
// ==========================================
const PolicyScoringSchema = new mongoose.Schema({
  policyId: { type: String, required: true, index: true },
  scoringJson: {
    type: mongoose.Schema.Types.Mixed,
    default: { categories: [] }
  },
  totalWeight: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// ==========================================
// Policy Decision Tree (Step 4 - Rule Engine)
// ==========================================
const PolicyDecisionTreeSchema = new mongoose.Schema({
  policyId: { type: String, required: true, index: true },
  decisionTreeJson: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isValidated: { type: Boolean, default: false },
  lastTestedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// ==========================================
// Policy Clauses (Step 5 - Documentation)
// ==========================================
const PolicyClausesSchema = new mongoose.Schema({
  policyId: { type: String, required: true, index: true },
  clauses: [{
    triggerCondition: String,
    clauseTemplate: String,
    variables: [String],
    status: { type: String, default: 'Draft' },
    documents: [{
      documentName: String,
      isRequired: { type: Boolean, default: true },
      description: String,
      validity: String
    }]
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// ==========================================
// Simulation Results
// ==========================================
const SimulationResultSchema = new mongoose.Schema({
  policyId: { type: String, required: true, index: true },
  simulationInput: mongoose.Schema.Types.Mixed,
  result: {
    decision: String,
    score: Number,
    triggeredRule: String,
    reason: String,
    trace: [String]
  },
  createdAt: { type: Date, default: Date.now }
});

const PolicyRules = mongoose.model('PolicyRules', PolicyRulesSchema);
const PolicyScoring = mongoose.model('PolicyScoring', PolicyScoringSchema);
const PolicyDecisionTree = mongoose.model('PolicyDecisionTree', PolicyDecisionTreeSchema);
const PolicyClauses = mongoose.model('PolicyClauses', PolicyClausesSchema);
const SimulationResult = mongoose.model('SimulationResult', SimulationResultSchema);

module.exports = {
  PolicyRules,
  PolicyScoring,
  PolicyDecisionTree,
  PolicyClauses,
  SimulationResult
};
