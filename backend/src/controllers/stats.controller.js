const User = require('../models/User.model');
const Patient = require('../models/Patient.model');
const Appointment = require('../models/Appointment.model');
const Department = require('../models/Department.model');

// @desc    Get rich system statistics for Admin Dashboard
// @route   GET /api/stats/admin
// @access  Private/Admin
exports.getAdminStats = async (req, res, next) => {
    try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        // --- Core Counts ---
        // Note: Patient model uses admittedDate (no timestamps) for date tracking
        const patientDateField = 'admittedDate';
        const [
            totalPatients,
            newPatientsThisMonth,
            newPatientsLastMonth,
            totalDoctors,
            totalStaff,
            totalActiveUsers,
            totalDepartments
        ] = await Promise.all([
            Patient.countDocuments(),
            Patient.countDocuments({ admittedDate: { $gte: startOfMonth } }),
            Patient.countDocuments({ admittedDate: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
            User.countDocuments({ role: 'doctor', isActive: true }),
            User.countDocuments({ role: { $in: ['nurse', 'receptionist', 'laboratory', 'doctor'] }, isActive: true }),
            User.countDocuments({ isActive: true }),
            Department.countDocuments()
        ]);

        // --- Appointment Stats ---
        const appointmentCounts = await Appointment.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const appointmentStats = {
            total: 0,
            scheduled: 0,
            confirmed: 0,
            completed: 0,
            cancelled: 0
        };
        appointmentCounts.forEach(({ _id, count }) => {
            appointmentStats.total += count;
            const key = _id.toLowerCase();
            if (appointmentStats.hasOwnProperty(key)) {
                appointmentStats[key] = count;
            }
        });

        // Today's appointments
        const todayAppointments = await Appointment.countDocuments({
            appointmentDate: {
                $gte: startOfToday,
                $lt: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)
            }
        });

        // --- Patient Growth (last 6 months via admittedDate) ---
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const patientGrowth = await Patient.aggregate([
            { $match: { admittedDate: { $gte: sixMonthsAgo, $lte: now } } },
            {
                $group: {
                    _id: {
                        year: { $year: '$admittedDate' },
                        month: { $month: '$admittedDate' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // --- Appointment Type Breakdown ---
        const appointmentTypeBreakdown = await Appointment.aggregate([
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 }
                }
            }
        ]);

        // --- Recent Appointments (with full population) ---
        const recentAppointments = await Appointment.find()
            .sort({ createdAt: -1 })
            .limit(8)
            .populate({
                path: 'patient',
                populate: { path: 'user', select: 'firstName lastName phoneNumber' }
            })
            .populate('doctor', 'firstName lastName')
            .select('appointmentDate appointmentTime status type reason');

        // --- Recent Patients ---
        const recentPatients = await Patient.find()
            .sort({ createdAt: -1 })
            .limit(6)
            .populate('user', 'firstName lastName email phoneNumber');

        // --- Staff by Role ---
        const staffByRole = await User.aggregate([
            { $match: { role: { $ne: 'patient' }, isActive: true } },
            { $group: { _id: '$role', count: { $sum: 1 } } }
        ]);

        // --- Departments with head info ---
        const departments = await Department.find()
            .populate('headOfDepartment', 'firstName lastName')
            .limit(8);

        // --- Calculate growth percentage ---
        const patientGrowthPct = newPatientsLastMonth > 0
            ? Math.round(((newPatientsThisMonth - newPatientsLastMonth) / newPatientsLastMonth) * 100)
            : newPatientsThisMonth > 0 ? 100 : 0;

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    totalPatients,
                    newPatientsThisMonth,
                    patientGrowthPct,
                    totalDoctors,
                    totalStaff,
                    totalActiveUsers,
                    totalDepartments,
                    todayAppointments
                },
                appointments: appointmentStats,
                patientGrowth,
                appointmentTypeBreakdown,
                recentAppointments,
                recentPatients,
                staffByRole,
                departments
            }
        });
    } catch (err) {
        next(err);
    }
};
