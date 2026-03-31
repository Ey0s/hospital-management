const mongoose = require('mongoose');

const DoctorSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    specialization: {
        type: String,
        required: [true, 'Please add a specialization']
    },
    department: {
        type: String, // You might want to reference a Department model later
        required: [true, 'Please add a department']
    },
    experience: {
        type: Number,
        required: [true, 'Please add years of experience']
    },
    qualification: {
        type: String,
        required: [true, 'Please add qualifications']
    },
    biography: {
        type: String
    },
    schedule: [
        {
            day: {
                type: String,
                enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            },
            startTime: String,
            endTime: String
        }
    ],
    available: {
        type: Boolean,
        default: true
    },
    consultationFee: {
        type: Number,
        required: [true, 'Please add a consultation fee']
    }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

module.exports = mongoose.model('Doctor', DoctorSchema);
