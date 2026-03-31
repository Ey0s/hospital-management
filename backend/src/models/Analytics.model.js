const mongoose = require('mongoose');

// Clinical Outcome Tracking
const ClinicalOutcomeSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.ObjectId,
        ref: 'Patient',
        required: true
    },
    admissionDate: {
        type: Date,
        required: true
    },
    dischargeDate: Date,
    lengthOfStay: Number, // in days
    outcome: {
        type: String,
        enum: ['Recovered', 'Improved', 'Stable', 'Deteriorated', 'Deceased', 'Transferred'],
        required: true
    },
    readmission: {
        isReadmitted: {
            type: Boolean,
            default: false
        },
        readmissionDate: Date,
        daysUntilReadmission: Number
    },
    complications: [{
        type: String,
        description: String,
        severity: {
            type: String,
            enum: ['Minor', 'Moderate', 'Severe', 'Critical']
        },
        date: Date
    }],
    department: {
        type: mongoose.Schema.ObjectId,
        ref: 'Department'
    },
    primaryDiagnosis: String,
    secondaryDiagnoses: [String],
    procedures: [String],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Infection Tracking (HAIs - Hospital Acquired Infections)
const InfectionTrackingSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.ObjectId,
        ref: 'Patient',
        required: true
    },
    infectionType: {
        type: String,
        enum: ['CLABSI', 'CAUTI', 'SSI', 'VAP', 'CDI', 'MRSA', 'Other'],
        required: true
    },
    infectionSite: String,
    detectionDate: {
        type: Date,
        required: true
    },
    admissionDate: Date,
    daysUntilInfection: Number,
    department: {
        type: mongoose.Schema.ObjectId,
        ref: 'Department'
    },
    severity: {
        type: String,
        enum: ['Mild', 'Moderate', 'Severe', 'Life-threatening']
    },
    treatment: String,
    resolved: {
        type: Boolean,
        default: false
    },
    resolutionDate: Date,
    preventionMeasures: [String],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Operational Metrics
const OperationalMetricsSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true
    },
    department: {
        type: mongoose.Schema.ObjectId,
        ref: 'Department'
    },
    bedOccupancy: {
        totalBeds: Number,
        occupiedBeds: Number,
        occupancyRate: Number // percentage
    },
    emergencyDepartment: {
        totalVisits: Number,
        averageWaitTime: Number, // in minutes
        leftWithoutBeingSeen: Number,
        admissionRate: Number // percentage
    },
    operatingRoom: {
        totalRooms: Number,
        scheduledProcedures: Number,
        completedProcedures: Number,
        cancelledProcedures: Number,
        utilizationRate: Number, // percentage
        averageTurnoverTime: Number // in minutes
    },
    staffing: {
        scheduledStaff: Number,
        actualStaff: Number,
        overtimeHours: Number,
        nurseToPatientRatio: Number
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Financial Metrics
const FinancialMetricsSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true
    },
    department: {
        type: mongoose.Schema.ObjectId,
        ref: 'Department'
    },
    revenue: {
        totalRevenue: Number,
        insuranceRevenue: Number,
        selfPayRevenue: Number,
        governmentRevenue: Number
    },
    expenses: {
        staffCosts: Number,
        supplyCosts: Number,
        equipmentCosts: Number,
        overheadCosts: Number,
        totalExpenses: Number
    },
    claims: {
        submitted: Number,
        approved: Number,
        denied: Number,
        pending: Number,
        denialRate: Number // percentage
    },
    costPerPatient: Number,
    profitMargin: Number, // percentage
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Risk Prediction
const RiskPredictionSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.ObjectId,
        ref: 'Patient',
        required: true
    },
    predictionDate: {
        type: Date,
        default: Date.now
    },
    riskType: {
        type: String,
        enum: ['Sepsis', 'ICU Transfer', 'Deterioration', 'Readmission', 'Mortality', 'Fall'],
        required: true
    },
    riskScore: {
        type: Number,
        min: 0,
        max: 100,
        required: true
    },
    riskLevel: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        required: true
    },
    factors: [{
        factor: String,
        weight: Number
    }],
    actualOutcome: {
        occurred: Boolean,
        outcomeDate: Date,
        notes: String
    },
    interventions: [String],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Patient Experience
const PatientExperienceSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.ObjectId,
        ref: 'Patient',
        required: true
    },
    visitDate: {
        type: Date,
        required: true
    },
    department: {
        type: mongoose.Schema.ObjectId,
        ref: 'Department'
    },
    satisfactionScore: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    ratings: {
        doctorCare: Number,
        nurseCare: Number,
        facilityClean: Number,
        waitTime: Number,
        communication: Number
    },
    feedback: String,
    complaints: [{
        category: String,
        description: String,
        resolved: Boolean,
        resolutionDate: Date
    }],
    wouldRecommend: Boolean,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Quality & Compliance Metrics
const QualityMetricsSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true
    },
    department: {
        type: mongoose.Schema.ObjectId,
        ref: 'Department'
    },
    medicationErrors: {
        total: Number,
        severity: {
            minor: Number,
            moderate: Number,
            severe: Number,
            critical: Number
        }
    },
    safetyIncidents: [{
        type: {
            type: String,
            enum: ['Fall', 'Pressure Ulcer', 'Wrong Site Surgery', 'Medication Error', 'Equipment Failure', 'Other']
        },
        severity: String,
        date: Date,
        resolved: Boolean
    }],
    complianceScores: {
        handHygiene: Number, // percentage
        documentationComplete: Number, // percentage
        protocolAdherence: Number // percentage
    },
    accreditationStatus: {
        standard: String,
        score: Number,
        lastAuditDate: Date,
        nextAuditDate: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = {
    ClinicalOutcome: mongoose.model('ClinicalOutcome', ClinicalOutcomeSchema),
    InfectionTracking: mongoose.model('InfectionTracking', InfectionTrackingSchema),
    OperationalMetrics: mongoose.model('OperationalMetrics', OperationalMetricsSchema),
    FinancialMetrics: mongoose.model('FinancialMetrics', FinancialMetricsSchema),
    RiskPrediction: mongoose.model('RiskPrediction', RiskPredictionSchema),
    PatientExperience: mongoose.model('PatientExperience', PatientExperienceSchema),
    QualityMetrics: mongoose.model('QualityMetrics', QualityMetricsSchema)
};
