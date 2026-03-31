const mongoose = require('mongoose');

const EmploymentHistorySchema = new mongoose.Schema({
    staff: {
        type: mongoose.Schema.ObjectId,
        ref: 'Staff',
        required: true
    },
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    employeeId: {
        type: String,
        required: true
    },
    actionType: {
        type: String,
        enum: ['Hired', 'Promoted', 'Demoted', 'Transfer', 'Salary Change', 'Contract Renewal', 'Suspended', 'Terminated', 'Resigned', 'Retired', 'Contract Ended', 'Reinstated'],
        required: true
    },
    actionDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    effectiveDate: {
        type: Date,
        required: true
    },
    previousDetails: {
        position: String,
        department: {
            type: mongoose.Schema.ObjectId,
            ref: 'Department'
        },
        salary: Number,
        status: String,
        employmentType: String
    },
    newDetails: {
        position: String,
        department: {
            type: mongoose.Schema.ObjectId,
            ref: 'Department'
        },
        salary: Number,
        status: String,
        employmentType: String
    },
    reason: {
        type: String,
        required: true
    },
    reasonCategory: {
        type: String,
        enum: [
            'Performance',
            'Misconduct',
            'Redundancy',
            'Contract Expiry',
            'Voluntary Resignation',
            'Retirement',
            'Health Issues',
            'Relocation',
            'Better Opportunity',
            'Personal Reasons',
            'Promotion',
            'Restructuring',
            'Other'
        ]
    },
    terminationDetails: {
        terminationType: {
            type: String,
            enum: ['With Cause', 'Without Cause', 'Mutual Agreement', 'End of Contract', 'Voluntary']
        },
        noticePeriodServed: Boolean,
        noticePeriodDays: Number,
        severancePay: Number,
        finalSettlementAmount: Number,
        finalSettlementDate: Date,
        exitInterviewCompleted: Boolean,
        exitInterviewDate: Date,
        exitInterviewNotes: String,
        assetsReturned: Boolean,
        clearanceCompleted: Boolean
    },
    documents: [{
        documentType: String,
        documentName: String,
        filePath: String,
        uploadDate: {
            type: Date,
            default: Date.now
        }
    }],
    approvedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    },
    approvalDate: Date,
    notes: String,
    isEligibleForRehire: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient queries
EmploymentHistorySchema.index({ staff: 1, actionDate: -1 });
EmploymentHistorySchema.index({ user: 1, actionDate: -1 });
EmploymentHistorySchema.index({ actionType: 1 });

module.exports = mongoose.model('EmploymentHistory', EmploymentHistorySchema);
