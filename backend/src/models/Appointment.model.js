const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
    doctor: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    patient: {
        type: mongoose.Schema.ObjectId,
        ref: 'Patient',
        required: true
    },
    appointmentDate: {
        type: Date,
        required: [true, 'Please add an appointment date']
    },
    appointmentTime: {
        type: String,
        required: [true, 'Please add an appointment time']
    },
    reason: {
        type: String,
        default: 'General consultation'
    },
    status: {
        type: String,
        enum: ['Scheduled', 'Confirmed', 'Cancelled', 'Completed'],
        default: 'Scheduled'
    },
    type: {
        type: String,
        enum: ['Consultation', 'Follow-up', 'Emergency', 'Routine Checkup'],
        default: 'Consultation'
    },
    notes: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Appointment', AppointmentSchema);
