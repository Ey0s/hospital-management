const User = require('../models/User.model');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = async (req, res, next) => {
    try {
        const users = await User.find();
        res.status(200).json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Create a user
// @route   POST /api/users
// @access  Private/Admin
exports.createUser = async (req, res, next) => {
    try {
        const { firstName, lastName, email, password, role, phoneNumber } = req.body;

        // Check if user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return next(new ErrorResponse('User already exists', 400));
        }

        const user = await User.create({
            firstName,
            lastName,
            email,
            password,
            role,
            phoneNumber
        });

        res.status(201).json({
            success: true,
            data: user
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update a user
// @route   PUT /api/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res, next) => {
    try {
        let user = await User.findById(req.params.id).select('+password');

        if (!user) {
            return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
        }

        // Update fields manually
        Object.keys(req.body).forEach(key => {
            user[key] = req.body[key];
        });

        await user.save();

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
        }

        await user.deleteOne();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (err) {
        next(err);
    }
};
