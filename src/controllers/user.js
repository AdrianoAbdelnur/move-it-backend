const User = require('../models/User');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const emailer = require('../helpers/emailer');
require('dotenv').config();

const registerUser = async (req, res) => {
    try {
        const salt = await bcryptjs.genSalt(10);
        const encryptedPassword = await bcryptjs.hash(req.body.password, salt)
        const userToRegister = {
            ...req.body,
            password: encryptedPassword,
        }
        const newUser = new User(userToRegister);
        await newUser.save();
        /* emailer.sendMail(newUser); */
        res.status(200).json({ message: 'User successfully created.' })
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
};

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const userFound = await User.findOne({ email, isDeleted: false });
        if (!userFound) return res.status(400).json({ message: 'Incorrect user credentials.' });
        const loginSucceed = await bcryptjs.compare(password, userFound?.password);
        if (!loginSucceed) return res.status(400).json({ message: 'Incorrect user credentials.' });
        const payload = {
            user: {
                id: userFound._id,
                role: userFound.role,
            },
        };
        jwt.sign(payload, process.env.SECRET_WORD, { expiresIn: '8h' }, (error, token) => {
            if (error) {
                throw error;
            }
            res.status(200).json({ message: 'User successfully logged in.', token });
        })
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
};

const getUser = async (req, res) => {
    try {
        const userFound = await User.findById(req.userId).select('-password -transportInfo.generalImg -transportInfo.policeCheckPdf -transportInfo.cargoAreaImg -transportInfo.licenseFrontImg -transportInfo.licenseBackImg --transportInfo.profilePhotoImg -transportInfo.profilePhotoImg' );
        if (!userFound) return res.status(400).json({ message: 'usuario no encontrado' });
        res.status(200).json({ message: 'datos de usuario localizados con exito', userFound });
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
};

const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 2, paginated = true } = req.query;
        const usersCount = await User.countDocuments();
        const pagesCount = Math.ceil(usersCount / limit);
        const skip = (page - 1) * limit;
        if (page > pagesCount) return res.status(400).json({ message: 'pagina no encontrada' });
        if (!paginated) {
            const usersFound = await User.find({ isDeleted: false }).select('-password -deleted -profilePicture');
            if (usersFound.length === 0) return res.status(400).json({ message: 'lista de usuarios vacia' });
            return res.status(200).json({ message: 'usuarios extraidos de forma exitosa', users: usersFound })
        }

        const usersFound = await User.find({ isDeleted: false }).skip(skip).limit(limit).select('-password  -deleted -profileImg').populate('role');
        if (usersFound.length === 0) return res.status(400).json({ message: 'lista de usuarios vacia' });
        return res.status(200).json({
            message: 'usuarios extraidos de forma exitosa',
            usersCount,
            pagesCount,
            currentPage: page,
            users: usersFound
        });
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const userToDelete = await User.findByIdAndUpdate(id, { isDeleted: true }, { new: true }).select('-password -_id -role -createdAt -profilePicture');
        if (!userToDelete) return res.status(400).json({ message: 'usuario no encontrado' });
        res.status(200).json({ message: 'User successfully deleted.', userToDelete });
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
};

const updateFields = async (req, res) => {
    try {
        const updateFields = {};
        for (const [field, value] of Object.entries(req.body)) {
            updateFields[`transportInfo.${field}`] = value;
        }
        const updatedUser = await User.findByIdAndUpdate(req.userId, { $set: updateFields }, { new: true }).select('-password' );
        let allFilled = true;
        for (const [key, value] of Object.entries(updatedUser.transportInfo)) {
            if(!value && key !== 'profilePhotoImg') {
                allFilled = false
                break
            }
        }
        if (allFilled) {
            updatedUser.infoCompletedFlag = true;
            await updatedUser.save();
        }
        let transportInfoStatus = {};
        for (const [key, value] of Object.entries(updatedUser.transportInfo)) {
            transportInfoStatus[key] = value? true : false;
        }
        transportInfoStatus={
            infoCompletedFlag: updatedUser.infoCompletedFlag,
            transportInfo:{
                ...transportInfoStatus, 
                vehicle: updatedUser.transportInfo.vehicle, 
                registrationPlate:updatedUser.transportInfo.registrationPlate 
            }
        }
        res.status(200).json({ message: "User's data uploaded successfully.", transportInfoStatus });
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message });
    }
};

const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedUser = await User.findByIdAndUpdate(id, req.body, { new: true });
        res.status(200).json({ message: "User's data successfully edited.", user: updatedUser });
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message });
    }
};

const loginStatus = (req, res) => {
    try {
        return res.status(200).json({ message: 'user is still logged', isLogged: true, role: req.userRole.name })
    } catch (error) {
        return res.status(error.code || 500).json({ message: error.message });
    }
}

const verifyTransportFields = async(req,res) => {
    try {
        const userFound = await User.findById(req.userId).select('-password');
        if (!userFound) return res.status(400).json({ message: 'User Not Found' });
        let transportInfoStatus = {};
        for (const [key, value] of Object.entries(userFound.transportInfo)) {
            transportInfoStatus[key] = value? true : false;
        }
        transportInfoStatus= {...transportInfoStatus, vehicle: userFound.transportInfo.vehicle, registrationPlate:userFound.transportInfo.registrationPlate }
        res.status(200).json({ message: 'Data successfully obtained', transportInfoStatus });
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
}

module.exports = {
    registerUser,
    loginUser,
    getUser,
    getAllUsers,
    deleteUser,
    updateUser,
    loginStatus,
    updateFields,
    verifyTransportFields
}