const MedicalRecord = require('../models/MedicalRecord.model');
const Patient = require('../models/Patient.model');
const User = require('../models/User.model');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get all medical records
// @route   GET /api/medical-records
// @access  Private (Doctor, Admin)
exports.getMedicalRecords = async (req, res, next) => {
    try {
        let query = {};

        // Clinical staff (admins, doctors, nurses) have access. Handled by route authorization.

        // If patient ID provided, filter by patient
        if (req.query.patient) {
            query.patient = req.query.patient;
        }

        const records = await MedicalRecord.find(query)
            .populate({
                path: 'patient',
                populate: {
                    path: 'user',
                    select: 'firstName lastName email phoneNumber'
                }
            })
            .populate('doctor', 'firstName lastName email')
            .sort({ visitDate: -1 });

        res.status(200).json({
            success: true,
            count: records.length,
            data: records
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get single medical record
// @route   GET /api/medical-records/:id
// @access  Private
exports.getMedicalRecord = async (req, res, next) => {
    try {
        const record = await MedicalRecord.findById(req.params.id)
            .populate({
                path: 'patient',
                populate: {
                    path: 'user',
                    select: 'firstName lastName email phoneNumber'
                }
            })
            .populate('doctor', 'firstName lastName email');

        if (!record) {
            return next(new ErrorResponse(`Medical record not found with id of ${req.params.id}`, 404));
        }

        // Access Control: Admin, Doctor, Nurse have full access based on route middlewares.

        res.status(200).json({
            success: true,
            data: record
        });
    } catch (err) {
        next(err);
    }
};


// @desc    Create medical record
// @route   POST /api/medical-records
// @access  Private (Doctor)
exports.createMedicalRecord = async (req, res, next) => {
    try {
        const {
            patient,
            chiefComplaint,
            diagnosis,
            treatment,
            vitalSigns,
            prescriptions,
            labTests,
            followUpDate,
            notes
        } = req.body;

        // Verify patient exists
        const patientExists = await Patient.findById(patient);
        if (!patientExists) {
            return next(new ErrorResponse('Patient not found', 404));
        }

        // Set doctor to current user
        const record = await MedicalRecord.create({
            patient,
            doctor: req.user.id,
            chiefComplaint,
            diagnosis,
            treatment,
            vitalSigns: vitalSigns || {},
            prescriptions: prescriptions || [],
            labTests: labTests || [],
            followUpDate,
            notes
        });

        // Populate the created record
        await record.populate([
            {
                path: 'patient',
                populate: {
                    path: 'user',
                    select: 'firstName lastName email phoneNumber'
                }
            },
            {
                path: 'doctor',
                select: 'firstName lastName email'
            }
        ]);

        res.status(201).json({
            success: true,
            data: record
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update medical record
// @route   PUT /api/medical-records/:id
// @access  Private (Doctor who created it, Admin)
exports.updateMedicalRecord = async (req, res, next) => {
    try {
        let record = await MedicalRecord.findById(req.params.id);

        if (!record) {
            return next(new ErrorResponse(`Medical record not found with id of ${req.params.id}`, 404));
        }

        // Check if user is the author or admin
        if (record.doctor.toString() !== req.user.id && req.user.role !== 'admin') {
            return next(new ErrorResponse('Not authorized to update this record', 403));
        }

        record = await MedicalRecord.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        })
        .populate({
            path: 'patient',
            populate: {
                path: 'user',
                select: 'firstName lastName email phoneNumber'
            }
        })
        .populate('doctor', 'firstName lastName email');

        res.status(200).json({
            success: true,
            data: record
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete medical record
// @route   DELETE /api/medical-records/:id
// @access  Private (Admin only)
exports.deleteMedicalRecord = async (req, res, next) => {
    try {
        const record = await MedicalRecord.findById(req.params.id);

        if (!record) {
            return next(new ErrorResponse(`Medical record not found with id of ${req.params.id}`, 404));
        }

        await record.deleteOne();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get patient's medical history
// @route   GET /api/medical-records/patient/:patientId
// @access  Private
exports.getPatientHistory = async (req, res, next) => {
    try {
        let query = { patient: req.params.patientId };

        // Access Control: Handled by route middleware. All clinical staff see full history.

        const records = await MedicalRecord.find(query)
            .populate('doctor', 'firstName lastName email')
            .sort({ visitDate: -1 });

        res.status(200).json({
            success: true,
            count: records.length,
            data: records
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get all lab requests
// @route   GET /api/medical-records/lab-requests
// @access  Private (Laboratory, Admin, Doctor)
exports.getLabRequests = async (req, res, next) => {
    try {
        const records = await MedicalRecord.find({ 'labTests.0': { $exists: true } })
            .populate({
                path: 'patient',
                populate: {
                    path: 'user',
                    select: 'firstName lastName email phoneNumber'
                }
            })
            .populate('doctor', 'firstName lastName email');

        let allTests = [];
        records.forEach(record => {
            if (record.labTests && record.labTests.length > 0) {
                record.labTests.forEach(test => {
                    allTests.push({
                        ...test.toObject(),
                        patientName: `${record.patient?.user?.firstName} ${record.patient?.user?.lastName}`,
                        doctorName: `Dr. ${record.doctor?.firstName} ${record.doctor?.lastName}`,
                        recordId: record._id
                    });
                });
            }
        });

        allTests.sort((a, b) => new Date(b.orderedDate) - new Date(a.orderedDate));

        res.status(200).json({
            success: true,
            count: allTests.length,
            data: allTests
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update a specific lab test result
// @route   PUT /api/medical-records/:id/lab-result/:testId
// @access  Private (Laboratory, Admin)
exports.updateLabResult = async (req, res, next) => {
    try {
        const { id, testId } = req.params;
        const { status, result, notes, attachment } = req.body;

        const record = await MedicalRecord.findById(id);

        if (!record) {
            return next(new ErrorResponse('Medical record not found', 404));
        }

        const test = record.labTests.id(testId);
        
        if (!test) {
            return next(new ErrorResponse('Lab test not found', 404));
        }

        if (status) test.status = status;
        if (result !== undefined) test.result = result;
        if (notes !== undefined) test.notes = notes;
        if (attachment !== undefined) test.attachment = attachment;

        if (result || status === 'Completed') {
            test.resultDate = new Date();
        }

        await record.save();

        res.status(200).json({
            success: true,
            data: test
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get all prescriptions list
// @route   GET /api/medical-records/prescriptions
// @access  Private (Pharmacist, Admin, Doctor)
exports.getPrescriptions = async (req, res, next) => {
    try {
        const records = await MedicalRecord.find({ 'prescriptions.0': { $exists: true } })
            .populate({
                path: 'patient',
                populate: {
                    path: 'user',
                    select: 'firstName lastName email phoneNumber'
                }
            })
            .populate('doctor', 'firstName lastName email');

        let allPrescriptions = [];
        records.forEach(record => {
            if (record.prescriptions && record.prescriptions.length > 0) {
                record.prescriptions.forEach(px => {
                    allPrescriptions.push({
                        ...px.toObject(),
                        patientName: `${record.patient?.user?.firstName} ${record.patient?.user?.lastName}`,
                        patientId: record.patient?._id,
                        doctorName: `Dr. ${record.doctor?.firstName} ${record.doctor?.lastName}`,
                        recordId: record._id,
                        visitDate: record.visitDate
                    });
                });
            }
        });

        allPrescriptions.sort((a, b) => new Date(b.orderedDate) - new Date(a.orderedDate));

        res.status(200).json({
            success: true,
            count: allPrescriptions.length,
            data: allPrescriptions
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update a specific prescription status
// @route   PUT /api/medical-records/:id/prescription/:pxId
// @access  Private (Pharmacist, Admin)
exports.updatePrescription = async (req, res, next) => {
    try {
        const { id, pxId } = req.params;
        const { status, notes } = req.body;

        const record = await MedicalRecord.findById(id);

        if (!record) {
            return next(new ErrorResponse('Medical record not found', 404));
        }

        const px = record.prescriptions.id(pxId);
        
        if (!px) {
            return next(new ErrorResponse('Prescription not found', 404));
        }

        if (status) px.status = status;
        if (notes !== undefined) px.notes = notes;

        if (status === 'Dispensed' || status === 'Partially Dispensed') {
            px.dispenseDate = new Date();
        }

        await record.save();

        res.status(200).json({
            success: true,
            data: px
        });
    } catch (err) {
        next(err);
    }
};
