const Department = require('../models/Department.model');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get all departments
// @route   GET /api/departments
// @access  Public
exports.getDepartments = async (req, res, next) => {
    try {
        const departments = await Department.find().populate('headOfDepartment', 'firstName lastName email');
        res.status(200).json({
            success: true,
            count: departments.length,
            data: departments
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Create a department
// @route   POST /api/departments
// @access  Private/Admin
exports.createDepartment = async (req, res, next) => {
    try {
        const department = await Department.create(req.body);
        res.status(201).json({
            success: true,
            data: department
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update a department
// @route   PUT /api/departments/:id
// @access  Private/Admin
exports.updateDepartment = async (req, res, next) => {
    try {
        let department = await Department.findById(req.params.id);
        if (!department) {
            return next(new ErrorResponse('Department not found', 404));
        }
        department = await Department.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        res.status(200).json({
            success: true,
            data: department
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete a department
// @route   DELETE /api/departments/:id
// @access  Private/Admin
exports.deleteDepartment = async (req, res, next) => {
    try {
        const department = await Department.findById(req.params.id);
        if (!department) {
            return next(new ErrorResponse('Department not found', 404));
        }
        await department.deleteOne();
        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (err) {
        next(err);
    }
};
