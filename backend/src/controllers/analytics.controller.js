const {
    ClinicalOutcome,
    InfectionTracking,
    OperationalMetrics,
    FinancialMetrics,
    RiskPrediction,
    PatientExperience,
    QualityMetrics
} = require('../models/Analytics.model');
const Appointment = require('../models/Appointment.model');
const Patient = require('../models/Patient.model');
const MedicalRecord = require('../models/MedicalRecord.model');
const User = require('../models/User.model');
const Department = require('../models/Department.model');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get clinical analytics dashboard
// @route   GET /api/analytics/clinical
// @access  Private (Admin, Doctor)
exports.getClinicalAnalytics = async (req, res, next) => {
    try {
        const { startDate, endDate, department } = req.query;
        
        const filter = {};
        if (startDate && endDate) {
            filter.admissionDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }
        if (department) {
            filter.department = department;
        }

        // Patient outcomes
        const outcomes = await ClinicalOutcome.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$outcome',
                    count: { $sum: 1 },
                    avgLengthOfStay: { $avg: '$lengthOfStay' }
                }
            }
        ]);

        // Readmission rates
        const readmissions = await ClinicalOutcome.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    readmitted: {
                        $sum: { $cond: ['$readmission.isReadmitted', 1, 0] }
                    }
                }
            },
            {
                $project: {
                    readmissionRate: {
                        $multiply: [{ $divide: ['$readmitted', '$total'] }, 100]
                    }
                }
            }
        ]);

        // Complications analysis
        const complications = await ClinicalOutcome.aggregate([
            { $match: filter },
            { $unwind: '$complications' },
            {
                $group: {
                    _id: '$complications.severity',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Average length of stay by diagnosis
        const losByDiagnosis = await ClinicalOutcome.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$primaryDiagnosis',
                    avgLOS: { $avg: '$lengthOfStay' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        res.status(200).json({
            success: true,
            data: {
                outcomes,
                readmissionRate: readmissions[0] || { readmissionRate: 0 },
                complications,
                lengthOfStayByDiagnosis: losByDiagnosis
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get infection tracking analytics
// @route   GET /api/analytics/infections
// @access  Private (Admin, Doctor)
exports.getInfectionAnalytics = async (req, res, next) => {
    try {
        const { startDate, endDate, department } = req.query;
        
        const filter = {};
        if (startDate && endDate) {
            filter.detectionDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }
        if (department) {
            filter.department = department;
        }

        // Infection rates by type
        const infectionsByType = await InfectionTracking.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$infectionType',
                    count: { $sum: 1 },
                    avgDaysUntilInfection: { $avg: '$daysUntilInfection' }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Infection severity distribution
        const severityDistribution = await InfectionTracking.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$severity',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Resolution rate
        const resolutionStats = await InfectionTracking.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    resolved: { $sum: { $cond: ['$resolved', 1, 0] } }
                }
            },
            {
                $project: {
                    resolutionRate: {
                        $multiply: [{ $divide: ['$resolved', '$total'] }, 100]
                    }
                }
            }
        ]);

        // Infections by department
        const infectionsByDept = await InfectionTracking.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$department',
                    count: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'departments',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'departmentInfo'
                }
            },
            { $sort: { count: -1 } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                infectionsByType,
                severityDistribution,
                resolutionRate: resolutionStats[0] || { resolutionRate: 0 },
                infectionsByDepartment: infectionsByDept
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get operational analytics
// @route   GET /api/analytics/operational
// @access  Private (Admin)
exports.getOperationalAnalytics = async (req, res, next) => {
    try {
        const { startDate, endDate, department } = req.query;
        
        const filter = {};
        if (startDate && endDate) {
            filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }
        if (department) {
            filter.department = department;
        }

        // Average bed occupancy
        const bedOccupancy = await OperationalMetrics.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    avgOccupancyRate: { $avg: '$bedOccupancy.occupancyRate' },
                    avgOccupiedBeds: { $avg: '$bedOccupancy.occupiedBeds' }
                }
            }
        ]);

        // ED metrics
        const edMetrics = await OperationalMetrics.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    avgWaitTime: { $avg: '$emergencyDepartment.averageWaitTime' },
                    totalVisits: { $sum: '$emergencyDepartment.totalVisits' },
                    avgAdmissionRate: { $avg: '$emergencyDepartment.admissionRate' }
                }
            }
        ]);

        // OR utilization
        const orUtilization = await OperationalMetrics.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    avgUtilization: { $avg: '$operatingRoom.utilizationRate' },
                    totalProcedures: { $sum: '$operatingRoom.completedProcedures' },
                    avgTurnoverTime: { $avg: '$operatingRoom.averageTurnoverTime' }
                }
            }
        ]);

        // Staffing metrics
        const staffingMetrics = await OperationalMetrics.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    avgNurseToPatientRatio: { $avg: '$staffing.nurseToPatientRatio' },
                    totalOvertimeHours: { $sum: '$staffing.overtimeHours' }
                }
            }
        ]);

        // Trend data for charts
        const trendData = await OperationalMetrics.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                    occupancyRate: { $avg: '$bedOccupancy.occupancyRate' },
                    edWaitTime: { $avg: '$emergencyDepartment.averageWaitTime' },
                    orUtilization: { $avg: '$operatingRoom.utilizationRate' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                bedOccupancy: bedOccupancy[0] || {},
                emergencyDepartment: edMetrics[0] || {},
                operatingRoom: orUtilization[0] || {},
                staffing: staffingMetrics[0] || {},
                trends: trendData
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get financial analytics
// @route   GET /api/analytics/financial
// @access  Private (Admin, CFO)
exports.getFinancialAnalytics = async (req, res, next) => {
    try {
        const { startDate, endDate, department } = req.query;
        
        const filter = {};
        if (startDate && endDate) {
            filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }
        if (department) {
            filter.department = department;
        }

        // Revenue summary
        const revenueSummary = await FinancialMetrics.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$revenue.totalRevenue' },
                    insuranceRevenue: { $sum: '$revenue.insuranceRevenue' },
                    selfPayRevenue: { $sum: '$revenue.selfPayRevenue' },
                    governmentRevenue: { $sum: '$revenue.governmentRevenue' }
                }
            }
        ]);

        // Expense breakdown
        const expenseSummary = await FinancialMetrics.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalExpenses: { $sum: '$expenses.totalExpenses' },
                    staffCosts: { $sum: '$expenses.staffCosts' },
                    supplyCosts: { $sum: '$expenses.supplyCosts' },
                    equipmentCosts: { $sum: '$expenses.equipmentCosts' },
                    overheadCosts: { $sum: '$expenses.overheadCosts' }
                }
            }
        ]);

        // Claims analysis
        const claimsAnalysis = await FinancialMetrics.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalSubmitted: { $sum: '$claims.submitted' },
                    totalApproved: { $sum: '$claims.approved' },
                    totalDenied: { $sum: '$claims.denied' },
                    avgDenialRate: { $avg: '$claims.denialRate' }
                }
            }
        ]);

        // Department profitability
        const deptProfitability = await FinancialMetrics.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$department',
                    totalRevenue: { $sum: '$revenue.totalRevenue' },
                    totalExpenses: { $sum: '$expenses.totalExpenses' },
                    avgProfitMargin: { $avg: '$profitMargin' }
                }
            },
            {
                $lookup: {
                    from: 'departments',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'departmentInfo'
                }
            },
            { $sort: { avgProfitMargin: -1 } }
        ]);

        // Monthly trends
        const monthlyTrends = await FinancialMetrics.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
                    revenue: { $sum: '$revenue.totalRevenue' },
                    expenses: { $sum: '$expenses.totalExpenses' },
                    profit: {
                        $sum: {
                            $subtract: ['$revenue.totalRevenue', '$expenses.totalExpenses']
                        }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                revenue: revenueSummary[0] || {},
                expenses: expenseSummary[0] || {},
                claims: claimsAnalysis[0] || {},
                departmentProfitability: deptProfitability,
                monthlyTrends
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get risk predictions
// @route   GET /api/analytics/risk-predictions
// @access  Private (Admin, Doctor)
exports.getRiskPredictions = async (req, res, next) => {
    try {
        const { riskType, riskLevel, startDate, endDate } = req.query;
        
        const filter = {};
        if (riskType) filter.riskType = riskType;
        if (riskLevel) filter.riskLevel = riskLevel;
        if (startDate && endDate) {
            filter.predictionDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        // High-risk patients
        const highRiskPatients = await RiskPrediction.find({
            riskLevel: { $in: ['High', 'Critical'] },
            'actualOutcome.occurred': { $ne: true }
        })
            .populate('patient', 'user')
            .sort('-riskScore')
            .limit(20);

        // Risk distribution
        const riskDistribution = await RiskPrediction.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: { riskType: '$riskType', riskLevel: '$riskLevel' },
                    count: { $sum: 1 },
                    avgRiskScore: { $avg: '$riskScore' }
                }
            }
        ]);

        // Prediction accuracy
        const accuracyStats = await RiskPrediction.aggregate([
            {
                $match: {
                    'actualOutcome.occurred': { $exists: true }
                }
            },
            {
                $group: {
                    _id: '$riskType',
                    total: { $sum: 1 },
                    correct: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gte: ['$riskScore', 50] },
                                        { $eq: ['$actualOutcome.occurred', true] }
                                    ]
                                },
                                1,
                                {
                                    $cond: [
                                        {
                                            $and: [
                                                { $lt: ['$riskScore', 50] },
                                                { $eq: ['$actualOutcome.occurred', false] }
                                            ]
                                        },
                                        1,
                                        0
                                    ]
                                }
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    accuracy: {
                        $multiply: [{ $divide: ['$correct', '$total'] }, 100]
                    }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                highRiskPatients,
                riskDistribution,
                predictionAccuracy: accuracyStats
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get patient experience analytics
// @route   GET /api/analytics/patient-experience
// @access  Private (Admin)
exports.getPatientExperienceAnalytics = async (req, res, next) => {
    try {
        const { startDate, endDate, department } = req.query;
        
        const filter = {};
        if (startDate && endDate) {
            filter.visitDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }
        if (department) {
            filter.department = department;
        }

        // Overall satisfaction
        const satisfactionStats = await PatientExperience.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    avgSatisfaction: { $avg: '$satisfactionScore' },
                    avgDoctorCare: { $avg: '$ratings.doctorCare' },
                    avgNurseCare: { $avg: '$ratings.nurseCare' },
                    avgFacilityClean: { $avg: '$ratings.facilityClean' },
                    avgWaitTime: { $avg: '$ratings.waitTime' },
                    avgCommunication: { $avg: '$ratings.communication' },
                    totalResponses: { $sum: 1 },
                    wouldRecommend: {
                        $sum: { $cond: ['$wouldRecommend', 1, 0] }
                    }
                }
            },
            {
                $project: {
                    avgSatisfaction: 1,
                    avgDoctorCare: 1,
                    avgNurseCare: 1,
                    avgFacilityClean: 1,
                    avgWaitTime: 1,
                    avgCommunication: 1,
                    totalResponses: 1,
                    recommendationRate: {
                        $multiply: [{ $divide: ['$wouldRecommend', '$totalResponses'] }, 100]
                    }
                }
            }
        ]);

        // Satisfaction by department
        const deptSatisfaction = await PatientExperience.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$department',
                    avgSatisfaction: { $avg: '$satisfactionScore' },
                    count: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'departments',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'departmentInfo'
                }
            },
            { $sort: { avgSatisfaction: -1 } }
        ]);

        // Complaint analysis
        const complaintStats = await PatientExperience.aggregate([
            { $match: filter },
            { $unwind: '$complaints' },
            {
                $group: {
                    _id: '$complaints.category',
                    count: { $sum: 1 },
                    resolved: {
                        $sum: { $cond: ['$complaints.resolved', 1, 0] }
                    }
                }
            },
            {
                $project: {
                    count: 1,
                    resolved: 1,
                    resolutionRate: {
                        $multiply: [{ $divide: ['$resolved', '$count'] }, 100]
                    }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Satisfaction trends
        const satisfactionTrends = await PatientExperience.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m', date: '$visitDate' } },
                    avgSatisfaction: { $avg: '$satisfactionScore' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                overallSatisfaction: satisfactionStats[0] || {},
                departmentSatisfaction: deptSatisfaction,
                complaints: complaintStats,
                trends: satisfactionTrends
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get quality & compliance metrics
// @route   GET /api/analytics/quality
// @access  Private (Admin)
exports.getQualityMetrics = async (req, res, next) => {
    try {
        const { startDate, endDate, department } = req.query;
        
        const filter = {};
        if (startDate && endDate) {
            filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }
        if (department) {
            filter.department = department;
        }

        // Medication error analysis
        const medicationErrors = await QualityMetrics.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalErrors: { $sum: '$medicationErrors.total' },
                    minorErrors: { $sum: '$medicationErrors.severity.minor' },
                    moderateErrors: { $sum: '$medicationErrors.severity.moderate' },
                    severeErrors: { $sum: '$medicationErrors.severity.severe' },
                    criticalErrors: { $sum: '$medicationErrors.severity.critical' }
                }
            }
        ]);

        // Safety incidents
        const safetyIncidents = await QualityMetrics.aggregate([
            { $match: filter },
            { $unwind: '$safetyIncidents' },
            {
                $group: {
                    _id: '$safetyIncidents.type',
                    count: { $sum: 1 },
                    resolved: {
                        $sum: { $cond: ['$safetyIncidents.resolved', 1, 0] }
                    }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Compliance scores
        const complianceScores = await QualityMetrics.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    avgHandHygiene: { $avg: '$complianceScores.handHygiene' },
                    avgDocumentation: { $avg: '$complianceScores.documentationComplete' },
                    avgProtocolAdherence: { $avg: '$complianceScores.protocolAdherence' }
                }
            }
        ]);

        // Compliance trends
        const complianceTrends = await QualityMetrics.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
                    handHygiene: { $avg: '$complianceScores.handHygiene' },
                    documentation: { $avg: '$complianceScores.documentationComplete' },
                    protocolAdherence: { $avg: '$complianceScores.protocolAdherence' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                medicationErrors: medicationErrors[0] || {},
                safetyIncidents,
                complianceScores: complianceScores[0] || {},
                complianceTrends
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get comprehensive dashboard data
// @route   GET /api/analytics/dashboard
// @access  Private (Admin)
exports.getDashboardAnalytics = async (req, res, next) => {
    try {
        const { role } = req.user;
        const today = new Date();
        const thirtyDaysAgo = new Date(today.setDate(today.getDate() - 30));

        // Key metrics
        const totalPatients = await Patient.countDocuments();
        const totalAppointments = await Appointment.countDocuments({
            appointmentDate: { $gte: thirtyDaysAgo }
        });
        const activeStaff = await User.countDocuments({
            role: { $in: ['doctor', 'nurse', 'receptionist'] },
            isActive: true
        });

        // Recent outcomes
        const recentOutcomes = await ClinicalOutcome.find()
            .sort('-createdAt')
            .limit(10)
            .populate('patient department');

        // High-risk alerts
        const highRiskAlerts = await RiskPrediction.find({
            riskLevel: { $in: ['High', 'Critical'] },
            'actualOutcome.occurred': { $ne: true }
        })
            .sort('-riskScore')
            .limit(10)
            .populate('patient');

        // Recent infections
        const recentInfections = await InfectionTracking.find({
            detectionDate: { $gte: thirtyDaysAgo }
        }).countDocuments();

        // Satisfaction score
        const avgSatisfaction = await PatientExperience.aggregate([
            { $match: { visitDate: { $gte: thirtyDaysAgo } } },
            { $group: { _id: null, avg: { $avg: '$satisfactionScore' } } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                keyMetrics: {
                    totalPatients,
                    totalAppointments,
                    activeStaff,
                    recentInfections,
                    avgSatisfaction: avgSatisfaction[0]?.avg || 0
                },
                recentOutcomes,
                highRiskAlerts
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create clinical outcome record
// @route   POST /api/analytics/clinical-outcomes
// @access  Private (Doctor, Admin)
exports.createClinicalOutcome = async (req, res, next) => {
    try {
        const outcome = await ClinicalOutcome.create(req.body);
        
        res.status(201).json({
            success: true,
            data: outcome
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create infection tracking record
// @route   POST /api/analytics/infections
// @access  Private (Doctor, Admin)
exports.createInfectionRecord = async (req, res, next) => {
    try {
        const infection = await InfectionTracking.create(req.body);
        
        res.status(201).json({
            success: true,
            data: infection
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create risk prediction
// @route   POST /api/analytics/risk-predictions
// @access  Private (Doctor, Admin)
exports.createRiskPrediction = async (req, res, next) => {
    try {
        const prediction = await RiskPrediction.create(req.body);
        
        res.status(201).json({
            success: true,
            data: prediction
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create patient experience record
// @route   POST /api/analytics/patient-experience
// @access  Private
exports.createPatientExperience = async (req, res, next) => {
    try {
        const experience = await PatientExperience.create(req.body);
        
        res.status(201).json({
            success: true,
            data: experience
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Export analytics report
// @route   GET /api/analytics/export
// @access  Private (Admin)
exports.exportAnalyticsReport = async (req, res, next) => {
    try {
        const { reportType, format, startDate, endDate } = req.query;
        
        // This would generate CSV/PDF reports
        // Implementation depends on requirements
        
        res.status(200).json({
            success: true,
            message: 'Report generation initiated',
            data: {
                reportType,
                format,
                dateRange: { startDate, endDate }
            }
        });
    } catch (error) {
        next(error);
    }
};
