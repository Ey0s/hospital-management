const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a department name'],
        unique: true
    },
    description: {
        type: String,
        required: [true, 'Please add a description']
    },
    headOfDepartment: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    },
    location: {
        type: String,
        required: [true, 'Please add a location (building/floor)']
    },
    contactNumber: {
        type: String
    }
});

module.exports = mongoose.model('Department', DepartmentSchema);
