const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const transporter = require('../email')
const User = require('../models/User')
const jwt = require('jsonwebtoken')

/**
 * Signup route
 * @name POST /signup
 * @function
 * @memberof module:routes/auth
 * @inner
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response object with message or error
 */
router.post('/signup', async (req, res) => {
  const { email } = req.body

  try {
    // Generate a random OTP
    const otp = Math.floor(100000 + Math.random() * 900000)

    // Check if the user already exists
    const existingUser = await User.findOne({ email })

    if (existingUser) {
      // User already exists, send the OTP for login
      // Send login OTP email
      const hashedOTP = await bcrypt.hash(otp.toString(), 10)
      existingUser.isOTPUsed = false
      existingUser.otp = hashedOTP
      existingUser.save()
      const mailOptions = {
        from: 'merntask@gmail.com',
        to: email,
        subject: 'Login OTP',
        text: `Your login OTP is: ${otp}`
      }

      await transporter.sendMail(mailOptions)

      res.status(200).json({ message: 'Login OTP sent' })
    } else {
      // User does not exist, create a new account with the OTP
      // Hash the OTP
      const hashedOTP = await bcrypt.hash(otp.toString(), 10)

      // Save the user to the database with the hashed OTP
      const newUser = new User({
        email,
        otp: hashedOTP,
        username: email,
        fullName: email.split('@')[0],
        role: 'admin'
      })
      await newUser.save()

      // Send welcome email with OTP
      const mailOptions = {
        from: 'merntask@gmail.com',
        to: email,
        subject: 'Welcome to our App',
        text: `Welcome, ${email}! Thank you for signing up. Your OTP is: ${otp}`
      }

      await transporter.sendMail(mailOptions)
      console.log('Welcome email sent')

      res.status(201).json({ message: 'User signed up successfully' })
    }
  } catch (error) {
    res.status(500).json(error.message)
  }
})

/**
 * Login route
 * @name POST /login
 * @function
 * @memberof module:routes/auth
 * @inner
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response object with message, token, and user data or error
 */
router.post('/login', async (req, res) => {
  const { email, otp } = req.body

  try {
    // Find the user in the database
    const user = await User.findOne({ email })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Check if the OTP has already been used
    if (user.isOTPUsed) {
      return res.status(401).json({ error: 'OTP has already been used' })
    }

    // Compare the provided OTP with the hashed OTP in the database
    const isOTPValid = await bcrypt.compare(otp.toString(), user.otp)

    if (!isOTPValid) {
      return res.status(401).json({ error: 'Invalid OTP' })
    }

    // Mark the OTP as used
    user.isOTPUsed = true
    await user.save()

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, 'your_secret_key', {
      expiresIn: '24h'
    })

    res.status(200).json({ message: 'Login successful', token, user })
  } catch (error) {
    console.error('Error during login:', error)
    res.status(500).json({ error: 'An error occurred during login' })
  }
})

/**
 * Get user data route
 * @name GET /me
 * @function
 * @memberof module:routes/auth
 * @inner
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response object with user data or error
 */
router.get('/me', async (req, res) => {
  try {
    // Get the token from the request headers
    const token = req.headers.authorization

    // Decode the token to get the userId
    const decodedToken = jwt.verify(token, 'your_secret_key')
    const userId = decodedToken.userId

    // Find the user by userId
    const user = await User.findById(userId)

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Return the complete userData
    res.status(200).json({ user })
  } catch (error) {
    console.error('Error fetching user data:', error)
    res.status(500).json({ error: 'An error occurred while fetching user data' })
  }
})

module.exports = router
