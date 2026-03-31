const Patient = require('../models/Patient.model');
const User = require('../models/User.model');
const Appointment = require('../models/Appointment.model');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get all patients
// @route   GET /api/patients
// @access  Private (Admin, Doctor, Receptionist)
exports.getPatients = async (req, res, next) => {
    try {
        let query = {};

        // Access Control: Doctors see only patients they have appointments with. Admins/Receptionists see all.
        if (req.user.role === 'doctor') {
            const appointments = await Appointment.find({ doctor: req.user.id }).select('patient');
            const patientIds = appointments.map(app => app.patient);
            query = { _id: { $in: patientIds } };
        }

        const patients = await Patient.find(query).populate('user', 'firstName lastName grandFatherName email phoneNumber');
        res.status(200).json({
            success: true,
            count: patients.length,
            data: patients
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get single patient
// @route   GET /api/patients/:id
// @access  Private
exports.getPatient = async (req, res, next) => {
    try {
        const patient = await Patient.findById(req.params.id).populate('user', 'firstName lastName grandFatherName email phoneNumber');

        if (!patient) {
            return next(new ErrorResponse(`Patient not found with id of ${req.params.id}`, 404));
        }

        // Access Control: Doctors must have an appointment with the patient to view their dossier. Admin bypasses.
        if (req.user.role === 'doctor') {
            const hasAppointment = await Appointment.findOne({ doctor: req.user.id, patient: req.params.id });
            if (!hasAppointment && req.user.role !== 'admin') {
                return next(new ErrorResponse('Not authorized to access this patient dossier', 403));
            }
        }

        res.status(200).json({
            success: true,
            data: patient
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Create patient (with user account)
// @route   POST /api/patients
// @access  Private (Receptionist, Admin)
exports.createPatient = async (req, res, next) => {
    try {
        const {
            firstName,
            lastName,
            grandFatherName,
            email,
            phoneNumber,
            password,
            dateOfBirth,
            gender,
            address,
            bloodGroup,
            allergies,
            emergencyContact,
            patientType,
            status,
            admittedDate,
            insurance
        } = req.body;

        // Check if user with email already exists (if email is provided)
        if (email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return next(new ErrorResponse('A user with this email already exists', 400));
            }
        }

        // Create user account for patient
        const user = await User.create({
            firstName,
            lastName,
            grandFatherName,
            email: email || undefined,
            phoneNumber,
            password: password || 'patient123', // Default password if not provided
            role: 'patient'
        });

        // Create patient record
        const patient = await Patient.create({
            user: user._id,
            dateOfBirth,
            gender,
            address,
            bloodGroup,
            allergies: allergies || [],
            emergencyContact: emergencyContact || {},
            patientType: patientType || 'Outpatient',
            status: status || 'Active',
            admittedDate: admittedDate || null,
            insurance: insurance || {}
        });

        // Populate user data
        await patient.populate('user', 'firstName lastName grandFatherName email phoneNumber');

        res.status(201).json({
            success: true,
            data: patient
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update patient
// @route   PUT /api/patients/:id
// @access  Private
exports.updatePatient = async (req, res, next) => {
    try {
        let patient = await Patient.findById(req.params.id);

        if (!patient) {
            return next(new ErrorResponse(`Patient not found with id of ${req.params.id}`, 404));
        }

        patient = await Patient.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        }).populate('user', 'firstName lastName email phoneNumber');

        res.status(200).json({
            success: true,
            data: patient
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete patient
// @route   DELETE /api/patients/:id
// @access  Private (Admin, Receptionist)
exports.deletePatient = async (req, res, next) => {
    try {
        const patient = await Patient.findById(req.params.id);

        if (!patient) {
            return next(new ErrorResponse(`Patient not found with id of ${req.params.id}`, 404));
        }

        // Delete associated user account
        await User.findByIdAndDelete(patient.user);
        
        // Delete patient record
        await patient.deleteOne();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (err) {
        next(err);
    }
};
