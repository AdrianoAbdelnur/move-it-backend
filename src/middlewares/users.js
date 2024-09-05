const User = require('../models/User');
const { body } = require('express-validator');

const verifyRegisterFields = () => {
    return [
        body('email').isEmail().normalizeEmail().trim().escape().custom( email => {
            return  User.findOne({ email }).then(user => {
                if (user) return Promise.reject('The email address is already in use. If this email belongs to you, please log in instead');
            })
        }),
        body('password').isLength({ min: 6, max: 16 }),
        body('given_name').not().isEmpty().trim().escape().isLength({ min: 3, max: 24 }),
        body('family_name').not().isEmpty().trim().escape().isLength({ min: 3, max: 24 }),
    ];
};

const verifyLoginFields = () => {
    return [
        body('email').isEmail().normalizeEmail().trim().escape(),
    ];
}

const checkCancellations = async(req, res,next)=> {
    try {
        const {userId} = req.params
        const {serviceId, cancelledDate, refunded} = req.body; 
        console.log(userId, serviceId, cancelledDate,)  
        const user = await User.findById(userId);
        if(!user) {
            return res.status(404).json({message: "user not found"})
        }
        user.cancelledServices = [
            ...user.cancelledServices,
            {
                service: serviceId,
                cancelledDate: cancelledDate,
                refunded: refunded
            }
        ];
        console.log(user)
        if(user.role === "transport") {
            const currentDate = new Date()
            const threeMonthAgo = new Date()
            threeMonthAgo.setMonth(currentDate.getMonth() - 3);

            const relevantSuspensions = user.accountSuspended
                .filter(suspension => 
                    suspension.reason === 'More than 3 cancellations in 3 months' &&
                    (!suspension.suspensionEndDate || new Date(suspension.suspensionEndDate) > currentDate)
                );
            
            const lastActiveSuspension = relevantSuspensions.length > 0
                ? relevantSuspensions[0]
                : null;
            
            const lastSuspensionStartDate = lastActiveSuspension ? new Date(lastActiveSuspension.suspendedDate) : new Date(0);
            
            const recentCancellations = user.cancelledServices.filter(service => {
                const serviceCancelledDate = new Date(service.cancelledDate);
                return serviceCancelledDate >= threeMonthAgo &&
                       serviceCancelledDate <= currentDate &&
                       serviceCancelledDate >= lastSuspensionStartDate;
            });
            console.log("RECENT CANCEL",recentCancellations)
            if (recentCancellations.length >= 3) {
                const threeSuspensions = user.accountSuspended.filter(suspension => 
                    suspension.reason === 'More than 3 cancellations in 3 months'
                );

                let suspensionDuration;
                if (threeSuspensions.length === 0) {
                    suspensionDuration = 30;
                } else if (threeSuspensions.length === 1) {
                    suspensionDuration = 90;
                } else {
                    suspensionDuration = null;
                }

                const suspensionEndDate = suspensionDuration
    ? new Date(currentDate.setDate(currentDate.getDate() + suspensionDuration))
    : null;
console.log("llega?")
                user.accountSuspended=[
                    {
                        suspendedDate: new Date(),
                        reason: 'More than 3 cancellations in 3 months',
                        suspensionEndDate: suspensionEndDate
                    },
                    ...user.accountSuspended
                ]
                await user.save();
                return res.status(400).json({ message: "User has more than 3 cancellations in the last 3 months. Transport authorization revoked." });
            }
        }

        await user.save();
        next()
    
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
}

module.exports = {
    verifyRegisterFields,
    verifyLoginFields,
    checkCancellations
}