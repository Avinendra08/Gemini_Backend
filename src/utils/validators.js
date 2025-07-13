import Joi from 'joi';

const validators = {
  // Auth validators
  signup: Joi.object({
    mobile_number: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    name: Joi.string().min(2).max(100).required(),
    password: Joi.string().min(6).required()
  }),

  sendOtp: Joi.object({
    mobile_number: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required()
  }),

  verifyOtp: Joi.object({
    mobile_number: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    otp: Joi.string().length(6).pattern(/^\d{6}$/).required()
  }),

  verifySignupOtp: Joi.object({
    mobile_number: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    otp: Joi.string().length(6).pattern(/^\d{6}$/).required(),
    name: Joi.string().min(2).max(100).required(),
    password: Joi.string().min(6).required()
  }),

  forgotPassword: Joi.object({
    mobile_number: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required()
  }),

  changePassword: Joi.object({
    current_password: Joi.string().required(),
    new_password: Joi.string().min(6).required()
  }),

  // Chatroom validators
  createChatroom: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    description: Joi.string().max(1000).optional()
  }),

  sendMessage: Joi.object({
    content: Joi.string().min(1).max(10000).required()
  }),

  // Subscription validators
  createSubscription: Joi.object({
    price_id: Joi.string().required(),
    success_url: Joi.string().uri().required(),
    cancel_url: Joi.string().uri().required()
  })
};

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }
    next();
  };
};

export {
  validators,
  validate
}; 