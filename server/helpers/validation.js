/**
 * Regexes used to validate inputs and DB schema
 */
export default {
  hashtag: /^[a-zA-Z\u0400-\u04FF0-9]+$/,
  mobileNumber: /^[1-9][0-9]{9}$/,
  price: /^\d+(\.\d{1,2})?$/,
  shortid: /^[a-zA-Z0-9_-]{7,14}$/,
  username: /^[a-zA-Z0-9\_\.]+$/,
};
