import Joi from 'joi';

const hashtag = /^[a-zA-Z\u0400-\u04FF0-9]+$/;
const price = /^\d+(\.\d{1,2})?$/;
const shortid = /^[a-zA-Z0-9_-]{7,14}$/;
const username = /^[a-zA-Z0-9_.]+$/;

const tag = Joi.string()
  .regex(hashtag)
  .min(1)
  .max(30);

/**
 * Regexes used to validate inputs and DB schema
 */
export default {
  objectId: Joi.string()
    .hex()
    .length(24),
  hashtag,
  mobileNumber: /^[1-9][0-9]{9}$/,
  categoriesOrTypes: Joi.array()
    .unique()
    .max(5)
    .items(
      Joi.number()
        .min(0)
        .max(5)
    )
    .single(),
  description: Joi.string()
    .min(7)
    .max(300),
  photos: Joi.array()
    .unique()
    .max(6)
    .items(Joi.string().uri())
    .single(),
  price: Joi.string()
    .regex(price)
    .invalid('0')
    .invalid('0.00'),
  tag,
  tags: Joi.array()
    .max(30)
    .items(tag)
    .single(),
  uuid: Joi.string().regex(shortid),
  shortid,
  username: Joi.string()
    .regex(username)
    .min(0)
    .max(30),
};
