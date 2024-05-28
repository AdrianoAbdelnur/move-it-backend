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
        console.log(email, password)
        const userFound = await User.findOne({ email, isDeleted: false });
        console.log(userFound)
        if (!userFound) return res.status(400).json({ message: 'Incorrect user credentials.' });
        const loginSucceed = await bcryptjs.compare(password, userFound?.password);
        console.log(loginSucceed)
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
        const userFound = await User.findById(req.userId).select('-password');
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
        console.log(usersCount)
        const pagesCount = Math.ceil(usersCount / limit);
        console.log(pagesCount)
        const skip = (page - 1) * limit;
        if (page > pagesCount) return res.status(400).json({ message: 'pagina no encontrada' });
        if (!paginated) {
            const usersFound = await User.find({ isDeleted: false }).select('-password -deleted -profilePicture');
            console.log(usersFound)
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

const updateOwnUser = async (req, res) => {
    try {
        const updatedUser = await User.findByIdAndUpdate(req.userId, req.body, { new: true });
        res.status(200).json({ message: "User's data successfully edited.", user: updatedUser });
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

module.exports = {
    registerUser,
    loginUser,
    getUser,
    getAllUsers,
    deleteUser,
    updateUser,
    loginStatus,
    updateOwnUser,
}