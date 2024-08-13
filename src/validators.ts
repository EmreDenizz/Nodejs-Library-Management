import Joi from 'joi';

// Validators for creating user
export const createUserSchema = Joi.object({
  name: Joi.string().min(1).max(255).required()
});

// Validators for borrowing book
export const borrowBookSchema = Joi.object({
  userId: Joi.number().integer().required(),
  bookId: Joi.number().integer().required()
});

// Validators for returning user
export const returnBookSchema = Joi.object({
  userId: Joi.number().integer().required(),
  bookId: Joi.number().integer().required(),
  score: Joi.number().min(0).max(10).optional()
});

// Validators for creating book
export const createBookSchema = Joi.object({
  name: Joi.string().min(1).max(255).required()
});
