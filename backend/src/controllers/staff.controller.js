const Staff = require('../models/Staff.model');
const EmploymentHistory = require('../models/EmploymentHistory.model');
const Leave = require('../models/Leave.model');
const User = require('../models/User.model');
const Department = require('../models/Department.model');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Hire new staff
// @route   POST /api/staff/hire
// @access  Private (Admin)
exports.hireStaff = async (req, res, next) => {
    try {
        const {
            userId,
            employeeId,
            department,
            position,
            specialization,
            qualification,
            employmentType,
            contractDetails,
            salary,
            workSchedule,
            emergencyContact
        } = req.body;

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return next(new ErrorResponse('User not found', 404));
        }

        // Check if employee ID already exists
        const existingStaff = await Staff.findOne({ employeeId });
        if (existingStaff) {
            return next(new ErrorResponse('Employee ID already exists', 400));
        }

        // Create staff record
        const staff = await Staff.create({
            user: userId,
            employeeId,
            department,
            position,
            specialization,
            qualification,
            employmentType,
            contractDetails,
            salary,
            workSchedule,
            emergencyContact,
            status: 'Active',
            isActive: true
        });

        // Create employment history record
        await EmploymentHistory.create({
            staff: staff._id,
            user: userId,
            employeeId,
            actionType: 'Hired',
            actionDate: new Date(),
            effectiveDate: contractDetails.startDate,
            newDetails: {
                position,
                department,
                salary: salary.basicSalary,
                status: 'Active',
                employmentType
            },
            reason: 'New hire',
            reasonCategory: 'Other',
            approvedBy: req.user.id,
            approvalDate: new Date(),
            isEligibleForRehire: true
        });

        // Update user role if needed (but never downgrade an admin)
        if (user.role !== 'admin') {
            if (position === 'Doctor' && user.role !== 'doctor') {
                user.role = 'doctor';
                await user.save();
            } else if (position === 'Nurse' && user.role !== 'nurse') {
                user.role = 'nurse';
                await user.save();
            } else if (position === 'Receptionist' && user.role !== 'receptionist') {
                user.role = 'receptionist';
                await user.save();
            } else if (position === 'Laboratory Technician' && user.role !== 'laboratory') {
                user.role = 'laboratory';
                await user.save();
            } else if (position === 'Pharmacist' && user.role !== 'pharmacist') {
                user.role = 'pharmacist';
                await user.save();
            }
        }

        const populatedStaff = await Staff.findById(staff._id)
            .populate('user', 'firstName lastName email phoneNumber')
            .populate('department', 'name');

        res.status(201).json({
            success: true,
            message: 'Staff hired successfully',
            data: populatedStaff
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all staff
// @route   GET /api/staff
// @access  Private (Admin)
exports.getAllStaff = async (req, res, next) => {
    try {
        const { status, department, position, employmentType, search } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (department) filter.department = department;
        if (position) filter.position = position;
        if (employmentType) filter.employmentType = employmentType;

        let query = Staff.find(filter)
            .populate('user', 'firstName lastName email phoneNumber avatar')
            .populate('department', 'name location')
            .sort('-createdAt');

        // Search by name or employee ID
        if (search) {
            const users = await User.find({
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');

            const userIds = users.map(u => u._id);
            filter.$or = [
                { user: { $in: userIds } },
                { employeeId: { $regex: search, $options: 'i' } }
            ];

            query = Staff.find(filter)
                .populate('user', 'firstName lastName email phoneNumber avatar')
                .populate('department', 'name location')
                .sort('-createdAt');
        }

        const staff = await query;

        res.status(200).json({
            success: true,
            count: staff.length,
            data: staff
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single staff
// @route   GET /api/staff/:id
// @access  Private
exports.getStaff = async (req, res, next) => {
    try {
        const staff = await Staff.findById(req.params.id)
            .populate('user', 'firstName lastName email phoneNumber avatar')
            .populate('department', 'name location contactNumber');

        if (!staff) {
            return next(new ErrorResponse('Staff not found', 404));
        }

        // Get employment history
        const history = await EmploymentHistory.find({ staff: staff._id })
            .populate('approvedBy', 'firstName lastName')
            .populate('previousDetails.department', 'name')
            .populate('newDetails.department', 'name')
            .sort('-actionDate');

        // Get leave records
        const leaves = await Leave.find({ staff: staff._id })
            .populate('approvedBy', 'firstName lastName')
            .sort('-createdAt')
            .limit(10);

        res.status(200).json({
            success: true,
            data: {
                staff,
                history,
                leaves
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update staff
// @route   PUT /api/staff/:id
// @access  Private (Admin)
exports.updateStaff = async (req, res, next) => {
    try {
        let staff = await Staff.findById(req.params.id);

        if (!staff) {
            return next(new ErrorResponse('Staff not found', 404));
        }

        const previousDetails = {
            position: staff.position,
            department: staff.department,
            salary: staff.salary.basicSalary,
            status: staff.status,
            employmentType: staff.employmentType
        };

        // Prepare update data
        const updateData = { ...req.body };
        
        // Sync isActive with status
        if (req.body.status) {
            if (req.body.status === 'Active') {
                updateData.isActive = true;
            } else if (['Terminated', 'Resigned', 'Retired', 'Contract Ended'].includes(req.body.status)) {
                updateData.isActive = false;
            }
        }

        // Update staff
        staff = await Staff.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true
        }).populate('user', 'firstName lastName email')
          .populate('department', 'name');

        // Create history record if significant changes
        const significantChanges = ['position', 'department', 'salary', 'status', 'employmentType'];
        const hasSignificantChange = significantChanges.some(field => {
            if (field === 'salary') {
                return req.body.salary && req.body.salary.basicSalary !== previousDetails.salary;
            }
            return req.body[field] && req.body[field] !== previousDetails[field];
        });

        if (hasSignificantChange) {
            let actionType = 'Salary Change';
            if (req.body.position && req.body.position !== previousDetails.position) {
                actionType = 'Promoted';
            } else if (req.body.department && req.body.department.toString() !== previousDetails.department.toString()) {
                actionType = 'Transfer';
            }

            await EmploymentHistory.create({
                staff: staff._id,
                user: staff.user,
                employeeId: staff.employeeId,
                actionType,
                actionDate: new Date(),
                effectiveDate: new Date(),
                previousDetails,
                newDetails: {
                    position: staff.position,
                    department: staff.department,
                    salary: staff.salary.basicSalary,
                    status: staff.status,
                    employmentType: staff.employmentType
                },
                reason: req.body.updateReason || 'Staff update',
                approvedBy: req.user.id,
                approvalDate: new Date()
            });
        }

        res.status(200).json({
            success: true,
            message: 'Staff updated successfully',
            data: staff
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Terminate staff
// @route   POST /api/staff/:id/terminate
// @access  Private (Admin)
exports.terminateStaff = async (req, res, next) => {
    try {
        const {
            reason,
            reasonCategory,
            terminationType,
            effectiveDate,
            noticePeriodServed,
            noticePeriodDays,
            severancePay,
            finalSettlementAmount,
            exitInterviewNotes,
            isEligibleForRehire
        } = req.body;

        const staff = await Staff.findById(req.params.id);

        if (!staff) {
            return next(new ErrorResponse('Staff not found', 404));
        }

        if (staff.status === 'Terminated') {
            return next(new ErrorResponse('Staff already terminated', 400));
        }

        const previousDetails = {
            position: staff.position,
            department: staff.department,
            salary: staff.salary.basicSalary,
            status: staff.status,
            employmentType: staff.employmentType
        };

        // Update staff status
        staff.status = 'Terminated';
        staff.isActive = false;
        staff.contractDetails.endDate = effectiveDate || new Date();
        await staff.save();

        // Create employment history record
        await EmploymentHistory.create({
            staff: staff._id,
            user: staff.user,
            employeeId: staff.employeeId,
            actionType: 'Terminated',
            actionDate: new Date(),
            effectiveDate: effectiveDate || new Date(),
            previousDetails,
            newDetails: {
                position: staff.position,
                department: staff.department,
                salary: staff.salary.basicSalary,
                status: 'Terminated',
                employmentType: staff.employmentType
            },
            reason,
            reasonCategory,
            terminationDetails: {
                terminationType,
                noticePeriodServed,
                noticePeriodDays,
                severancePay,
                finalSettlementAmount,
                finalSettlementDate: new Date(),
                exitInterviewCompleted: !!exitInterviewNotes,
                exitInterviewDate: exitInterviewNotes ? new Date() : null,
                exitInterviewNotes,
                assetsReturned: false,
                clearanceCompleted: false
            },
            approvedBy: req.user.id,
            approvalDate: new Date(),
            isEligibleForRehire: isEligibleForRehire !== undefined ? isEligibleForRehire : true
        });

        const populatedStaff = await Staff.findById(staff._id)
            .populate('user', 'firstName lastName email')
            .populate('department', 'name');

        res.status(200).json({
            success: true,
            message: 'Staff terminated successfully',
            data: populatedStaff
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Staff resignation
// @route   POST /api/staff/:id/resign
// @access  Private (Admin)
exports.resignStaff = async (req, res, next) => {
    try {
        const {
            reason,
            reasonCategory,
            effectiveDate,
            noticePeriodServed,
            noticePeriodDays,
            exitInterviewNotes
        } = req.body;

        const staff = await Staff.findById(req.params.id);

        if (!staff) {
            return next(new ErrorResponse('Staff not found', 404));
        }

        const previousDetails = {
            position: staff.position,
            department: staff.department,
            salary: staff.salary.basicSalary,
            status: staff.status,
            employmentType: staff.employmentType
        };

        // Update staff status
        staff.status = 'Resigned';
        staff.isActive = false;
        staff.contractDetails.endDate = effectiveDate || new Date();
        await staff.save();

        // Create employment history record
        await EmploymentHistory.create({
            staff: staff._id,
            user: staff.user,
            employeeId: staff.employeeId,
            actionType: 'Resigned',
            actionDate: new Date(),
            effectiveDate: effectiveDate || new Date(),
            previousDetails,
            newDetails: {
                position: staff.position,
                department: staff.department,
                salary: staff.salary.basicSalary,
                status: 'Resigned',
                employmentType: staff.employmentType
            },
            reason,
            reasonCategory: reasonCategory || 'Voluntary Resignation',
            terminationDetails: {
                terminationType: 'Voluntary',
                noticePeriodServed,
                noticePeriodDays,
                exitInterviewCompleted: !!exitInterviewNotes,
                exitInterviewDate: exitInterviewNotes ? new Date() : null,
                exitInterviewNotes
            },
            approvedBy: req.user.id,
            approvalDate: new Date(),
            isEligibleForRehire: true
        });

        const populatedStaff = await Staff.findById(staff._id)
            .populate('user', 'firstName lastName email')
            .populate('department', 'name');

        res.status(200).json({
            success: true,
            message: 'Staff resignation processed successfully',
            data: populatedStaff
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Contract end
// @route   POST /api/staff/:id/contract-end
// @access  Private (Admin)
exports.endContract = async (req, res, next) => {
    try {
        const { reason, isEligibleForRehire, finalSettlementAmount } = req.body;

        const staff = await Staff.findById(req.params.id);

        if (!staff) {
            return next(new ErrorResponse('Staff not found', 404));
        }

        const previousDetails = {
            position: staff.position,
            department: staff.department,
            salary: staff.salary.basicSalary,
            status: staff.status,
            employmentType: staff.employmentType
        };

        // Update staff status
        staff.status = 'Contract Ended';
        staff.isActive = false;
        await staff.save();

        // Create employment history record
        await EmploymentHistory.create({
            staff: staff._id,
            user: staff.user,
            employeeId: staff.employeeId,
            actionType: 'Contract Ended',
            actionDate: new Date(),
            effectiveDate: staff.contractDetails.endDate || new Date(),
            previousDetails,
            newDetails: {
                position: staff.position,
                department: staff.department,
                salary: staff.salary.basicSalary,
                status: 'Contract Ended',
                employmentType: staff.employmentType
            },
            reason: reason || 'Contract period completed',
            reasonCategory: 'Contract Expiry',
            terminationDetails: {
                terminationType: 'End of Contract',
                finalSettlementAmount,
                finalSettlementDate: new Date()
            },
            approvedBy: req.user.id,
            approvalDate: new Date(),
            isEligibleForRehire: isEligibleForRehire !== undefined ? isEligibleForRehire : true
        });

        const populatedStaff = await Staff.findById(staff._id)
            .populate('user', 'firstName lastName email')
            .populate('department', 'name');

        res.status(200).json({
            success: true,
            message: 'Contract ended successfully',
            data: populatedStaff
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Renew contract
// @route   POST /api/staff/:id/renew-contract
// @access  Private (Admin)
exports.renewContract = async (req, res, next) => {
    try {
        const { startDate, endDate, duration, salary, reason } = req.body;

        const staff = await Staff.findById(req.params.id);

        if (!staff) {
            return next(new ErrorResponse('Staff not found', 404));
        }

        const previousDetails = {
            position: staff.position,
            department: staff.department,
            salary: staff.salary.basicSalary,
            status: staff.status,
            employmentType: staff.employmentType
        };

        // Update contract details
        staff.contractDetails.startDate = startDate || new Date();
        staff.contractDetails.endDate = endDate;
        staff.contractDetails.duration = duration;
        staff.contractDetails.renewalDate = new Date();
        
        if (salary) {
            staff.salary.basicSalary = salary;
        }

        staff.status = 'Active';
        staff.isActive = true;
        await staff.save();

        // Create employment history record
        await EmploymentHistory.create({
            staff: staff._id,
            user: staff.user,
            employeeId: staff.employeeId,
            actionType: 'Contract Renewal',
            actionDate: new Date(),
            effectiveDate: startDate || new Date(),
            previousDetails,
            newDetails: {
                position: staff.position,
                department: staff.department,
                salary: staff.salary.basicSalary,
                status: 'Active',
                employmentType: staff.employmentType
            },
            reason: reason || 'Contract renewal',
            approvedBy: req.user.id,
            approvalDate: new Date()
        });

        const populatedStaff = await Staff.findById(staff._id)
            .populate('user', 'firstName lastName email')
            .populate('department', 'name');

        res.status(200).json({
            success: true,
            message: 'Contract renewed successfully',
            data: populatedStaff
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get employment history
// @route   GET /api/staff/:id/history
// @access  Private
exports.getEmploymentHistory = async (req, res, next) => {
    try {
        const history = await EmploymentHistory.find({ staff: req.params.id })
            .populate('approvedBy', 'firstName lastName')
            .populate('previousDetails.department', 'name')
            .populate('newDetails.department', 'name')
            .sort('-actionDate');

        res.status(200).json({
            success: true,
            count: history.length,
            data: history
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Apply for leave
// @route   POST /api/staff/:id/leave
// @access  Private
exports.applyLeave = async (req, res, next) => {
    try {
        const { leaveType, startDate, endDate, numberOfDays, reason, documents } = req.body;

        const staff = await Staff.findById(req.params.id);

        if (!staff) {
            return next(new ErrorResponse('Staff not found', 404));
        }

        const leave = await Leave.create({
            staff: req.params.id,
            leaveType,
            startDate,
            endDate,
            numberOfDays,
            reason,
            documents,
            status: 'Pending'
        });

        res.status(201).json({
            success: true,
            message: 'Leave application submitted successfully',
            data: leave
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Approve/Reject leave
// @route   PUT /api/staff/leave/:leaveId
// @access  Private (Admin)
exports.updateLeaveStatus = async (req, res, next) => {
    try {
        const { status, rejectionReason } = req.body;

        let leave = await Leave.findById(req.params.leaveId);

        if (!leave) {
            return next(new ErrorResponse('Leave application not found', 404));
        }

        leave.status = status;
        leave.approvedBy = req.user.id;
        leave.approvalDate = new Date();

        if (status === 'Rejected' && rejectionReason) {
            leave.rejectionReason = rejectionReason;
        }

        // Update staff attendance if approved
        if (status === 'Approved') {
            const staff = await Staff.findById(leave.staff);
            
            if (leave.leaveType === 'Sick Leave') {
                staff.attendance.sickLeaveDays += leave.numberOfDays;
            } else if (leave.leaveType === 'Casual Leave') {
                staff.attendance.casualLeaveDays += leave.numberOfDays;
            } else if (leave.leaveType === 'Unpaid Leave') {
                staff.attendance.unpaidLeaveDays += leave.numberOfDays;
            }
            
            staff.attendance.totalLeaveDays += leave.numberOfDays;
            await staff.save();
        }

        await leave.save();

        leave = await Leave.findById(leave._id)
            .populate('staff')
            .populate('approvedBy', 'firstName lastName');

        res.status(200).json({
            success: true,
            message: `Leave ${status.toLowerCase()} successfully`,
            data: leave
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get staff leaves
// @route   GET /api/staff/:id/leaves
// @access  Private
exports.getStaffLeaves = async (req, res, next) => {
    try {
        const { status } = req.query;

        const filter = { staff: req.params.id };
        if (status) filter.status = status;

        const leaves = await Leave.find(filter)
            .populate('approvedBy', 'firstName lastName')
            .sort('-createdAt');

        res.status(200).json({
            success: true,
            count: leaves.length,
            data: leaves
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get staff statistics
// @route   GET /api/staff/stats
// @access  Private (Admin)
exports.getStaffStats = async (req, res, next) => {
    try {
        // Total staff by status
        const staffByStatus = await Staff.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Staff by position
        const staffByPosition = await Staff.aggregate([
            {
                $group: {
                    _id: '$position',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Staff by department
        const staffByDepartment = await Staff.aggregate([
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
            }
        ]);

        // Recent hires (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentHires = await Staff.countDocuments({
            createdAt: { $gte: thirtyDaysAgo }
        });

        // Recent terminations (last 30 days)
        const recentTerminations = await EmploymentHistory.countDocuments({
            actionType: { $in: ['Terminated', 'Resigned', 'Contract Ended'] },
            actionDate: { $gte: thirtyDaysAgo }
        });

        // Contracts expiring soon (next 60 days)
        const sixtyDaysFromNow = new Date();
        sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

        const expiringContracts = await Staff.countDocuments({
            'contractDetails.endDate': {
                $gte: new Date(),
                $lte: sixtyDaysFromNow
            },
            status: 'Active'
        });

        // Pending leaves
        const pendingLeaves = await Leave.countDocuments({ status: 'Pending' });

        res.status(200).json({
            success: true,
            data: {
                staffByStatus,
                staffByPosition,
                staffByDepartment,
                recentHires,
                recentTerminations,
                expiringContracts,
                pendingLeaves,
                totalActiveStaff: await Staff.countDocuments({ status: 'Active' })
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get expiring contracts
// @route   GET /api/staff/expiring-contracts
// @access  Private (Admin)
exports.getExpiringContracts = async (req, res, next) => {
    try {
        const { days = 60 } = req.query;

        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + parseInt(days));

        const expiringStaff = await Staff.find({
            'contractDetails.endDate': {
                $gte: new Date(),
                $lte: futureDate
            },
            status: 'Active'
        })
            .populate('user', 'firstName lastName email phoneNumber')
            .populate('department', 'name')
            .sort('contractDetails.endDate');

        res.status(200).json({
            success: true,
            count: expiringStaff.length,
            data: expiringStaff
        });
    } catch (error) {
        next(error);
    }
};
