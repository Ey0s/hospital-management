const Appointment = require('../models/Appointment.model');
const Patient = require('../models/Patient.model');
const User = require('../models/User.model');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get all appointments
// @route   GET /api/appointments
// @access  Private
exports.getAppointments = async (req, res, next) => {
    try {
        let query = {};

        // Access Control: Doctors see only their own schedules. Admins/Receptionists see global schedule.
        if (req.user.role === 'doctor') {
            query.doctor = req.user.id;
        }

        const appointments = await Appointment.find(query)
            .populate({
                path: 'patient',
                populate: {
                    path: 'user',
                    select: 'firstName lastName email phoneNumber'
                }
            })
            .populate('doctor', 'firstName lastName email phoneNumber')
            .sort({ appointmentDate: 1 });

        res.status(200).json({
            success: true,
            count: appointments.length,
            data: appointments
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get single appointment
// @route   GET /api/appointments/:id
// @access  Private
exports.getAppointment = async (req, res, next) => {
    try {
        const appointment = await Appointment.findById(req.params.id)
            .populate({
                path: 'patient',
                populate: {
                    path: 'user',
                    select: 'firstName lastName email phoneNumber'
                }
            })
            .populate('doctor', 'firstName lastName email phoneNumber');

        if (!appointment) {
            return next(new ErrorResponse(`Appointment not found with id of ${req.params.id}`, 404));
        }

        res.status(200).json({
            success: true,
            data: appointment
        });
    } catch (err) {
        next(err);
    }
};


// @desc    Create appointment
// @route   POST /api/appointments
// @access  Private (Receptionist, Admin, Doctor)
exports.createAppointment = async (req, res, next) => {
    try {
        const {
            patient,
            doctor,
            appointmentDate,
            appointmentTime,
            reason,
            type,
            status
        } = req.body;

        // Verify patient exists
        const patientExists = await Patient.findById(patient);
        if (!patientExists) {
            return next(new ErrorResponse('Patient not found', 404));
        }

        // Verify doctor exists
        const doctorExists = await User.findOne({ _id: doctor, role: 'doctor' });
        if (!doctorExists) {
            return next(new ErrorResponse('Doctor not found', 404));
        }

        // Combine date and time
        const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);

        // Create appointment
        const appointment = await Appointment.create({
            patient,
            doctor,
            appointmentDate: appointmentDateTime,
            appointmentTime,
            reason: reason || 'General consultation',
            type: type || 'Consultation',
            status: status || 'Scheduled'
        });

        // Populate the created appointment
        await appointment.populate([
            {
                path: 'patient',
                populate: {
                    path: 'user',
                    select: 'firstName lastName email phoneNumber'
                }
            },
            {
                path: 'doctor',
                select: 'firstName lastName email phoneNumber'
            }
        ]);

        res.status(201).json({
            success: true,
            data: appointment
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update appointment
// @route   PUT /api/appointments/:id
// @access  Private
exports.updateAppointment = async (req, res, next) => {
    try {
        let appointment = await Appointment.findById(req.params.id);

        if (!appointment) {
            return next(new ErrorResponse(`Appointment not found with id of ${req.params.id}`, 404));
        }

        appointment = await Appointment.findByIdAndUpdate(req.params.id, req.body, {
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
        .populate('doctor', 'firstName lastName email phoneNumber');

        res.status(200).json({
            success: true,
            data: appointment
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete appointment
// @route   DELETE /api/appointments/:id
// @access  Private (Admin, Receptionist)
exports.deleteAppointment = async (req, res, next) => {
    try {
        const appointment = await Appointment.findById(req.params.id);

        if (!appointment) {
            return next(new ErrorResponse(`Appointment not found with id of ${req.params.id}`, 404));
        }

        await appointment.deleteOne();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (err) {
        next(err);
    }
};
